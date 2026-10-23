import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { passwordProblem } from '@/lib/password-policy';
import { enforceRateLimits } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { DEFAULT_COUNTRY, MAX_PLACE_LENGTH, cleanPlace, parseStoreLocation } from '@/lib/locations';
import { finishSignup, prepareSignup, signupWriteFailed } from '@/lib/phone-verification';

const SELLER_TYPES = ['MART', 'GULPLAZA_OWNER', 'WHOLESALER'] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const businessName = typeof body?.businessName === 'string' ? body.businessName.trim() : '';
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const sellerType = SELLER_TYPES.includes(body?.sellerType) ? body.sellerType : 'MART';
  const city = cleanPlace(body?.city);
  const country = cleanPlace(body?.country) || DEFAULT_COUNTRY;

  if (!businessName || !fullName || !email || !phone || !password || fullName.length > 120 || email.length > 254) {
    return NextResponse.json({ error: 'Please fill in all fields.' }, { status: 400 });
  }

  const problem = passwordProblem(password, [email, fullName]);

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ scope: 'signup-ip', subject: clientIp(request), limit: 10, windowSeconds: 3600 }]);

  if (limited) return limited;

  if (city.length > MAX_PLACE_LENGTH || country.length > MAX_PLACE_LENGTH) {
    return NextResponse.json({ error: `City and country can be up to ${MAX_PLACE_LENGTH} characters.` }, { status: 400 });
  }

  // Optional pin of the shop / kitchen on the map (food sellers are asked for it at signup).
  const location = parseStoreLocation(body?.location);

  if (location === 'invalid') {
    return NextResponse.json({ error: 'Please choose your shop location again from the suggestions.' }, { status: 400 });
  }

  const passwordHash = hashPassword(password);

  // With verification on this sends the WhatsApp code too, and the account below is created unverified (it can't log
  // in until the code is entered); with it off the account is confirmed and logged in at once.
  const signup = await prepareSignup(request, { email, phone });

  if (!signup.ok) {
    return signup.response;
  }

  let results: unknown[];

  try {
    results = await prisma.$transaction(
      signup.writes(
        prisma.user.create({
          data: {
            name: fullName,
            email,
            phone: signup.phone,
            password: await passwordHash,
            role: 'SELLER',
            seller: {
              create: {
                businessName,
                sellerType,
                city: city || null,
                country,
                ...(location ? { latitude: location.lat, longitude: location.lng, locationLabel: location.label } : {}),
              },
            },
            phoneVerifiedAt: signup.verifiedAt,
            phoneVerification: signup.record ? { create: signup.record } : undefined,
          },
        })
      )
    );
  } catch (error) {
    return signupWriteFailed(error);
  }

  return finishSignup(signup, results);
}

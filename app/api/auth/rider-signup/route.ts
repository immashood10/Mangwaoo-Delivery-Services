import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { clientIp } from '@/lib/client-ip';
import { passwordProblem } from '@/lib/password-policy';
import { finishSignup, prepareSignup, signupWriteFailed } from '@/lib/phone-verification';
import { enforceRateLimits } from '@/lib/rate-limit';
import { readRiderPhoto, type RiderPhoto } from '@/lib/rider-photo-upload';
import {
  RIDER_DOCUMENT_FIELDS,
  RIDER_DOCUMENT_KINDS,
  RIDER_VEHICLE_TYPES,
  formatCnic,
  isValidCnic,
  isValidNumberPlate,
  normalizeNumberPlate,
  vehicleNeedsNumberPlate,
} from '@/lib/rider-documents';

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Rider signup with identity details. Expects multipart/form-data with the
 * account fields plus the `cnicFront` / `cnicBack` / `facePhoto` photo files (all
 * three are required); everything is stored in the database (photos in
 * RiderDocument) for admin review.
 * The account can only log in after the WhatsApp code sent here is entered.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);

  if (!form) {
    return NextResponse.json({ error: 'Please fill in the signup form.' }, { status: 400 });
  }

  const fullName = field(form, 'fullName');
  const email = field(form, 'email').toLowerCase();
  const phone = field(form, 'phone');
  const password = typeof form.get('password') === 'string' ? (form.get('password') as string) : '';
  const vehicleType = (RIDER_VEHICLE_TYPES as readonly string[]).includes(field(form, 'vehicleType'))
    ? field(form, 'vehicleType')
    : RIDER_VEHICLE_TYPES[0];
  const numberPlate = normalizeNumberPlate(field(form, 'numberPlate'));
  const cnicNumber = formatCnic(field(form, 'cnicNumber'));

  if (!fullName || !email || !phone || !password || fullName.length > 120 || email.length > 254) {
    return NextResponse.json({ error: 'Please fill in all fields.' }, { status: 400 });
  }

  const problem = passwordProblem(password, [email, fullName]);

  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const limited = await enforceRateLimits([{ scope: 'signup-ip', subject: clientIp(request), limit: 10, windowSeconds: 3600 }]);

  if (limited) return limited;

  if (vehicleNeedsNumberPlate(vehicleType) && !isValidNumberPlate(numberPlate)) {
    return NextResponse.json({ error: 'Please enter a valid vehicle number plate, e.g. KHI-1234.' }, { status: 400 });
  }

  if (!isValidCnic(cnicNumber)) {
    return NextResponse.json({ error: 'Please enter a valid 13-digit CNIC number, e.g. 42101-1234567-1.' }, { status: 400 });
  }

  const documents: RiderPhoto[] = [];

  for (const kind of RIDER_DOCUMENT_KINDS) {
    const read = await readRiderPhoto(kind, form.get(RIDER_DOCUMENT_FIELDS[kind]));

    if (!read.ok) {
      return NextResponse.json({ error: read.error }, { status: 400 });
    }

    documents.push(read.photo);
  }

  const passwordHash = hashPassword(password);

  // With verification on this sends the WhatsApp code too, and the account below is created unverified (it can't log
  // in until the code is entered); with it off the account is confirmed and logged in at once.
  const signup = await prepareSignup(request, { email, phone });

  if (!signup.ok) {
    return signup.response;
  }

  // Riders start unapproved and offline — an admin reviews the details and
  // CNIC photos before they receive orders (and only once the rider's WhatsApp
  // number is confirmed). The nested create writes the rider and photos together.
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
            role: 'RIDER',
            rider: {
              create: {
                vehicleType,
                numberPlate: vehicleNeedsNumberPlate(vehicleType) ? numberPlate : null,
                cnicNumber,
                isAvailable: false,
                documents: { create: documents },
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

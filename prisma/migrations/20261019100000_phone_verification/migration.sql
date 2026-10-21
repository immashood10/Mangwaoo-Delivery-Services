-- WhatsApp verification: a new account can only log in after it enters the code sent to its WhatsApp number.
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('ACCOUNT', 'CHANGE');

ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- Accounts that already exist keep working: they were created before numbers were confirmed.
UPDATE "User" SET "phoneVerifiedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "PhoneVerificationPurpose" NOT NULL,
    "phone" TEXT NOT NULL,
    "ticketHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhoneVerification_userId_key" ON "PhoneVerification"("userId");
CREATE UNIQUE INDEX "PhoneVerification_ticketHash_key" ON "PhoneVerification"("ticketHash");

ALTER TABLE "PhoneVerification" ADD CONSTRAINT "PhoneVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PhoneVerificationSend" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerificationSend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneVerificationSend_phone_createdAt_idx" ON "PhoneVerificationSend"("phone", "createdAt");
CREATE INDEX "PhoneVerificationSend_ipHash_createdAt_idx" ON "PhoneVerificationSend"("ipHash", "createdAt");

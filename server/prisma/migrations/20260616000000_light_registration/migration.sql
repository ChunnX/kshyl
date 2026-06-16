ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "termsVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "privacyVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "registeredAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "updatedAt" DATETIME;

ALTER TABLE "Contribution" ADD COLUMN "contributorUserId" TEXT;

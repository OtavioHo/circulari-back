-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_otp_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_otp_hash" TEXT,
ADD COLUMN     "password_reset_token_expires_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_token_hash" TEXT;

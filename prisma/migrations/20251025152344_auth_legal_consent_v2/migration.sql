/*
  Warnings:

  - You are about to alter the column `entityId` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `ipAddress` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `userAgent` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(512)`.
  - You are about to alter the column `jurisdiction` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(8)`.
  - You are about to alter the column `mimeType` on the `Proof` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `ipfsCid` on the `Proof` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(128)`.
  - You are about to alter the column `hederaTopicId` on the `Proof` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `txId` on the `ProofAnchor` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - The `status` column on the `ProofAnchor` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `pdfSha256` on the `ProofCertificate` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `walletAddr` on the `ProofSignature` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(128)`.
  - You are about to alter the column `hashedJti` on the `RefreshToken` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(128)`.
  - You are about to alter the column `deviceId` on the `RefreshToken` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `version` on the `TermsAcceptance` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `ipAddress` on the `TermsAcceptance` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - You are about to alter the column `userAgent` on the `TermsAcceptance` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(512)`.
  - You are about to alter the column `email` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(320)`.
  - You are about to alter the column `fullName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(120)`.
  - You are about to alter the column `jurisdiction` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(8)`.
  - You are about to alter the column `termsVersionAccepted` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.
  - A unique constraint covering the columns `[userId,digestAlgo,digestHex]` on the table `Proof` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[proofId,network,hashKey]` on the table `ProofAnchor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[proofId,walletAddr,signatureAlgo,signedAt]` on the table `ProofSignature` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,version]` on the table `TermsAcceptance` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `entityType` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `digestHex` to the `Proof` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jurisdiction` to the `TermsAcceptance` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('USER', 'PROOF', 'ANCHOR', 'CERTIFICATE', 'LEGAL', 'AUTH', 'OTHER');

-- CreateEnum
CREATE TYPE "AnchorStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- DropIndex
DROP INDEX "public"."AuditLog_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Proof_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Proof_userId_idx";

-- DropIndex
DROP INDEX "public"."RefreshToken_createdAt_idx";

-- DropIndex
DROP INDEX "public"."RefreshToken_userId_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "requestId" VARCHAR(64),
DROP COLUMN "entityType",
ADD COLUMN     "entityType" "AuditEntity" NOT NULL,
ALTER COLUMN "entityId" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "ipAddress" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "userAgent" SET DATA TYPE VARCHAR(512),
ALTER COLUMN "jurisdiction" SET DATA TYPE VARCHAR(8);

-- AlterTable
ALTER TABLE "Proof" ADD COLUMN     "digestAlgo" "DigestAlgo" NOT NULL DEFAULT 'SHA256',
ADD COLUMN     "digestHex" VARCHAR(128) NOT NULL,
ALTER COLUMN "mimeType" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "sizeBytes" SET DATA TYPE BIGINT,
ALTER COLUMN "sha256" DROP NOT NULL,
ALTER COLUMN "ipfsCid" SET DATA TYPE VARCHAR(128),
ALTER COLUMN "hederaTopicId" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "ProofAnchor" ADD COLUMN     "hashKey" VARCHAR(200),
ALTER COLUMN "txId" SET DATA TYPE VARCHAR(200),
DROP COLUMN "status",
ADD COLUMN     "status" "AnchorStatus";

-- AlterTable
ALTER TABLE "ProofCertificate" ADD COLUMN     "platformKeyId" VARCHAR(100),
ALTER COLUMN "pdfSha256" SET DATA TYPE VARCHAR(64);

-- AlterTable
ALTER TABLE "ProofSignature" ADD COLUMN     "signatureAlgo" "SignatureAlgo",
ADD COLUMN     "signerPubKey" TEXT,
ALTER COLUMN "walletAddr" SET DATA TYPE VARCHAR(128);

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "hashedJti" SET DATA TYPE VARCHAR(128),
ALTER COLUMN "deviceId" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "TermsAcceptance" ADD COLUMN     "jurisdiction" VARCHAR(8) NOT NULL,
ALTER COLUMN "version" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "ipAddress" SET DATA TYPE VARCHAR(64),
ALTER COLUMN "userAgent" SET DATA TYPE VARCHAR(512);

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE VARCHAR(320),
ALTER COLUMN "fullName" SET DATA TYPE VARCHAR(120),
ALTER COLUMN "jurisdiction" SET DATA TYPE VARCHAR(8),
ALTER COLUMN "termsVersionAccepted" SET DATA TYPE VARCHAR(64);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "tosMd" TEXT NOT NULL,
    "privacyMd" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_version_key" ON "LegalDocument"("version");

-- CreateIndex
CREATE INDEX "LegalDocument_jurisdiction_isActive_effectiveAt_idx" ON "LegalDocument"("jurisdiction", "isActive", "effectiveAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- CreateIndex
CREATE INDEX "Proof_userId_createdAt_idx" ON "Proof"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Proof_digestAlgo_digestHex_idx" ON "Proof"("digestAlgo", "digestHex");

-- CreateIndex
CREATE UNIQUE INDEX "Proof_userId_digestAlgo_digestHex_key" ON "Proof"("userId", "digestAlgo", "digestHex");

-- CreateIndex
CREATE UNIQUE INDEX "ProofAnchor_proofId_network_hashKey_key" ON "ProofAnchor"("proofId", "network", "hashKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProofSignature_proofId_walletAddr_signatureAlgo_signedAt_key" ON "ProofSignature"("proofId", "walletAddr", "signatureAlgo", "signedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_createdAt_idx" ON "RefreshToken"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "TermsAcceptance_version_jurisdiction_idx" ON "TermsAcceptance"("version", "jurisdiction");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");

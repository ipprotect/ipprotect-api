/*
  Warnings:

  - Changed the type of `action` on the `AuditLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('UNVERIFIED', 'ANCHORED', 'ADMISSIBLE', 'REGISTERED');

-- CreateEnum
CREATE TYPE "AnchorNetwork" AS ENUM ('HEDERA', 'ETH_L2', 'BTC_OTS', 'OTHER');

-- CreateEnum
CREATE TYPE "SignatureAlgo" AS ENUM ('ED25519', 'ECDSA_P256', 'RSA_PSS', 'OTHER');

-- CreateEnum
CREATE TYPE "DigestAlgo" AS ENUM ('SHA256', 'SHA3_256', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'TOKEN_REFRESH', 'PROOF_CREATE', 'PROOF_VERIFY_PUBLIC', 'PROOF_CERTIFICATE_ISSUE', 'WALLET_LINK', 'WALLET_UNLINK', 'AI_REGENERATE_SUMMARY', 'LEGAL_ANCHOR', 'LEGAL_STATUS_UPDATE');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "jurisdiction" TEXT,
DROP COLUMN "action",
ADD COLUMN     "action" "AuditAction" NOT NULL;

-- AlterTable
ALTER TABLE "Proof" ADD COLUMN     "hederaConsensusAt" TIMESTAMP(3),
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "legalClauseVersion" TEXT,
ADD COLUMN     "legalStatus" "LegalStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "platformSignature" TEXT,
ADD COLUMN     "proofType" "ProofType";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "termsVersionAccepted" TEXT;

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofAnchor" (
    "id" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "network" "AnchorNetwork" NOT NULL,
    "txId" TEXT,
    "anchorRef" JSONB,
    "anchoredAt" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "ProofAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofCertificate" (
    "id" TEXT NOT NULL,
    "proofId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "serial" TEXT NOT NULL,
    "clauseVersion" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdfSha256" TEXT,
    "platformSignature" TEXT,
    "publicVerifyUrl" TEXT,

    CONSTRAINT "ProofCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_version_idx" ON "TermsAcceptance"("userId", "version");

-- CreateIndex
CREATE INDEX "ProofAnchor_proofId_network_idx" ON "ProofAnchor"("proofId", "network");

-- CreateIndex
CREATE UNIQUE INDEX "ProofAnchor_proofId_network_txId_key" ON "ProofAnchor"("proofId", "network", "txId");

-- CreateIndex
CREATE UNIQUE INDEX "ProofCertificate_serial_key" ON "ProofCertificate"("serial");

-- CreateIndex
CREATE INDEX "ProofCertificate_proofId_issuedAt_idx" ON "ProofCertificate"("proofId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProofCertificate_proofId_version_key" ON "ProofCertificate"("proofId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Proof_legalStatus_idx" ON "Proof"("legalStatus");

-- CreateIndex
CREATE INDEX "Proof_jurisdiction_idx" ON "Proof"("jurisdiction");

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofAnchor" ADD CONSTRAINT "ProofAnchor_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "Proof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofCertificate" ADD CONSTRAINT "ProofCertificate_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "Proof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

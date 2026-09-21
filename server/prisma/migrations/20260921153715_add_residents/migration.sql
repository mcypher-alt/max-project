-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "apartment" TEXT,
ADD COLUMN     "houseId" INTEGER,
ADD COLUMN     "residentId" INTEGER;

-- CreateTable
CREATE TABLE "residents" (
    "id" SERIAL NOT NULL,
    "maxUserId" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "apartment" TEXT,
    "companyId" TEXT,
    "houseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "residents_maxUserId_key" ON "residents"("maxUserId");

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "houses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

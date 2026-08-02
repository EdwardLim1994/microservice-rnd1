-- CreateTable
CREATE TABLE "Item2" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item2_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item2_itemId_idx" ON "Item2"("itemId");

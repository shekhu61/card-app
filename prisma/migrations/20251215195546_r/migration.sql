/*
  Warnings:

  - You are about to drop the `CustomerCoins` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CustomerCoins";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CustomerCoin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCoin_shopifyId_key" ON "CustomerCoin"("shopifyId");

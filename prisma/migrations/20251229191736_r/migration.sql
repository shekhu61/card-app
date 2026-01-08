/*
  Warnings:

  - You are about to drop the column `discountId` on the `CustomerCoins` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "CustomerDiscounts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "discountCode" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerDiscounts_email_fkey" FOREIGN KEY ("email") REFERENCES "CustomerCoins" ("email") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CustomerCoins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "coins" INTEGER NOT NULL
);
INSERT INTO "new_CustomerCoins" ("coins", "email", "id", "name") SELECT "coins", "email", "id", "name" FROM "CustomerCoins";
DROP TABLE "CustomerCoins";
ALTER TABLE "new_CustomerCoins" RENAME TO "CustomerCoins";
CREATE UNIQUE INDEX "CustomerCoins_email_key" ON "CustomerCoins"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDiscounts_email_key" ON "CustomerDiscounts"("email");

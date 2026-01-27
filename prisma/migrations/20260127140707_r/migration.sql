/*
  Warnings:

  - You are about to drop the `CustomerCoins` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomerDiscounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Employee` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CustomerCoins";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CustomerDiscounts";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Employee";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "pointsPerUnit" REAL NOT NULL,
    "currencyUnit" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardRule_name_key" ON "RewardRule"("name");

/*
  Warnings:

  - You are about to drop the `CustomerCoin` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CustomerCoin";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CustomerCoins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "coins" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCoins_email_key" ON "CustomerCoins"("email");

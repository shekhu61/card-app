/*
  Warnings:

  - You are about to drop the `RewardRule` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RewardRule";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "rewardRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "basePoints" REAL NOT NULL,
    "difference" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

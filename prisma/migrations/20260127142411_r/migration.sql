/*
  Warnings:

  - You are about to drop the column `name` on the `RewardRule` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RewardRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pointsPerUnit" REAL NOT NULL,
    "currencyUnit" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RewardRule" ("createdAt", "currencyUnit", "id", "isActive", "pointsPerUnit", "updatedAt") SELECT "createdAt", "currencyUnit", "id", "isActive", "pointsPerUnit", "updatedAt" FROM "RewardRule";
DROP TABLE "RewardRule";
ALTER TABLE "new_RewardRule" RENAME TO "RewardRule";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

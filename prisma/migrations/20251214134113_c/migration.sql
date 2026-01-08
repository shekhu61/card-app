/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AddPointsResult` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `EmployeePoints` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `EmployeePoints` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `EmployeePoints` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Reward` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `Reward` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Reward` table. All the data in the column will be lost.
  - You are about to drop the column `employeeId` on the `RewardDetail` table. All the data in the column will be lost.
  - Added the required column `employeeID` to the `EmployeePoints` table without a default value. This is not possible if the table is not empty.
  - Added the required column `employeeID` to the `RewardDetail` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AddPointsResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" INTEGER NOT NULL,
    "message" TEXT NOT NULL
);
INSERT INTO "new_AddPointsResult" ("id", "message", "status") SELECT "id", "message", "status" FROM "AddPointsResult";
DROP TABLE "AddPointsResult";
ALTER TABLE "new_AddPointsResult" RENAME TO "AddPointsResult";
CREATE TABLE "new_EmployeePoints" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeID" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "availablePoints" INTEGER NOT NULL,
    "totalEarnedPoints" INTEGER NOT NULL,
    "redeemedPoints" INTEGER NOT NULL,
    "addedPoints" INTEGER NOT NULL
);
INSERT INTO "new_EmployeePoints" ("addedPoints", "availablePoints", "employeeName", "id", "redeemedPoints", "totalEarnedPoints") SELECT "addedPoints", "availablePoints", "employeeName", "id", "redeemedPoints", "totalEarnedPoints" FROM "EmployeePoints";
DROP TABLE "EmployeePoints";
ALTER TABLE "new_EmployeePoints" RENAME TO "EmployeePoints";
CREATE TABLE "new_Reward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeNumber" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "regular" INTEGER NOT NULL,
    "fillinMakeUp" INTEGER NOT NULL,
    "cancellation" INTEGER NOT NULL,
    "unexcusedAbsence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_Reward" ("cancellation", "employeeNumber", "fillinMakeUp", "id", "isActive", "pointsEarned", "regular", "unexcusedAbsence") SELECT "cancellation", "employeeNumber", "fillinMakeUp", "id", "isActive", "pointsEarned", "regular", "unexcusedAbsence" FROM "Reward";
DROP TABLE "Reward";
ALTER TABLE "new_Reward" RENAME TO "Reward";
CREATE TABLE "new_RewardDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeAddedPointsID" INTEGER NOT NULL,
    "employeeID" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "companyID" INTEGER NOT NULL,
    "pointsAdded" INTEGER NOT NULL,
    "notes" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdDate" DATETIME NOT NULL,
    "updatedDate" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_RewardDetail" ("companyID", "createdDate", "employeeAddedPointsID", "employeeNumber", "endDate", "id", "isActive", "notes", "pointsAdded", "startDate", "updatedDate") SELECT "companyID", "createdDate", "employeeAddedPointsID", "employeeNumber", "endDate", "id", "isActive", "notes", "pointsAdded", "startDate", "updatedDate" FROM "RewardDetail";
DROP TABLE "RewardDetail";
ALTER TABLE "new_RewardDetail" RENAME TO "RewardDetail";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

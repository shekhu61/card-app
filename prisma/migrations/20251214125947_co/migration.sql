/*
  Warnings:

  - You are about to drop the `AddPointsLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmployeePointsSummary` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmployeeReward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmployeeRewardDetail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `employeeID` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `hireDate` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `workerType` on the `Employee` table. All the data in the column will be lost.
  - Made the column `emailAddress` on table `Employee` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "EmployeePointsSummary_employeeID_key";

-- DropIndex
DROP INDEX "EmployeeReward_employeeNumber_key";

-- DropIndex
DROP INDEX "EmployeeRewardDetail_employeeAddedPointsID_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AddPointsLog";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmployeePointsSummary";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmployeeReward";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmployeeRewardDetail";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Reward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "regular" INTEGER NOT NULL DEFAULT 0,
    "fillinMakeUp" INTEGER NOT NULL DEFAULT 0,
    "cancellation" INTEGER NOT NULL DEFAULT 0,
    "unexcusedAbsence" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reward_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeAddedPointsID" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "companyID" INTEGER NOT NULL,
    "pointsAdded" INTEGER NOT NULL,
    "notes" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME,
    CONSTRAINT "RewardDetail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddPointsResult" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmployeePoints" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "availablePoints" INTEGER NOT NULL DEFAULT 0,
    "totalEarnedPoints" INTEGER NOT NULL DEFAULT 0,
    "redeemedPoints" INTEGER NOT NULL DEFAULT 0,
    "addedPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeePoints_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "position" TEXT,
    "officeLocation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Employee" ("createdAt", "emailAddress", "employeeNumber", "firstName", "id", "isActive", "lastName", "officeLocation", "position", "updatedAt") SELECT "createdAt", "emailAddress", "employeeNumber", "firstName", "id", "isActive", "lastName", "officeLocation", "position", "updatedAt" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE UNIQUE INDEX "Employee_emailAddress_key" ON "Employee"("emailAddress");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Reward_employeeNumber_idx" ON "Reward"("employeeNumber");

-- CreateIndex
CREATE INDEX "RewardDetail_employeeNumber_idx" ON "RewardDetail"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePoints_employeeId_key" ON "EmployeePoints"("employeeId");

-- CreateTable
CREATE TABLE "EmployeeReward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeNumber" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "regular" INTEGER NOT NULL,
    "fillinMakeUp" INTEGER NOT NULL,
    "cancellation" INTEGER NOT NULL,
    "unexcusedAbsence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeReward_employeeNumber_fkey" FOREIGN KEY ("employeeNumber") REFERENCES "Employee" ("employeeNumber") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeRewardDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeAddedPointsID" INTEGER NOT NULL,
    "employeeID" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "companyID" INTEGER NOT NULL,
    "pointsAdded" INTEGER NOT NULL,
    "notes" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "createdDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedDate" DATETIME,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeRewardDetail_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "Employee" ("employeeID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AddPointsLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EmployeePointsSummary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeID" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "availablePoints" INTEGER NOT NULL,
    "totalEarnedPoints" INTEGER NOT NULL,
    "redeemedPoints" INTEGER NOT NULL,
    "addedPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeePointsSummary_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "Employee" ("employeeID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeID" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "emailAddress" TEXT,
    "position" TEXT,
    "officeLocation" TEXT,
    "workerType" TEXT,
    "isActive" BOOLEAN NOT NULL,
    "hireDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("createdAt", "emailAddress", "employeeID", "employeeNumber", "firstName", "hireDate", "id", "isActive", "lastName", "officeLocation", "position", "workerType") SELECT "createdAt", "emailAddress", "employeeID", "employeeNumber", "firstName", "hireDate", "id", "isActive", "lastName", "officeLocation", "position", "workerType" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeID_key" ON "Employee"("employeeID");
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeReward_employeeNumber_key" ON "EmployeeReward"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRewardDetail_employeeAddedPointsID_key" ON "EmployeeRewardDetail"("employeeAddedPointsID");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePointsSummary_employeeID_key" ON "EmployeePointsSummary"("employeeID");

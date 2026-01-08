-- CreateTable
CREATE TABLE "Reward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeID" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "regular" INTEGER NOT NULL,
    "fillinMakeUp" INTEGER NOT NULL,
    "cancellation" INTEGER NOT NULL,
    "unexcusedAbsence" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reward_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "Employee" ("employeeID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardDetail" (
    "employeeAddedPointsID" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT "RewardDetail_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "Employee" ("employeeID") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "employeeID" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "availablePoints" INTEGER NOT NULL,
    "totalEarnedPoints" INTEGER NOT NULL,
    "redeemedPoints" INTEGER NOT NULL,
    "addedPoints" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeePoints_employeeID_fkey" FOREIGN KEY ("employeeID") REFERENCES "Employee" ("employeeID") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePoints_employeeID_key" ON "EmployeePoints"("employeeID");

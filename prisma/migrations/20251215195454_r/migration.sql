-- AlterTable
ALTER TABLE "Session" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "Session" ADD COLUMN "refreshTokenExpires" DATETIME;

-- CreateTable
CREATE TABLE "Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeID" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "officeLocation" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "workerType" TEXT NOT NULL,
    "hireDate" DATETIME NOT NULL,
    "terminationDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeID_key" ON "Employee"("employeeID");

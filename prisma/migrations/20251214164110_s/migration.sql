/*
  Warnings:

  - Added the required column `workerType` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeID" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "officeLocation" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "workerType" TEXT NOT NULL,
    "hireDate" DATETIME,
    "terminationDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("createdAt", "emailAddress", "employeeID", "employeeNumber", "firstName", "id", "isActive", "lastName", "officeLocation", "position") SELECT "createdAt", "emailAddress", "employeeID", "employeeNumber", "firstName", "id", "isActive", "lastName", "officeLocation", "position" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeID_key" ON "Employee"("employeeID");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

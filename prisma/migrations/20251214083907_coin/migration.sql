/*
  Warnings:

  - You are about to drop the column `hireDate` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `terminationDate` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `workerType` on the `Employee` table. All the data in the column will be lost.

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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Employee" ("createdAt", "emailAddress", "employeeID", "employeeNumber", "firstName", "id", "isActive", "lastName", "officeLocation", "position") SELECT "createdAt", "emailAddress", "employeeID", "employeeNumber", "firstName", "id", "isActive", "lastName", "officeLocation", "position" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_employeeID_key" ON "Employee"("employeeID");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

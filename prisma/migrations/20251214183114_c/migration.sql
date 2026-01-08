/*
  Warnings:

  - You are about to drop the `AddPointsResult` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EmployeePoints` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RewardDetail` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AddPointsResult";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmployeePoints";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Reward";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "RewardDetail";
PRAGMA foreign_keys=on;

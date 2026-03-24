/*
  Warnings:

  - You are about to drop the column `Inventory` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "Inventory",
ADD COLUMN     "inventory" INTEGER NOT NULL DEFAULT 0;

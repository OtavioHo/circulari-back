/*
  Warnings:

  - You are about to drop the column `location_id` on the `items` table. All the data in the column will be lost.
  - You are about to drop the `locations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "items" DROP CONSTRAINT "items_location_id_fkey";

-- DropForeignKey
ALTER TABLE "locations" DROP CONSTRAINT "locations_user_id_fkey";

-- AlterTable
ALTER TABLE "items" DROP COLUMN "location_id";

-- AlterTable
ALTER TABLE "lists" ADD COLUMN     "location" TEXT;

-- DropTable
DROP TABLE "locations";

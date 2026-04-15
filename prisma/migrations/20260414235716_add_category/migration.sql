-- AlterTable
ALTER TABLE "items" ADD COLUMN     "category_id" TEXT;

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

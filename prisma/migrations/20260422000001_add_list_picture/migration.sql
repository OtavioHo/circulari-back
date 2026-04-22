-- Create list_pictures table
CREATE TABLE "list_pictures" (
  "id"    TEXT NOT NULL,
  "slug"  TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "list_pictures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "list_pictures_slug_key" ON "list_pictures"("slug");

-- Insert default picture with a fixed UUID
INSERT INTO "list_pictures" ("id", "slug", "order")
VALUES ('00000000-0000-0000-0000-000000000001', 'storage', 0)
ON CONFLICT ("slug") DO NOTHING;

-- Add picture_id as nullable with the default pointing to the seeded row
ALTER TABLE "lists"
  ADD COLUMN "picture_id" TEXT DEFAULT '00000000-0000-0000-0000-000000000001';

-- Back-fill any NULLs
UPDATE "lists"
SET "picture_id" = '00000000-0000-0000-0000-000000000001'
WHERE "picture_id" IS NULL;

-- Make column NOT NULL
ALTER TABLE "lists" ALTER COLUMN "picture_id" SET NOT NULL;

-- Drop the DEFAULT
ALTER TABLE "lists" ALTER COLUMN "picture_id" DROP DEFAULT;

-- Add FK constraint
ALTER TABLE "lists"
  ADD CONSTRAINT "lists_picture_id_fkey" FOREIGN KEY ("picture_id") REFERENCES "list_pictures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

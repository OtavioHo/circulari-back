-- Create list_pictures table (slug as PK)
CREATE TABLE "list_pictures" (
  "slug"  TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "list_pictures_pkey" PRIMARY KEY ("slug")
);

-- Insert default picture
INSERT INTO "list_pictures" ("slug", "order")
VALUES ('storage', 0)
ON CONFLICT ("slug") DO NOTHING;

-- Add picture_id as nullable with default
ALTER TABLE "lists"
  ADD COLUMN "picture_id" TEXT DEFAULT 'storage';

-- Back-fill existing rows
UPDATE "lists"
SET "picture_id" = 'storage'
WHERE "picture_id" IS NULL;

-- Make column NOT NULL
ALTER TABLE "lists" ALTER COLUMN "picture_id" SET NOT NULL;

-- Drop the DEFAULT
ALTER TABLE "lists" ALTER COLUMN "picture_id" DROP DEFAULT;

-- Add FK constraint
ALTER TABLE "lists"
  ADD CONSTRAINT "lists_picture_id_fkey" FOREIGN KEY ("picture_id") REFERENCES "list_pictures"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

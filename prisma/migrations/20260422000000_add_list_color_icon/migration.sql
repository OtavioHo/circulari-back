-- Create list_colors table
CREATE TABLE "list_colors" (
  "id"       TEXT NOT NULL,
  "name"     TEXT NOT NULL,
  "hex_code" TEXT NOT NULL,
  "order"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "list_colors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "list_colors_name_key" ON "list_colors"("name");

-- Create list_icons table
CREATE TABLE "list_icons" (
  "id"    TEXT NOT NULL,
  "name"  TEXT NOT NULL,
  "slug"  TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "list_icons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "list_icons_name_key" ON "list_icons"("name");
CREATE UNIQUE INDEX "list_icons_slug_key" ON "list_icons"("slug");

-- Insert default color and icon with fixed UUIDs
INSERT INTO "list_colors" ("id", "name", "hex_code", "order")
VALUES ('00000000-0000-0000-0000-000000000001', 'Vermelho', '#EF4444', 0)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "list_icons" ("id", "name", "slug", "order")
VALUES ('00000000-0000-0000-0000-000000000001', 'Lista', 'list', 0)
ON CONFLICT ("name") DO NOTHING;

-- Add color_id and icon_id as nullable with defaults pointing to the seeded rows
ALTER TABLE "lists"
  ADD COLUMN "color_id" TEXT DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN "icon_id"  TEXT DEFAULT '00000000-0000-0000-0000-000000000001';

-- Back-fill any NULLs (safety net for existing rows)
UPDATE "lists"
SET
  "color_id" = '00000000-0000-0000-0000-000000000001',
  "icon_id"  = '00000000-0000-0000-0000-000000000001'
WHERE "color_id" IS NULL OR "icon_id" IS NULL;

-- Make columns NOT NULL
ALTER TABLE "lists" ALTER COLUMN "color_id" SET NOT NULL;
ALTER TABLE "lists" ALTER COLUMN "icon_id"  SET NOT NULL;

-- Drop the DEFAULT (Prisma manages defaults at the application layer)
ALTER TABLE "lists" ALTER COLUMN "color_id" DROP DEFAULT;
ALTER TABLE "lists" ALTER COLUMN "icon_id"  DROP DEFAULT;

-- Add FK constraints
ALTER TABLE "lists"
  ADD CONSTRAINT "lists_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "list_colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lists"
  ADD CONSTRAINT "lists_icon_id_fkey" FOREIGN KEY ("icon_id") REFERENCES "list_icons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

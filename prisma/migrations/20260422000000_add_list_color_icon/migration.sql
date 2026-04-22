-- Create list_colors table (hex_code as PK)
CREATE TABLE "list_colors" (
  "hex_code" TEXT NOT NULL,
  "name"     TEXT NOT NULL,
  "order"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "list_colors_pkey" PRIMARY KEY ("hex_code")
);
CREATE UNIQUE INDEX "list_colors_name_key" ON "list_colors"("name");

-- Create list_icons table (slug as PK)
CREATE TABLE "list_icons" (
  "slug"  TEXT NOT NULL,
  "name"  TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "list_icons_pkey" PRIMARY KEY ("slug")
);
CREATE UNIQUE INDEX "list_icons_name_key" ON "list_icons"("name");

-- Insert default color and icon
INSERT INTO "list_colors" ("hex_code", "name", "order")
VALUES ('#EF4444', 'Vermelho', 0)
ON CONFLICT ("hex_code") DO NOTHING;

INSERT INTO "list_icons" ("slug", "name", "order")
VALUES ('list', 'Lista', 0)
ON CONFLICT ("slug") DO NOTHING;

-- Add color_id and icon_id as nullable with defaults
ALTER TABLE "lists"
  ADD COLUMN "color_id" TEXT DEFAULT '#EF4444',
  ADD COLUMN "icon_id"  TEXT DEFAULT 'list';

-- Back-fill existing rows
UPDATE "lists"
SET
  "color_id" = '#EF4444',
  "icon_id"  = 'list'
WHERE "color_id" IS NULL OR "icon_id" IS NULL;

-- Make columns NOT NULL
ALTER TABLE "lists" ALTER COLUMN "color_id" SET NOT NULL;
ALTER TABLE "lists" ALTER COLUMN "icon_id"  SET NOT NULL;

-- Drop the DEFAULT
ALTER TABLE "lists" ALTER COLUMN "color_id" DROP DEFAULT;
ALTER TABLE "lists" ALTER COLUMN "icon_id"  DROP DEFAULT;

-- Add FK constraints
ALTER TABLE "lists"
  ADD CONSTRAINT "lists_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "list_colors"("hex_code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lists"
  ADD CONSTRAINT "lists_icon_id_fkey" FOREIGN KEY ("icon_id") REFERENCES "list_icons"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

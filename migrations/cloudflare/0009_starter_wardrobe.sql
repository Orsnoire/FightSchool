-- Additive equipment slots. Existing inventory, loadouts, colors and progress survive.
ALTER TABLE students ADD COLUMN offhand text;
ALTER TABLE students ADD COLUMN hands text;
ALTER TABLE students ADD COLUMN legs text;
ALTER TABLE students ADD COLUMN feet text;
ALTER TABLE equipment_items ADD COLUMN armor_category text CHECK (armor_category IN ('heavy_armor', 'leather_armor', 'light_armor'));
ALTER TABLE equipment_items ADD COLUMN offhand_type text CHECK (offhand_type IN ('shield', 'potion', 'quiver'));
-- Built-in starter ownership is a permanent catalog entitlement, not duplicated inventory rows.
-- Existing loadouts are not rewritten by migration. Their next job selection uses compatible starters.

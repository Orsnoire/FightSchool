-- Extend the existing text constraint without changing existing items or loadouts.
ALTER TABLE equipment_items DROP CONSTRAINT equipment_items_offhand_type_check;
--> statement-breakpoint
ALTER TABLE equipment_items ADD CONSTRAINT equipment_items_offhand_type_check
  CHECK (offhand_type IN ('shield', 'potion', 'quiver', 'spellbook'));

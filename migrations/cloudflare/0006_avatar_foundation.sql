CREATE TABLE "avatar_colors" (
	"palette_id" text NOT NULL,
	"id" text NOT NULL,
	"label" text NOT NULL,
	"hex" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "avatar_colors_palette_id_id_pk" PRIMARY KEY("palette_id","id"),
	CONSTRAINT "avatar_colors_hex_check" CHECK ("avatar_colors"."hex" ~ '^#[0-9A-Fa-f]{6}$'),
	CONSTRAINT "avatar_colors_order_check" CHECK ("avatar_colors"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "avatar_equipment" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gameplay_item_id" uuid,
	"builtin_item_id" text,
	CONSTRAINT "avatar_equipment_one_item_link" CHECK ("avatar_equipment"."gameplay_item_id" IS NULL OR "avatar_equipment"."builtin_item_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "avatar_equipment_fits" (
	"equipment_id" text NOT NULL,
	"model_id" text NOT NULL,
	"slot_id" text NOT NULL,
	CONSTRAINT "avatar_equipment_fits_equipment_id_model_id_slot_id_pk" PRIMARY KEY("equipment_id","model_id","slot_id")
);
--> statement-breakpoint
CREATE TABLE "avatar_equipment_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"body_part" text NOT NULL,
	"side" text NOT NULL,
	"kind" text NOT NULL,
	CONSTRAINT "avatar_slots_side_check" CHECK ("avatar_equipment_slots"."side" IN ('left','right','center')),
	CONSTRAINT "avatar_slots_kind_check" CHECK ("avatar_equipment_slots"."kind" IN ('wearable','grip'))
);
--> statement-breakpoint
CREATE TABLE "avatar_equipment_visuals" (
	"equipment_id" text NOT NULL,
	"model_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"view_key" text NOT NULL,
	"asset_path" text NOT NULL,
	"attachment" jsonb,
	"ready" boolean DEFAULT false NOT NULL,
	CONSTRAINT "avatar_equipment_visuals_equipment_id_model_id_slot_id_view_key_pk" PRIMARY KEY("equipment_id","model_id","slot_id","view_key"),
	CONSTRAINT "avatar_equipment_visuals_ready_check" CHECK (NOT "avatar_equipment_visuals"."ready" OR "avatar_equipment_visuals"."attachment" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "avatar_equipped_items" (
	"avatar_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"equipment_id" text NOT NULL,
	CONSTRAINT "avatar_equipped_items_avatar_id_slot_id_pk" PRIMARY KEY("avatar_id","slot_id")
);
--> statement-breakpoint
CREATE TABLE "avatar_model_slots" (
	"model_id" text NOT NULL,
	"slot_id" text NOT NULL,
	"bone_name" text NOT NULL,
	"view_transforms" jsonb,
	CONSTRAINT "avatar_model_slots_model_id_slot_id_pk" PRIMARY KEY("model_id","slot_id")
);
--> statement-breakpoint
CREATE TABLE "avatar_model_views" (
	"model_id" text NOT NULL,
	"view_key" text NOT NULL,
	"source_path" text NOT NULL,
	"source_sha256" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"facing" text NOT NULL,
	"intended_yaw" integer NOT NULL,
	"hair_mask_path" text,
	"eye_mask_path" text,
	"skin_mask_path" text,
	"neutral_base_path" text,
	"rig_path" text,
	"parts_path" text,
	"recolor_ready" boolean DEFAULT false NOT NULL,
	"rig_ready" boolean DEFAULT false NOT NULL,
	CONSTRAINT "avatar_model_views_model_id_view_key_pk" PRIMARY KEY("model_id","view_key"),
	CONSTRAINT "avatar_views_dimensions_check" CHECK ("avatar_model_views"."width" > 0 AND "avatar_model_views"."height" > 0),
	CONSTRAINT "avatar_views_yaw_check" CHECK ("avatar_model_views"."intended_yaw" BETWEEN -180 AND 180),
	CONSTRAINT "avatar_views_sha_check" CHECK ("avatar_model_views"."source_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "avatar_views_masks_check" CHECK (NOT "avatar_model_views"."recolor_ready" OR ("avatar_model_views"."hair_mask_path" IS NOT NULL AND "avatar_model_views"."eye_mask_path" IS NOT NULL AND "avatar_model_views"."skin_mask_path" IS NOT NULL AND "avatar_model_views"."neutral_base_path" IS NOT NULL)),
	CONSTRAINT "avatar_views_rig_check" CHECK (NOT "avatar_model_views"."rig_ready" OR ("avatar_model_views"."rig_path" IS NOT NULL AND "avatar_model_views"."parts_path" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "avatar_models" (
	"id" text PRIMARY KEY NOT NULL,
	"species" text NOT NULL,
	"body_type" text NOT NULL,
	"rig_family" text NOT NULL,
	"status" text DEFAULT 'concept' NOT NULL,
	"hair_palette_id" text NOT NULL,
	"eye_palette_id" text NOT NULL,
	"skin_palette_id" text NOT NULL,
	"hair_channel" text DEFAULT 'hair' NOT NULL,
	"eye_channel" text DEFAULT 'eyes' NOT NULL,
	"skin_channel" text DEFAULT 'skin' NOT NULL,
	"color_regions" jsonb NOT NULL,
	CONSTRAINT "avatar_models_palette_key" UNIQUE("id","hair_palette_id","eye_palette_id","skin_palette_id"),
	CONSTRAINT "avatar_models_channels_check" CHECK ("avatar_models"."hair_channel" = 'hair' AND "avatar_models"."eye_channel" = 'eyes' AND "avatar_models"."skin_channel" = 'skin'),
	CONSTRAINT "avatar_models_status_check" CHECK ("avatar_models"."status" IN ('concept','production','retired'))
);
--> statement-breakpoint
CREATE TABLE "avatar_palettes" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "avatar_palettes_channel_key" UNIQUE("id","channel"),
	CONSTRAINT "avatar_palettes_channel_check" CHECK ("avatar_palettes"."channel" IN ('hair','eyes','skin')),
	CONSTRAINT "avatar_palettes_version_check" CHECK ("avatar_palettes"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "student_avatars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"hair_palette_id" text NOT NULL,
	"hair_color_id" text NOT NULL,
	"eye_palette_id" text NOT NULL,
	"eye_color_id" text NOT NULL,
	"skin_palette_id" text NOT NULL,
	"skin_color_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_avatars_student_id_unique" UNIQUE("student_id"),
	CONSTRAINT "student_avatars_model_key" UNIQUE("id","model_id")
);
--> statement-breakpoint
ALTER TABLE "avatar_colors" ADD CONSTRAINT "avatar_colors_palette_id_avatar_palettes_id_fk" FOREIGN KEY ("palette_id") REFERENCES "public"."avatar_palettes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipment" ADD CONSTRAINT "avatar_equipment_gameplay_item_id_equipment_items_id_fk" FOREIGN KEY ("gameplay_item_id") REFERENCES "public"."equipment_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipment_fits" ADD CONSTRAINT "avatar_equipment_fits_equipment_id_avatar_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."avatar_equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipment_fits" ADD CONSTRAINT "avatar_equipment_fits_slot_fk" FOREIGN KEY ("model_id","slot_id") REFERENCES "public"."avatar_model_slots"("model_id","slot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipment_visuals" ADD CONSTRAINT "avatar_equipment_visuals_fit_fk" FOREIGN KEY ("equipment_id","model_id","slot_id") REFERENCES "public"."avatar_equipment_fits"("equipment_id","model_id","slot_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipment_visuals" ADD CONSTRAINT "avatar_equipment_visuals_view_fk" FOREIGN KEY ("model_id","view_key") REFERENCES "public"."avatar_model_views"("model_id","view_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipped_items" ADD CONSTRAINT "avatar_equipped_items_avatar_fk" FOREIGN KEY ("avatar_id","model_id") REFERENCES "public"."student_avatars"("id","model_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_equipped_items" ADD CONSTRAINT "avatar_equipped_items_fit_fk" FOREIGN KEY ("equipment_id","model_id","slot_id") REFERENCES "public"."avatar_equipment_fits"("equipment_id","model_id","slot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_model_slots" ADD CONSTRAINT "avatar_model_slots_model_id_avatar_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."avatar_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_model_slots" ADD CONSTRAINT "avatar_model_slots_slot_id_avatar_equipment_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."avatar_equipment_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_model_views" ADD CONSTRAINT "avatar_model_views_model_id_avatar_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."avatar_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_models" ADD CONSTRAINT "avatar_models_hair_palette_fk" FOREIGN KEY ("hair_palette_id","hair_channel") REFERENCES "public"."avatar_palettes"("id","channel") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_models" ADD CONSTRAINT "avatar_models_eye_palette_fk" FOREIGN KEY ("eye_palette_id","eye_channel") REFERENCES "public"."avatar_palettes"("id","channel") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avatar_models" ADD CONSTRAINT "avatar_models_skin_palette_fk" FOREIGN KEY ("skin_palette_id","skin_channel") REFERENCES "public"."avatar_palettes"("id","channel") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_avatars" ADD CONSTRAINT "student_avatars_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_avatars" ADD CONSTRAINT "student_avatars_model_palettes_fk" FOREIGN KEY ("model_id","hair_palette_id","eye_palette_id","skin_palette_id") REFERENCES "public"."avatar_models"("id","hair_palette_id","eye_palette_id","skin_palette_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_avatars" ADD CONSTRAINT "student_avatars_hair_color_fk" FOREIGN KEY ("hair_palette_id","hair_color_id") REFERENCES "public"."avatar_colors"("palette_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_avatars" ADD CONSTRAINT "student_avatars_eye_color_fk" FOREIGN KEY ("eye_palette_id","eye_color_id") REFERENCES "public"."avatar_colors"("palette_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_avatars" ADD CONSTRAINT "student_avatars_skin_color_fk" FOREIGN KEY ("skin_palette_id","skin_color_id") REFERENCES "public"."avatar_colors"("palette_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "avatar_colors_order_unique" ON "avatar_colors" USING btree ("palette_id","sort_order");
--> statement-breakpoint
-- Approved Human catalog from attached_assets/characters/human/v1/manifest.json.
-- Asset metadata only: no test users, student backfill, gear grants or fake rigs.
INSERT INTO "avatar_palettes" ("id", "channel", "version") VALUES
  ('human-hair-v1', 'hair', 1),
  ('human-eyes-v1', 'eyes', 1),
  ('human-skin-v1', 'skin', 1);
--> statement-breakpoint
INSERT INTO "avatar_colors" ("palette_id", "id", "label", "hex", "sort_order") VALUES
  ('human-hair-v1', 'black', 'Black', '#181514', 0),
  ('human-hair-v1', 'espresso', 'Espresso', '#30211B', 1),
  ('human-hair-v1', 'dark-brown', 'Dark brown', '#493126', 2),
  ('human-hair-v1', 'chestnut', 'Chestnut', '#70452F', 3),
  ('human-hair-v1', 'auburn', 'Auburn', '#7B3C2C', 4),
  ('human-hair-v1', 'copper', 'Copper', '#B5683C', 5),
  ('human-hair-v1', 'dark-blond', 'Dark blond', '#9A774B', 6),
  ('human-hair-v1', 'golden-blond', 'Golden blond', '#D3AE63', 7),
  ('human-eyes-v1', 'deep-brown', 'Deep brown', '#35251C', 0),
  ('human-eyes-v1', 'brown', 'Brown', '#604029', 1),
  ('human-eyes-v1', 'light-brown', 'Light brown', '#8A6340', 2),
  ('human-eyes-v1', 'amber', 'Amber', '#B4863C', 3),
  ('human-eyes-v1', 'hazel', 'Hazel', '#7C7D4C', 4),
  ('human-eyes-v1', 'green', 'Green', '#627B55', 5),
  ('human-eyes-v1', 'blue', 'Blue', '#668CAA', 6),
  ('human-eyes-v1', 'gray', 'Gray', '#879196', 7),
  ('human-skin-v1', 'fair-cool', 'Fair cool', '#F3D8D0', 0),
  ('human-skin-v1', 'fair-warm', 'Fair warm', '#F2D4B5', 1),
  ('human-skin-v1', 'light-beige', 'Light beige', '#DFC0A1', 2),
  ('human-skin-v1', 'light-olive', 'Light olive', '#BEA078', 3),
  ('human-skin-v1', 'medium-golden', 'Medium golden', '#BC8A5F', 4),
  ('human-skin-v1', 'medium-brown', 'Medium brown', '#966542', 5),
  ('human-skin-v1', 'deep-brown', 'Deep brown', '#684431', 6),
  ('human-skin-v1', 'very-deep-brown', 'Very deep brown', '#3F2A22', 7);
--> statement-breakpoint
INSERT INTO "avatar_models" ("id", "species", "body_type", "rig_family", "status", "hair_palette_id", "eye_palette_id", "skin_palette_id", "color_regions") VALUES
  ('human-male-v1', 'human', 'male', 'human-chibi-v1', 'concept', 'human-hair-v1', 'human-eyes-v1', 'human-skin-v1', '{"hair":{"regions":["scalp hair","eyebrows"],"excludedRegions":["black ink outlines","eyelashes"]},"eyes":{"regions":["irises"],"excludedRegions":["pupils","eye whites","highlights","eyelashes","black ink outlines"]},"skin":{"regions":["face","ears","neck","exposed arms","hands"],"excludedRegions":["hair","irises","clothing","black ink outlines"]}}'),
  ('human-female-v1', 'human', 'female', 'human-chibi-v1', 'concept', 'human-hair-v1', 'human-eyes-v1', 'human-skin-v1', '{"hair":{"regions":["scalp hair","eyebrows"],"excludedRegions":["black ink outlines","eyelashes"]},"eyes":{"regions":["irises"],"excludedRegions":["pupils","eye whites","highlights","eyelashes","black ink outlines"]},"skin":{"regions":["face","ears","neck","exposed arms","hands"],"excludedRegions":["hair","irises","clothing","black ink outlines"]}}');
--> statement-breakpoint
INSERT INTO "avatar_model_views" ("model_id", "view_key", "source_path", "source_sha256", "width", "height", "facing", "intended_yaw") VALUES
  ('human-male-v1', 'front', 'attached_assets/characters/human/v1/human-male-front.png', '712a61d2c007785df0b0723ca785a8a6982ac3d916f591a2a169a9ad06ae4e01', 1024, 1536, 'front', 0),
  ('human-male-v1', 'rightNearProfile', 'attached_assets/characters/human/v1/human-male-right-80.png', '520bf954490b708adeb254f426f15fbc55c1074d80c5018ca5b4f67d970121f9', 1024, 1536, 'screen-right', 80),
  ('human-female-v1', 'front', 'attached_assets/characters/human/v1/human-female-front.png', 'a193fe478ba20226b4f7f0030caf02629755c403a8662b67ede7a8a8654141e8', 1024, 1536, 'front', 0),
  ('human-female-v1', 'rightNearProfile', 'attached_assets/characters/human/v1/human-female-right-80.png', 'd94a55299aa109caa35f3dbcb316a13374c2793be991e1ee94c9363d508b3349', 1024, 1536, 'screen-right', 80);
--> statement-breakpoint
INSERT INTO "avatar_equipment_slots" ("id", "label", "body_part", "side", "kind") VALUES
  ('head', 'Head', 'head', 'center', 'wearable'),
  ('neck', 'Neck', 'neck', 'center', 'wearable'),
  ('torso', 'Torso', 'torso', 'center', 'wearable'),
  ('pelvis', 'Pelvis / waist', 'pelvis', 'center', 'wearable'),
  ('left-upper-arm', 'Left upper arm', 'upper-arm', 'left', 'wearable'),
  ('right-upper-arm', 'Right upper arm', 'upper-arm', 'right', 'wearable'),
  ('left-forearm', 'Left forearm', 'forearm', 'left', 'wearable'),
  ('right-forearm', 'Right forearm', 'forearm', 'right', 'wearable'),
  ('left-hand', 'Left hand / glove', 'hand', 'left', 'wearable'),
  ('right-hand', 'Right hand / glove', 'hand', 'right', 'wearable'),
  ('left-thigh', 'Left thigh', 'thigh', 'left', 'wearable'),
  ('right-thigh', 'Right thigh', 'thigh', 'right', 'wearable'),
  ('left-shin', 'Left shin', 'shin', 'left', 'wearable'),
  ('right-shin', 'Right shin', 'shin', 'right', 'wearable'),
  ('left-foot', 'Left foot / boot', 'foot', 'left', 'wearable'),
  ('right-foot', 'Right foot / boot', 'foot', 'right', 'wearable'),
  ('left-grip', 'Left weapon / shield grip', 'hand', 'left', 'grip'),
  ('right-grip', 'Right weapon / shield grip', 'hand', 'right', 'grip');
--> statement-breakpoint
INSERT INTO "avatar_model_slots" ("model_id", "slot_id", "bone_name") VALUES
  ('human-male-v1', 'head', 'head'),
  ('human-male-v1', 'neck', 'neck'),
  ('human-male-v1', 'torso', 'torso'),
  ('human-male-v1', 'pelvis', 'pelvis'),
  ('human-male-v1', 'left-upper-arm', 'left_upper_arm'),
  ('human-male-v1', 'right-upper-arm', 'right_upper_arm'),
  ('human-male-v1', 'left-forearm', 'left_forearm'),
  ('human-male-v1', 'right-forearm', 'right_forearm'),
  ('human-male-v1', 'left-hand', 'left_hand'),
  ('human-male-v1', 'right-hand', 'right_hand'),
  ('human-male-v1', 'left-thigh', 'left_thigh'),
  ('human-male-v1', 'right-thigh', 'right_thigh'),
  ('human-male-v1', 'left-shin', 'left_shin'),
  ('human-male-v1', 'right-shin', 'right_shin'),
  ('human-male-v1', 'left-foot', 'left_foot'),
  ('human-male-v1', 'right-foot', 'right_foot'),
  ('human-male-v1', 'left-grip', 'left_hand'),
  ('human-male-v1', 'right-grip', 'right_hand'),
  ('human-female-v1', 'head', 'head'),
  ('human-female-v1', 'neck', 'neck'),
  ('human-female-v1', 'torso', 'torso'),
  ('human-female-v1', 'pelvis', 'pelvis'),
  ('human-female-v1', 'left-upper-arm', 'left_upper_arm'),
  ('human-female-v1', 'right-upper-arm', 'right_upper_arm'),
  ('human-female-v1', 'left-forearm', 'left_forearm'),
  ('human-female-v1', 'right-forearm', 'right_forearm'),
  ('human-female-v1', 'left-hand', 'left_hand'),
  ('human-female-v1', 'right-hand', 'right_hand'),
  ('human-female-v1', 'left-thigh', 'left_thigh'),
  ('human-female-v1', 'right-thigh', 'right_thigh'),
  ('human-female-v1', 'left-shin', 'left_shin'),
  ('human-female-v1', 'right-shin', 'right_shin'),
  ('human-female-v1', 'left-foot', 'left_foot'),
  ('human-female-v1', 'right-foot', 'right_foot'),
  ('human-female-v1', 'left-grip', 'left_hand'),
  ('human-female-v1', 'right-grip', 'right_hand');

CREATE TABLE "aa_purchases" (
	"student_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"upgrade_id" text NOT NULL,
	"rank" integer NOT NULL,
	"cost" integer NOT NULL,
	"catalog_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"receipt" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aa_purchases_student_id_request_id_pk" PRIMARY KEY("student_id","request_id"),
	CONSTRAINT "aa_purchases_cost_check" CHECK ("aa_purchases"."cost" >= 0)
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "aa_points_spent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "aa_ranks" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "aa_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "character_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "cross_class_abilities" jsonb;--> statement-breakpoint
ALTER TABLE "aa_purchases" ADD CONSTRAINT "aa_purchases_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_aa_spent_check" CHECK ("students"."aa_points_spent" >= 0);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_aa_revision_check" CHECK ("students"."aa_revision" >= 0);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_aa_ranks_check" CHECK (jsonb_typeof("students"."aa_ranks") = 'object');--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_cross_class_list_check" CHECK ("students"."cross_class_abilities" IS NULL OR (jsonb_typeof("students"."cross_class_abilities") = 'array' AND jsonb_array_length("students"."cross_class_abilities") <= 5));
--> statement-breakpoint
-- Preserve both legacy selections. The AA XP bank and fractional carry are untouched.
UPDATE students SET cross_class_abilities=jsonb_build_array(cross_class_ability_1,cross_class_ability_2);
--> statement-breakpoint
-- Rolling upgrades/rollback may still write the two legacy columns. Keep them coherent
-- with the ordered list, without dropping purchased extra-slot assignments.
CREATE FUNCTION sync_cross_class_abilities() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.cross_class_abilities IS NOT DISTINCT FROM OLD.cross_class_abilities
    AND (NEW.cross_class_ability_1 IS DISTINCT FROM OLD.cross_class_ability_1 OR NEW.cross_class_ability_2 IS DISTINCT FROM OLD.cross_class_ability_2) THEN
  NEW.cross_class_abilities := jsonb_build_array(NEW.cross_class_ability_1,NEW.cross_class_ability_2)
    || COALESCE((SELECT jsonb_agg(value ORDER BY ord) FROM jsonb_array_elements(COALESCE(OLD.cross_class_abilities,'[]')) WITH ORDINALITY e(value,ord) WHERE ord>2),'[]'::jsonb);
 ELSIF NEW.cross_class_abilities IS NOT NULL THEN
  NEW.cross_class_ability_1 := NEW.cross_class_abilities->>0;
  NEW.cross_class_ability_2 := NEW.cross_class_abilities->>1;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER students_cross_class_sync BEFORE INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION sync_cross_class_abilities();
--> statement-breakpoint
-- Prices and exchange rate are supplied only by the authenticated service's shared
-- catalog, never by the client. A single row lock serializes awards and purchases.
CREATE FUNCTION purchase_aa(student_id_arg uuid, request_id_arg uuid, upgrade_arg text,
 rank_arg integer, cost_arg integer, version_arg integer, xp_unit_arg integer, payload_arg jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
 learner students%ROWTYPE;
 previous aa_purchases%ROWTYPE;
 avatar student_avatars%ROWTYPE;
 model avatar_models%ROWTYPE;
 selected jsonb;
 result jsonb;
 changed boolean := true;
 price integer := cost_arg;
 next_revision integer;
 fittings jsonb;
BEGIN
 SELECT * INTO learner FROM students WHERE id=student_id_arg FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','Student not found','status',404); END IF;
 SELECT * INTO previous FROM aa_purchases WHERE student_id=student_id_arg AND request_id=request_id_arg;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM payload_arg THEN
   RETURN jsonb_build_object('error','Request ID already used for a different purchase','status',409);
  END IF;
  RETURN previous.receipt;
 END IF;
 IF xp_unit_arg<=0 OR cost_arg<=0 OR rank_arg<1 OR version_arg<1 THEN
  RETURN jsonb_build_object('error','Invalid catalog entry','status',400);
 END IF;
 IF upgrade_arg='recustomization' THEN
  IF learner.aa_revision<>(payload_arg->>'revision')::integer THEN
   RETURN jsonb_build_object('error','Your character changed. Refresh before saving.','status',409);
  END IF;
  SELECT * INTO avatar FROM student_avatars WHERE student_id=student_id_arg;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Create your initial appearance first','status',409); END IF;
  selected := payload_arg->'appearance';
  SELECT * INTO model FROM avatar_models WHERE id=selected->>'modelId' AND status IN ('concept','production');
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Avatar model unavailable','status',400); END IF;
  changed := COALESCE(learner.character_name,learner.nickname) IS DISTINCT FROM payload_arg->>'characterName'
   OR avatar.model_id IS DISTINCT FROM selected->>'modelId'
   OR avatar.hair_color_id IS DISTINCT FROM selected->>'hairColorId'
   OR avatar.eye_color_id IS DISTINCT FROM selected->>'eyeColorId'
   OR avatar.skin_color_id IS DISTINCT FROM selected->>'skinColorId';
  IF NOT changed THEN price := 0; END IF;
 ELSIF COALESCE((learner.aa_ranks->>upgrade_arg)::integer,0)<>rank_arg-1 THEN
  RETURN jsonb_build_object('error','Rank changed. Refresh before purchasing.','status',409);
 END IF;
 IF learner.aa_experience/xp_unit_arg - learner.aa_points_spent < price THEN
  RETURN jsonb_build_object('error','Not enough available AA points','status',409);
 END IF;
 next_revision := learner.aa_revision + CASE WHEN changed THEN 1 ELSE 0 END;
 IF upgrade_arg='recustomization' AND changed THEN
  -- Model-specific render attachments are reattached only if the new model has a fit.
  -- Gameplay equipment and permanent inventory are never changed by recustomization.
  IF avatar.model_id<>model.id THEN
   SELECT COALESCE(jsonb_agg(to_jsonb(e)),'[]'::jsonb) INTO fittings FROM avatar_equipped_items e WHERE avatar_id=avatar.id;
   DELETE FROM avatar_equipped_items WHERE avatar_id=avatar.id;
  END IF;
  UPDATE student_avatars SET model_id=model.id,
   hair_palette_id=model.hair_palette_id, hair_color_id=selected->>'hairColorId',
   eye_palette_id=model.eye_palette_id, eye_color_id=selected->>'eyeColorId',
   skin_palette_id=model.skin_palette_id, skin_color_id=selected->>'skinColorId', updated_at=now()
   WHERE student_id=student_id_arg;
  IF fittings IS NOT NULL THEN
   INSERT INTO avatar_equipped_items(avatar_id,model_id,slot_id,equipment_id)
   SELECT avatar.id,model.id,e->>'slot_id',e->>'equipment_id' FROM jsonb_array_elements(fittings) e
   WHERE EXISTS(SELECT 1 FROM avatar_equipment_fits f WHERE f.model_id=model.id AND f.slot_id=e->>'slot_id' AND f.equipment_id=e->>'equipment_id');
  END IF;
  UPDATE students SET character_name=payload_arg->>'characterName',
   gender=CASE WHEN model.id='human-female-v1' THEN 'B' ELSE 'A' END,
   loadout_revision=loadout_revision+1 WHERE id=student_id_arg;
 END IF;
 UPDATE students SET aa_points_spent=aa_points_spent+price, aa_revision=next_revision,
  aa_ranks=CASE WHEN upgrade_arg='recustomization' THEN aa_ranks ELSE jsonb_set(aa_ranks,ARRAY[upgrade_arg],to_jsonb(rank_arg)) END
  WHERE id=student_id_arg;
 result := jsonb_build_object('requestId',request_id_arg,'upgradeId',upgrade_arg,'rank',rank_arg,'cost',price,'revision',next_revision);
 INSERT INTO aa_purchases(student_id,request_id,upgrade_id,rank,cost,catalog_version,payload,receipt)
 VALUES(student_id_arg,request_id_arg,upgrade_arg,rank_arg,price,version_arg,payload_arg,result);
 RETURN result;
END;
$$;

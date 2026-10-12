import { z } from "zod";
import { enemySwarmSchema } from "../combat/swarm";
import { enemyAISchema, ENEMY_TYPES, validEnemyAI } from "../combat/enemy-ai";
import { equipmentIdSchema } from "../equipment-id";

export const questionSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(["multiple_choice", "true_false", "short_answer"]),
  question: z.string().min(1).max(20_000),
  options: z.array(z.string().max(5_000)).max(20).optional(),
  correctAnswer: z.string().min(1).max(5_000),
  timeLimit: z.number().int().min(5).max(300),
});

export const enemySchema = z.object({
  enemyType: z.enum(ENEMY_TYPES).optional(),
  ai: enemyAISchema.optional(),
  quantity:z.number().int().min(1).max(60).optional(),
  swarm:enemySwarmSchema.optional(),
  wave:z.number().int().min(1).max(20).optional(),
  species:z.enum(["goblin","other"]).optional(),
  role:z.enum(["trash","normal","leader","boss"]).optional(),
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  image: z.string().max(2_000),
  difficultyMultiplier: z.number().min(1).max(100).default(10),
}).refine(validEnemyAI, "Invalid enemy AI rules");

export const insertFightSchema = z.object({
  encounterTier:z.number().int().min(1).max(4).nullable().optional(),
  teacherId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  guildCode: z.string().max(100).optional().nullable(),
  questions: z.array(questionSchema).min(1).max(1_000),
  enemies: z.array(enemySchema).min(1).max(100),
  baseXP: z.number().int().min(1).max(100).default(10),
  baseEnemyDamage: z.number().int().min(1).max(10).default(1),
  enemyDisplayMode: z
    .enum(["simultaneous", "consecutive"])
    .default("consecutive"),
  lootTable: z
    .array(z.object({ itemId: equipmentIdSchema }))
    .max(500)
    .default([]),
  randomizeQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(true),
}).superRefine((fight,ctx)=>{
  if(new Set(fight.enemies.map(e=>e.id)).size!==fight.enemies.length || fight.enemies.reduce((n,e)=>n+(e.quantity||1),0)>120)
    ctx.addIssue({code:'custom',path:['enemies'],message:'Use unique groups and at most 120 enemies per fight.'});
  // Quantity-authored groups receive the existing normal-role default.
  if(fight.encounterTier&&!fight.enemies.some(e=>e.quantity!==undefined || e.swarm)&&fight.enemies.some(e=>!e.role))
    ctx.addIssue({code:'custom',path:['enemies'],message:'Choose enemy roles for tiered fights.'});
});


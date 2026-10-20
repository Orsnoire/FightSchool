import { z } from 'zod';
import { ALL_CHARACTER_CLASSES, type CharacterClass } from '../schema';
import { EQUIPMENT_SLOTS } from '../equipment-slots';
import { MAX_CAMPAIGN_PATH } from '../campaign/movement';
export const campaignCreate = z.object({
  name: z.string().trim().min(1).max(100), guildId: z.string().uuid(), fightId: z.string().uuid(),
  dungeonName: z.string().trim().min(1).max(100),
  gates: z.array(z.object({ name: z.string().trim().min(1).max(50), open: z.boolean() })).max(3),
}).strict();
export const campaignGateUpdate = z.object({ revision: z.number().int().nonnegative(), gates: z.array(z.object({ id: z.string().uuid(), open: z.boolean() })).max(3) }).strict();
export const campaignAction = z.object({
  commandId: z.string().uuid(), revision: z.number().int().nonnegative(),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('move'), dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1) }).strict(),
    z.object({ type: z.literal('move_path'), steps: z.array(z.object({ dx: z.number().int().min(-1).max(1), dy: z.number().int().min(-1).max(1) }).strict()).min(1).max(MAX_CAMPAIGN_PATH) }).strict(),
    z.object({ type: z.literal('equip'), slot: z.enum(EQUIPMENT_SLOTS), itemId: z.string().min(1).max(100).nullable() }).strict(),
    z.object({ type: z.literal('enter') }).strict(), z.object({ type: z.literal('exit') }).strict(),
    z.object({ type: z.literal('quest'), gateId: z.string().uuid() }).strict(),
    z.object({ type: z.literal('heal'), ability: z.string().max(60) }).strict(),
    z.object({ type: z.literal('rest') }).strict(), z.object({ type: z.literal('return_to_town') }).strict(),
    z.object({ type: z.literal('job'), job: z.enum(ALL_CHARACTER_CLASSES as [CharacterClass, ...CharacterClass[]]) }).strict(),
    z.object({ type: z.literal('buy'), shop: z.enum(['weapons', 'armor']), itemId: z.string().min(1).max(100) }).strict(),
    z.object({ type: z.literal('encounter') }).strict(),
  ]),
}).strict();

import { drawQuizQuestions } from "../../shared/math/templates/pascal";
import { instanceLoot } from "../../shared/combat/instance-loot";
import { deterministicShuffle } from "./random";
import { initialCombatState } from "./encounter-setup";
import type { FightRecord } from "../db/schema";
import type { CombatSnapshot } from "../../shared/combat/model";
import type { PlaybackGate } from "./playback-gate";

/** Durable wire shape: retain optional fields and adapters for existing saved rooms. */
export interface StoredRoom {
  fight: FightRecord;
  snapshot: CombatSnapshot;
  receipts: string[];
  releaseWindows?: string[];
  results?: unknown[];
  resultsPersisted?: boolean;
  playbackGate?: PlaybackGate;
  reportingSignature?: string;
  reportingPending?: boolean;
  evidenceSignature?: string;
  evidencePending?: boolean;
  removals?: Record<string, { nickname: string; blocked: boolean; requestedAt?: number; deniedAt?: number }>;
}

export function createCombatRoom(source: FightRecord, sessionId: string): StoredRoom {
  const generated = source.questions.some(q => q.quizTemplate)
    ? drawQuizQuestions(source.questions, crypto.randomUUID()) : source.questions;
  const fight = { ...source,
    questions: source.randomizeQuestions ? deterministicShuffle(generated, sessionId) : generated,
    lootTable: source.campaignContext ? source.lootTable : instanceLoot(source.lootTable, sessionId),
  };
  return { fight, snapshot: initialCombatState(sessionId, fight), receipts: [] };
}

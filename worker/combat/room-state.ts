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

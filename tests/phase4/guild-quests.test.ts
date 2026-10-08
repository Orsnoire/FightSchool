import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as s from "../../worker/db/schema";
import {
  questInput,
  questProgress,
  effectiveLevels,
  type QuestContext,
} from "../../shared/quests";
import { getUnlockedJobs } from "../../shared/jobSystem";
import {
  evaluateQuests,
  seedPersonalQuests,
} from "../../worker/progression/quests";
import { questionKey } from "../../worker/progression/question-key";
import {
  combatProfile,
  recordQuestEvidence,
  persistCombatResults,
} from "../../worker/db/game-repository";
import { initialCombatState, addStudent } from "../../worker/combat/engine";
import { publicSnapshot } from "../../worker/combat/session-object";
import { handleGame } from "../../worker/routes/game";
import { issueSession } from "../../worker/auth/session";
import { fight, student } from "./fixtures";
const context: QuestContext = {
  levels: { warrior: 8 },
  unlockedJobs: [],
  limitTier: 1,
  guildLevel: 1,
  members: [{ levels: { warrior: 4 } }, { levels: { wizard: 3 } }],
  totals: { correct: 12, damage: 8, healing: 2 },
  evidence: [],
  bankKeys: ["a", "b"],
};
const evidence = (overrides: any = {}) => ({
  studentId: student().id,
  sessionId: "SESSION1",
  fightId: fight.id,
  isSoloMode: true,
  victory: false,
  answered: 2,
  correct: 1,
  correctKeys: ["a"],
  bankKeys: ["a", "b"],
  updatedAt: Date.now(),
  ...overrides,
});
test("quest goals distinguish attempts, clears, session accuracy and cumulative mastery", () => {
  const x = {
    ...context,
    evidence: [
      evidence(),
      evidence({ sessionId: "SESSION2", correctKeys: ["b"] }),
    ],
  };
  assert.equal(
    questProgress({ type: "master_bank", fightId: fight.id }, x).complete,
    true,
  );
  assert.equal(questProgress({ type: "perfect_clear" }, x).complete, false);
  assert.equal(
    questProgress({ type: "solo_fights", targetAmount: 2 }, x).current,
    0,
  );
  assert.equal(
    questProgress({ type: "try_solo", fightId: fight.id }, x).complete,
    true,
  );
  assert.equal(
    questProgress(
      { type: "try_solo", fightId: fight.id },
      { ...x, evidence: [evidence({ answered: 0 })] },
    ).complete,
    false,
  );
  assert.equal(
    questProgress(
      { type: "fight_accuracy", fightId: fight.id, accuracy: 80 },
      {
        ...x,
        evidence: [evidence({ victory: true, answered: 5, correct: 4 })],
      },
    ).complete,
    true,
  );
  assert.equal(
    questProgress(
      { type: "perfect_clear" },
      {
        ...x,
        evidence: [evidence({ victory: true, answered: 2, correct: 2 })],
      },
    ).complete,
    true,
  );
  assert.equal(
    questProgress(
      { type: "master_bank", fightId: fight.id },
      { ...x, bankKeys: ["a", "changed-b"] },
    ).complete,
    false,
  );
  assert.equal(
    questProgress(
      { type: "master_bank", fightId: fight.id },
      { ...x, bankKeys: [] },
    ).complete,
    false,
  );
  assert.equal(
    questProgress({ type: "class_at_cap", percentage: 50 }, x).complete,
    true,
  );
  assert.equal(
    questProgress({ type: "class_at_cap", percentage: 51 }, x).complete,
    false,
  );
  assert.equal(
    questProgress(
      { type: "class_at_cap", percentage: 1 },
      { ...x, members: [] },
    ).complete,
    false,
  );
  assert.equal(
    questProgress({ type: "unlock_license", targetJob: "warrior" }, x).complete,
    true,
  );
  assert.equal(
    questProgress({ type: "unlock_job", targetJob: "ranger" }, x).complete,
    false,
  );
  assert.equal(
    questProgress(
      { type: "unlock_job", targetJob: "ranger" },
      { ...x, unlockedJobs: ["ranger"] },
    ).complete,
    true,
  );
  assert.deepEqual(effectiveLevels({ warrior: 15, wizard: 3 }, 1), {
    warrior: 4,
    wizard: 3,
  });
});
test("quest validation rejects incomplete and incompatible rewards and keeps job conditions separate", () => {
  const base = {
    title: "Limit break",
    description: "Complete it",
    questType: "guild",
    criteria: { type: "class_at_cap", percentage: 75 },
    rewards: { limitBreak: 2 },
  };
  assert.ok(questInput.safeParse(base).success);
  assert.equal(
    questInput.safeParse({ ...base, questType: "weekly" }).success,
    false,
  );
  assert.equal(
    questInput.safeParse({
      ...base,
      questType: "personal",
      studentId: student().id,
    }).success,
    false,
  );
  assert.equal(
    questInput.safeParse({
      ...base,
      criteria: { type: "fight_accuracy", accuracy: 80 },
    }).success,
    false,
  );
  assert.equal(
    questInput.safeParse({ ...base, rewards: { unlockJob: "made_up" } })
      .success,
    false,
  );
  assert.equal(
    questInput.safeParse({ ...base, criteria: { type: "unlock_job" } }).success,
    false,
  );
  assert.ok(
    questInput.safeParse({
      ...base,
      criteria: { type: "unlock_job", targetJob: "ranger" },
      rewards: { unlockJob: "priest" },
    }).success,
  );
});
test("question keys survive shuffles, change on edits and never appear in public combat state", () => {
  const q = { ...fight.questions[0], options: ["4", "3"] };
  assert.equal(questionKey(q), questionKey({ ...q, options: ["3", "4"] }));
  assert.notEqual(questionKey(q), questionKey({ ...q, correctAnswer: "3" }));
  let state = addStudent(initialCombatState("QUEST1", fight), student());
  state.players[student().id].correctQuestionKeys = ["private"];
  state.pendingPlayers = {
    pending: { ...state.players[student().id], studentId: "pending" },
  };
  assert.equal(
    JSON.stringify(publicSnapshot(state)).includes("private"),
    false,
  );
});

test("database quest rewards, limit snapshots, overflow AA and mastery are scoped and exactly once", async () => {
  const pg = new PGlite();
  try {
    const journal = JSON.parse(
      readFileSync("migrations/cloudflare/meta/_journal.json", "utf8"),
    );
    for (const { tag } of journal.entries)
      await pg.exec(readFileSync(`migrations/cloudflare/${tag}.sql`, "utf8"));
    const db = drizzle(pg, { schema: s });
    await db
      .insert(s.teachers)
      .values({
        id: fight.teacherId,
        firstName: "Test",
        lastName: "Teacher",
        email: "quest@example.invalid",
        emailNormalized: "quest@example.invalid",
        passwordHash: "unused",
        guildCode: "QUEST1",
        billingAddress: "Test",
        schoolDistrict: "Test",
        school: "Test",
        subject: "Math",
        gradeLevel: "10",
      });
    await db.insert(s.students).values(student());
    const other = {
      ...student("wizard", crypto.randomUUID()),
      nickname: "other",
      nicknameNormalized: "other",
    };
    await db.insert(s.students).values(other);
    const q2 = {
      ...fight.questions[0],
      id: "q2",
      question: "3+3",
      correctAnswer: "6",
    };
    const bank = { ...fight, questions: [fight.questions[0], q2] };
    await db.insert(s.fights).values(bank);
    const [g] = await db
      .insert(s.guilds)
      .values({ teacherId: fight.teacherId, name: "A", code: "QUESTA" })
      .returning();
    const [g2] = await db
      .insert(s.guilds)
      .values({
        teacherId: fight.teacherId,
        name: "B",
        code: "QUESTB",
        limitTier: 4,
      })
      .returning();
    await db.insert(s.guildMemberships).values([
      { guildId: g.id, studentId: student().id },
      { guildId: g2.id, studentId: student().id },
    ]);
    await db.insert(s.guildFights).values([
      { guildId: g.id, fightId: fight.id },
      { guildId: g2.id, fightId: fight.id },
    ]);
    await db
      .insert(s.studentJobLevels)
      .values({
        studentId: student().id,
        jobClass: "warrior",
        level: 10,
        experience: 270,
      });
    await db
      .insert(s.liveCombatSessions)
      .values({
        sessionId: "QUEST1",
        fightId: fight.id,
        teacherId: fight.teacherId,
        soloStudentId: student().id,
        guildId: g.id,
        guildLimitTier: 1,
      });
    const [saved] = await db
      .select()
      .from(s.students)
      .where(eq(s.students.id, student().id));
    const profile = await combatProfile(db as any, saved, "QUEST1");
    assert.equal(profile.levels.warrior, 4);
    assert.equal(profile.questGuildId, g.id);
    let state = addStudent(initialCombatState("QUEST1", bank), saved, profile);
    let p = state.players[saved.id];
    p.totals.questionsAnswered = 2;
    p.totals.questionsCorrect = 1;
    p.correctQuestionKeys = [questionKey(bank.questions[0])];
    state.revision = 1;
    await recordQuestEvidence(db as any, state, bank);
    const [quest] = await db
      .insert(s.quests)
      .values({
        guildId: g.id,
        studentId: saved.id,
        questType: "personal",
        title: "Master bank",
        description: "All questions across attempts",
        criteria: { type: "master_bank", fightId: fight.id },
        rewards: { gold: 20, unlockJob: "ranger" },
      })
      .returning();
    assert.equal(
      (await evaluateQuests(db as any, g.id)).find((q) => q.id === quest.id)
        ?.isCompleted,
      false,
    );
    await db
      .insert(s.liveCombatSessions)
      .values({
        sessionId: "QUEST2",
        fightId: fight.id,
        teacherId: fight.teacherId,
        soloStudentId: saved.id,
        guildId: g.id,
        guildLimitTier: 1,
      });
    state = { ...structuredClone(state), sessionId: "QUEST2", revision: 2 };
    p = state.players[saved.id];
    p.correctQuestionKeys = [questionKey(q2)];
    await recordQuestEvidence(db as any, state, bank);
    for (let i = 0; i < 2; i++) await evaluateQuests(db as any, g.id);
    const [earned] = await db
      .select()
      .from(s.students)
      .where(eq(s.students.id, saved.id));
    assert.equal(earned.gold, 20);
    assert.deepEqual(earned.grantedJobs, ["ranger"]);
    assert.ok(getUnlockedJobs({}, earned.grantedJobs).includes("ranger"));
    const [limit] = await db
      .insert(s.quests)
      .values({
        guildId: g.id,
        questType: "guild",
        title: "Break limit",
        description: "Class at cap",
        criteria: { type: "class_at_cap", percentage: 100 },
        rewards: { limitBreak: 2 },
      })
      .returning();
    await evaluateQuests(db as any, g.id);
    assert.equal(
      (await db.select().from(s.guilds).where(eq(s.guilds.id, g.id)))[0]
        .limitTier,
      2,
    );
    assert.equal(
      (await combatProfile(db as any, earned, "QUEST1")).levels.warrior,
      4,
      "existing room retains limit snapshot",
    );
    await db
      .update(s.guilds)
      .set({ limitTier: 1 })
      .where(eq(s.guilds.id, g.id));
    await evaluateQuests(db as any, g.id);
    assert.equal(
      (await db.select().from(s.guilds).where(eq(s.guilds.id, g.id)))[0]
        .limitTier,
      1,
      "completed limit reward cannot override teacher lowering the cap",
    );
    state.currentPhase = "game_over";
    state.victory = true;
    state.completedRounds = 2;
    p.roundsParticipated = 2;
    await persistCombatResults(db as any, state, bank);
    await persistCombatResults(db as any, state, bank);
    const [after] = await db
      .select()
      .from(s.students)
      .where(eq(s.students.id, saved.id));
    assert.ok(after.aaExperience > 0);
    assert.equal(
      (
        await db
          .select()
          .from(s.studentJobLevels)
          .where(eq(s.studentJobLevels.studentId, saved.id))
      )[0].experience,
      270,
    );
    assert.equal(
      (await db.select().from(s.combatResults))[0].guildId,
      g.id,
      "never chooses the other membership",
    );
    const [foreign] = await db
      .insert(s.quests)
      .values({
        guildId: g2.id,
        studentId: saved.id,
        questType: "personal",
        title: "Other bank",
        description: "Other class",
        criteria: { type: "master_bank", fightId: fight.id },
        rewards: { gold: 100 },
      })
      .returning();
    assert.equal(
      (await evaluateQuests(db as any, g2.id)).find((q) => q.id === foreign.id)
        ?.isCompleted,
      false,
    );
    await seedPersonalQuests(db as any, saved.id, g.id);
    await evaluateQuests(db as any, g.id);
    const gold = (
      await db.select().from(s.students).where(eq(s.students.id, saved.id))
    )[0].gold;
    await seedPersonalQuests(db as any, saved.id, g2.id);
    await evaluateQuests(db as any, g2.id);
    assert.equal(
      (await db.select().from(s.students).where(eq(s.students.id, saved.id)))[0]
        .gold,
      gold,
      "personal milestones award once across guilds",
    );
    await db
      .update(s.guilds)
      .set({ isArchived: true })
      .where(eq(s.guilds.id, g.id));
    const [archived] = await db
      .insert(s.quests)
      .values({
        guildId: g.id,
        questType: "guild",
        title: "Archived reward",
        description: "Never grant",
        criteria: { type: "manual" },
        rewards: { gold: 10000, unlockJob: "bard" },
      })
      .returning();
    await evaluateQuests(db as any, g.id, archived.id);
    assert.equal(
      (await db.select().from(s.students).where(eq(s.students.id, saved.id)))[0]
        .gold,
      gold,
    );
    // Real authenticated endpoints reject cross-guild student assignment and foreign fight criteria.
    const sessions = new Map();
    const repo: any = {
      createSession: async (r: any) => sessions.set(r.tokenHash, r),
      findActiveSession: async (k: string) => sessions.get(k) || null,
    };
    const config = {
      cookieName: "quest_session",
      secret: "test-only-secret-01234567890123456789",
      ttlSeconds: 300,
    };
    const cookie = (
      await issueSession(repo, config, "teacher", fight.teacherId)
    ).split(";")[0];
    const call = async (path: string, body: any, method = "POST") => {
      const url = new URL("https://qa.example" + path);
      return handleGame(
        new Request(url, {
          method,
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        url,
        repo,
        config,
        db as any,
      );
    };
    const base = {
      title: "Teacher goal",
      description: "Goal",
      questType: "personal",
      studentId: other.id,
      criteria: { type: "manual" },
      rewards: { gold: 1 },
    };
    assert.equal(
      (await call(`/api/guilds/${g2.id}/quests`, base))?.status,
      400,
    );
    assert.equal(
      (
        await call(`/api/guilds/${g2.id}/quests`, {
          ...base,
          studentId: saved.id,
          criteria: {
            type: "fight_accuracy",
            fightId: crypto.randomUUID(),
            accuracy: 80,
          },
        })
      )?.status,
      400,
    );
    assert.equal(
      (await call(`/api/guilds/${g.id}/progression`, { limitTier: 4 }, "PATCH"))
        ?.status,
      409,
    );
    assert.equal(
      (
        await call(
          `/api/guilds/${g2.id}/progression`,
          { limitTier: 2 },
          "PATCH",
        )
      )?.status,
      200,
    );
  } finally {
    await pg.close();
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { eq, and, sql } from "drizzle-orm";
import {
  dataCostFixture,
  fixtureId,
  summarizeCalls,
} from "../support/data-costs.ts";
import { baselineQuests } from "../support/baseline-quests.ts";
import {
  evaluateQuests,
  readQuestViews,
  evaluateStudentLevels,
  seedPersonalQuests,
  evaluateFightQuests,
} from "../../worker/progression/quests.ts";
import {
  recordQuestEvidence,
  persistCombatResults,
} from "../../worker/db/game-repository.ts";
import {
  combatHistory,
  studentCombatSummary,
} from "../../worker/db/combat-history.ts";
import { initialCombatState, addStudent } from "../../worker/combat/engine.ts";
import { questionKey } from "../../worker/progression/question-key.ts";
import { WEEK_MS } from "../../worker/progression/quest-data.ts";
import { roomFixture } from "../support/room-costs.ts";
import { issueSession } from "../../worker/auth/session.ts";
import { handleGame } from "../../worker/routes/game.ts";
import * as s from "../../worker/db/schema.ts";

async function auth(f: Awaited<ReturnType<typeof dataCostFixture>>) {
  const sessions = new Map();
  const repo: any = {
    createSession: async (r: any) => sessions.set(r.tokenHash, r),
    findActiveSession: async (k: string) => sessions.get(k) || null,
    findFightById: async (id: string) =>
      (await f.db.select().from(s.fights).where(eq(s.fights.id, id)))[0],
    findTeacherById: async (id: string) =>
      (await f.db.select().from(s.teachers).where(eq(s.teachers.id, id)))[0],
  };
  const config = {
    cookieName: "c06",
    secret: "isolated-c06-test-secret-not-deployed",
    ttlSeconds: 300,
  };
  const cookie = async (role: "student" | "teacher", id: string) =>
    (await issueSession(repo, config, role, id)).split(";")[0];
  const student = await cookie("student", f.students[0].id),
    teacher = await cookie("teacher", f.bank.teacherId);
  return {
    student,
    teacher,
    call: async (path: string, auth = student, body?: any) => {
      const url = new URL("https://qa.example" + path);
      return (await handleGame(
        new Request(url, {
          method: body ? "POST" : "GET",
          headers: { Cookie: auth, "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
        url,
        repo,
        config,
        f.db,
      ))!;
    },
  };
}

test("populated guild: baseline-equivalent progression, bounded work and read-only HTTP views", async (t) => {
  const f = await dataCostFixture(30, 100);
  try {
    await t.test(
      "2051 seeded quests match the pinned baseline without history payloads",
      async () => {
        const old = await baselineQuests();
        await f.pg.exec("BEGIN");
        const expected = await old(f.db, f.guildId);
        await f.pg.exec("ROLLBACK");
        await f.pg.exec("BEGIN");
        f.calls.length = 0;
        const actual = await evaluateQuests(f.db, f.guildId);
        const cost = summarizeCalls(f.calls);
        await f.pg.exec("ROLLBACK");
        const shape = (rows: any[]) =>
          rows
            .map((q) => ({
              id: q.id,
              isCompleted: q.isCompleted,
              progress: q.progress,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
        assert.deepEqual(shape(actual), shape(expected));
        assert.equal(actual.length, 2051);
        assert.ok(cost.bytes < 1_800_000, JSON.stringify(cost));
        assert.ok(
          !f.calls.some((c) =>
            /SELECT \* FROM quest_fight_evidence/i.test(c.sql),
          ),
        );
      },
    );
    await t.test(
      "events select affected quests; SQL reads and payload do not include peers or fight banks",
      async () => {
        await f.pg.exec("BEGIN");
        f.calls.length = 0;
        const result = await evaluateQuests(f.db, f.guildId, undefined, {
          kind: "results",
          studentIds: [f.students[0].id],
          fightId: f.bank.id,
        });
        assert.equal(result.length, 11); // personal level milestones have their own character-wide event
        assert.ok(summarizeCalls(f.calls).bytes < 100_000);
        assert.ok(!f.calls.some((c) => /from "fights"/i.test(c.sql)));
        const levels = await evaluateQuests(f.db, f.guildId, undefined, {
          kind: "levels",
          studentIds: [f.students[0].id],
        });
        assert.equal(levels.length, 68);
        assert.ok(levels.every((q) => q.studentId === f.students[0].id));
        await f.pg.exec("ROLLBACK");
      },
    );
    await t.test(
      "quest/shop GETs are read-only and student quest selection is scoped in SQL",
      async () => {
        const a = await auth(f);
        f.calls.length = 0;
        const response = await a.call(`/api/guilds/${f.guildId}/quests`);
        assert.equal(response.status, 200);
        const rows = (await response.json()) as any[];
        assert.equal(rows.length, 79);
        assert.ok(
          rows.every((q) => !q.studentId || q.studentId === f.students[0].id),
        );
        assert.equal((await a.call("/api/equipment-items/shop")).status, 200);
        assert.equal(
          (await a.call(`/api/student/${f.students[0].id}/quests`)).status,
          200,
        );
        assert.ok(
          f.calls.every(
            (c) =>
              !/(insert into|update |award_quest|delete from)/i.test(c.sql),
          ),
        );
        assert.equal(
          (
            await a.call(
              `/api/guilds/${f.guildId}/quests/reconcile`,
              a.student,
              {},
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await a.call(
              `/api/guilds/${f.guildId}/quests/reconcile`,
              a.teacher,
              {},
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await a.call(
              `/api/combat-stats/student/${f.students[1].id}/summary`,
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      "keyset history is bounded and stable at equal timestamps; summaries remain all-time",
      async () => {
        const ids = new Set<string>();
        let cursor: string | null = null;
        do {
          const page = await combatHistory(
            f.db,
            { studentId: f.students[0].id },
            new URLSearchParams({
              limit: "17",
              ...(cursor ? { before: cursor } : {}),
            }),
          );
          assert.ok(page.rows.length <= 17);
          for (const r of page.rows) {
            assert.ok(!ids.has(r.id));
            ids.add(r.id);
          }
          cursor = page.nextCursor;
        } while (cursor);
        assert.equal(ids.size, 200);
        assert.equal(
          (await studentCombatSummary(f.db, f.students[0].id)).totalFights,
          200,
        );
        const plan = (
          await f.pg.query(
            "EXPLAIN (FORMAT JSON) SELECT * FROM combat_results WHERE student_id=$1 ORDER BY completed_at DESC,id DESC LIMIT 50",
            [f.students[0].id],
          )
        ).rows;
        assert.ok(
          !JSON.stringify(plan).includes('"Node Type":"Sort"'),
          "history index must satisfy the exact query ordering",
        );
        const a = await auth(f);
        const response = await a.call(
          `/api/combat-stats/student/${f.students[0].id}?limit=17`,
        );
        assert.equal(((await response.json()) as any[]).length, 17);
        assert.ok(response.headers.get("X-Next-Cursor"));
        assert.equal(
          (
            await a.call(
              `/api/combat-stats/student/${f.students[0].id}?limit=100000`,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await a.call(
              `/api/combat-stats/student/${f.students[0].id}?before=bad`,
            )
          ).status,
          400,
        );
        assert.equal(
          (await a.call(`/api/combat-stats/fight/${f.bank.id}`, a.student))
            .status,
          403,
        );
        const teacherPage = await a.call(
          `/api/combat-stats/class/C06ONE?limit=3`,
          a.teacher,
        );
        assert.equal(((await teacherPage.json()) as any[]).length, 3);
      },
    );
  } finally {
    await f.pg.close();
  }
});

test("evidence semantics: legacy fallback, weighted class accuracy, weeks, edits and departed players", async () => {
  const f = await dataCostFixture(3, 2);
  try {
    const now = Date.now(),
      week = Math.floor(now / WEEK_MS);
    const session = "C06-CURRENT";
    await f.db
      .insert(s.liveCombatSessions)
      .values({
        sessionId: session,
        fightId: f.bank.id,
        teacherId: f.bank.teacherId,
        guildId: f.guildId,
      });
    let state = initialCombatState(session, f.bank);
    for (const st of f.students)
      state = addStudent(state, st, {
        questGuildId: f.guildId,
        levels: { warrior: 1 },
        limitTier: 4,
      });
    state.victory = true;
    state.revision = 5;
    const players = Object.values(state.players);
    players[0].totals.questionsAnswered = 1;
    players[0].totals.questionsCorrect = 1;
    players[1].totals.questionsAnswered = 9;
    players[1].totals.questionsCorrect = 1;
    players[2].totals.questionsAnswered = 2;
    players[2].totals.questionsCorrect = 2;
    players[2].correctQuestionKeys = f.bank.questions.map(questionKey);
    state.departedPlayers = { [players[2].studentId]: players[2] };
    delete state.players[players[2].studentId];
    await recordQuestEvidence(f.db, state, f.bank, false);
    // A legacy result with different totals must never override durable evidence,
    // even when that evidence later falls outside the selected weekly window.
    await f.db
      .insert(s.combatResults)
      .values({
        sessionId: session,
        studentId: players[0].studentId,
        fightId: f.bank.id,
        guildId: f.guildId,
        characterClass: "warrior",
        victory: true,
        survived: true,
        totals: {
          ...players[0].totals,
          questionsAnswered: 20,
          questionsCorrect: 20,
        },
        xpEarned: 0,
        goldReward: 0,
        completedAt: now,
      });
    const criteria = [
      {
        type: "fight_accuracy",
        fightId: f.bank.id,
        accuracy: 70,
        performanceType: "class_average",
      },
      { type: "master_bank", fightId: f.bank.id },
      { type: "total_correct_answers", targetAmount: 1 },
      { type: "perfect_clear", mode: "solo" },
      { type: "solo_fights", mode: "teacher", targetAmount: 1 },
      {
        type: "custom",
        criteria1: {
          fightId: f.bank.id,
          performanceType: "class_average",
          accuracy: 30,
        },
      },
    ];
    await f.db
      .insert(s.quests)
      .values(
        criteria.map((c, i) => ({
          guildId: f.guildId,
          title: `Goal ${i}`,
          description: "Fixture",
          questType: "weekly",
          criteria: c,
          rewards: {},
        })),
      );
    const old = await baselineQuests();
    await f.pg.exec("BEGIN");
    const expected = await old(f.db, f.guildId);
    await f.pg.exec("ROLLBACK");
    await f.pg.exec("BEGIN");
    const actual = await evaluateQuests(f.db, f.guildId);
    await f.pg.exec("ROLLBACK");
    for (const q of actual) {
      const previous = expected.find((p: any) => p.id === q.id);
      assert.deepEqual(q.progress, previous.progress, q.title);
    }
    assert.equal(
      actual.find((q) => q.title === "Goal 0")!.progress.current,
      20,
      "departed victory does not enter class average",
    );
    assert.equal(
      actual.find((q) => q.title === "Goal 1")!.progress.current,
      20,
      "departed question mastery is retained",
    );
    await f.pg.query(
      "UPDATE quest_fight_evidence SET updated_at=$1 WHERE session_id=$2",
      [(week - 1) * WEEK_MS, session],
    );
    assert.equal(
      (await readQuestViews(f.db, f.guildId)).find((q) => q.title === "Goal 1")!
        .progress.current,
      0,
    );
    await f.pg.query(
      "UPDATE quest_fight_evidence SET updated_at=$1 WHERE session_id=$2",
      [now, session],
    );
    const edited = { ...f.bank.questions[0], correctAnswer: "changed" };
    await f.db
      .update(s.fights)
      .set({ questions: [edited] })
      .where(eq(s.fights.id, f.bank.id));
    await evaluateFightQuests(f.db, f.bank.id, f.bank.teacherId);
    assert.equal(
      (await readQuestViews(f.db, f.guildId)).find((q) => q.title === "Goal 1")!
        .isCompleted,
      false,
      "edited answers cannot use old mastery",
    );
    const older = structuredClone(state);
    older.revision = 4;
    older.players[players[0].studentId].totals.questionsCorrect = 0;
    await recordQuestEvidence(f.db, older, f.bank, false);
    const rows = (
      await f.pg.query(
        "SELECT correct FROM quest_fight_evidence WHERE session_id=$1 AND student_id=$2",
        [session, players[0].studentId],
      )
    ).rows;
    assert.equal(
      rows[0].correct,
      1,
      "older room revision cannot replace durable evidence",
    );
  } finally {
    await f.pg.close();
  }
});

test("fault/retry and two rooms keep evidence, combat awards and cross-guild milestones exactly once", async () => {
  const f = await dataCostFixture(2, 0);
  try {
    const [quest] = await f.db
      .insert(s.quests)
      .values({
        guildId: f.guildId,
        studentId: f.students[0].id,
        questType: "personal",
        title: "Try it",
        description: "Fixture",
        criteria: { type: "try_solo", fightId: f.bank.id },
        rewards: { gold: 7, unlockJob: "ranger" },
      })
      .returning();
    const make = async (sessionId: string, guildId = f.guildId) => {
      await f.db
        .insert(s.liveCombatSessions)
        .values({
          sessionId,
          fightId: f.bank.id,
          teacherId: f.bank.teacherId,
          guildId,
          soloStudentId: f.students[0].id,
          guildLimitTier: 4,
        });
      const state = addStudent(
        initialCombatState(sessionId, f.bank),
        f.students[0],
        { questGuildId: guildId, levels: { warrior: 1 }, limitTier: 4 },
      );
      const p = state.players[f.students[0].id];
      p.totals.questionsAnswered = 1;
      p.totals.questionsCorrect = 1;
      p.correctQuestionKeys = [questionKey(f.bank.questions[0])];
      p.roundsParticipated = 1;
      state.revision = 2;
      state.completedRounds = 1;
      return state;
    };
    const first = await make("C06-RETRY");
    const query = f.pg.query.bind(f.pg);
    let fail = true;
    (f.pg as any).query = async (text: string, params: any[], options: any) => {
      if (fail && text.includes("award_quest_batch")) {
        fail = false;
        throw Error("injected failure after evidence commit");
      }
      return query(text, params, options);
    };
    await assert.rejects(
      recordQuestEvidence(f.db, first, f.bank),
      /injected|Failed query/,
    );
    assert.equal(
      (await f.pg.query("SELECT count(*)::int AS n FROM quest_fight_evidence"))
        .rows[0].n,
      1,
    );
    await recordQuestEvidence(f.db, first, f.bank);
    await recordQuestEvidence(f.db, first, f.bank);
    assert.equal(
      (
        await f.db
          .select()
          .from(s.questCompletions)
          .where(eq(s.questCompletions.questId, quest.id))
      ).length,
      1,
    );
    const afterEvidence = (
      await f.db
        .select()
        .from(s.students)
        .where(eq(s.students.id, f.students[0].id))
    )[0];
    assert.ok(afterEvidence.grantedJobs.includes("ranger"));
    await seedPersonalQuests(f.db, f.students[0].id, f.otherGuildId);
    await f.db
      .update(s.studentJobLevels)
      .set({ level: 8, experience: 168 })
      .where(eq(s.studentJobLevels.studentId, f.students[0].id));
    // Character milestones resolve in both memberships, but the global receipt pays once.
    await Promise.all([
      evaluateStudentLevels(f.db, [f.students[0].id]),
      evaluateStudentLevels(f.db, [f.students[0].id]),
    ]);
    const before = (
      await f.db
        .select()
        .from(s.students)
        .where(eq(s.students.id, f.students[0].id))
    )[0];
    const second = await make("C06-OTHER", f.otherGuildId);
    for (const state of [first, second]) {
      state.currentPhase = "game_over";
      state.victory = true;
      state.revision++;
    }
    // Fail after the atomic combat write has committed, then retry both rooms.
    fail = true;
    (f.pg as any).query = async (text: string, params: any[], options: any) => {
      const result = await query(text, params, options);
      if (fail && text.includes("award_combat_results_with_stamina")) {
        fail = false;
        throw Error("lost SQL acknowledgement");
      }
      return result;
    };
    await assert.rejects(
      persistCombatResults(f.db, first, f.bank),
      /acknowledgement|Failed query/,
    );
    await Promise.all([
      persistCombatResults(f.db, first, f.bank),
      persistCombatResults(f.db, second, f.bank),
    ]);
    const awarded = (
      await f.db
        .select()
        .from(s.students)
        .where(eq(s.students.id, f.students[0].id))
    )[0];
    await Promise.all([
      persistCombatResults(f.db, first, f.bank),
      persistCombatResults(f.db, second, f.bank),
    ]);
    assert.deepEqual(
      (
        await f.db
          .select()
          .from(s.students)
          .where(eq(s.students.id, f.students[0].id))
      )[0],
      awarded,
    );
    assert.equal(awarded.dailyCombats, 2);
    assert.ok(awarded.gold >= before.gold);
    assert.equal((await f.db.select().from(s.combatResults)).length, 2);
    assert.equal(
      (
        await f.db
          .select()
          .from(s.personalQuestReceipts)
          .where(eq(s.personalQuestReceipts.studentId, f.students[0].id))
      ).filter((r) => r.milestone === "Warrior level 8").length,
      1,
    );
    // A failed reward statement rolls back all of its changes.
    const [bad] = await f.db
      .insert(s.quests)
      .values({
        guildId: f.guildId,
        questType: "guild",
        title: "Atomic fault",
        description: "Fixture",
        criteria: { type: "manual" },
        rewards: { gold: -1000000, guildXP: 100 },
      })
      .returning();
    const guildBefore = (
      await f.db.select().from(s.guilds).where(eq(s.guilds.id, f.guildId))
    )[0];
    await assert.rejects(
      evaluateQuests(f.db, f.guildId, bad.id, {
        kind: "quests",
        questIds: [bad.id],
      }),
    );
    assert.deepEqual(
      (await f.db.select().from(s.guilds).where(eq(s.guilds.id, f.guildId)))[0],
      guildBefore,
    );
    assert.equal(
      (
        await f.db
          .select()
          .from(s.questCompletions)
          .where(eq(s.questCompletions.questId, bad.id))
      ).length,
      0,
    );
  } finally {
    await f.pg.close();
  }
});

for (const count of [30, 60])
  test(`${count}-answer burst coalesces pending evidence retries and restores them from durable state`, async (t) => {
    t.mock.method(console, "log", () => {});
    const f = roomFixture(count);
    let writes = 0,
      fail = true;
    f.room.snapshot.round = 2;
    f.room.evidencePending = true;
    for (const p of Object.values(f.room.snapshot.players) as any[]) {
      p.questGuildId = fixtureId(1);
      p.totals.questionsAnswered = 1;
      p.totals.questionsCorrect = 1;
    }
    f.save(f.room);
    f.repository.recordQuestEvidence = async () => {
      writes++;
      if (fail) throw Error("database offline");
    };
    for (let i = 0; i < count; i++)
      await f.obj.webSocketMessage(
        f.players[i],
        JSON.stringify({
          type: "answer",
          commandId: `c06-answer-${i}`,
          round: f.room.snapshot.round,
          questionId: "q1",
          answer: "4",
        }),
      );
    assert.equal(writes, 1);
    assert.equal(f.saved().evidencePending, true);
    assert.equal(f.saved().receipts.length, count);
    fail = false;
    await f.object().alarm();
    assert.equal(writes, 2);
    assert.equal(f.saved().evidencePending, false);
    assert.equal(
      f.saved().snapshot.players[f.students[0].id].totals.questionsAnswered,
      1,
    );
  });

test("C06 additive index migration preserves populated student, quest, evidence and reward rows", async () => {
  const f = await dataCostFixture(3, 3, 16);
  try {
    const tables = [
      "students",
      "guilds",
      "guild_memberships",
      "student_job_levels",
      "quests",
      "combat_results",
      "quest_fight_evidence",
      "personal_quest_receipts",
      "quest_completions",
    ];
    const snapshot = async () =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (name) => [
            name,
            (
              await f.pg.query(
                `SELECT row_to_json(t) AS row FROM ${name} t ORDER BY row_to_json(t)::text`,
              )
            ).rows,
          ]),
        ),
      );
    const before = await snapshot();
    await f.pg.exec(
      readFileSync(
        "migrations/cloudflare/0017_c06_data_cost_indexes.sql",
        "utf8",
      ),
    );
    assert.deepEqual(await snapshot(), before);
  } finally {
    await f.pg.close();
  }
});

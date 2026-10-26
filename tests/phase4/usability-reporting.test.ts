import { questionKey } from "../../worker/progression/question-key";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as s from "../../worker/db/schema";
import { fight, student } from "./fixtures";
import {
  initialCombatState,
  addStudent,
  startQuestion,
  applyAnswer,
  advancePhase,
} from "../../worker/combat/engine";
import { recordSessionReporting } from "../../worker/db/session-reporting";
import { sessionReport } from "../../worker/reporting/session-report";
import { issueSession, type SessionRecord } from "../../worker/auth/session";
import { handleGame } from "../../worker/routes/game";
import { combatProfile } from "../../worker/db/game-repository";
import { publicSnapshot } from "../../worker/combat/public-snapshot";
import type { GameDatabase } from "../../worker/db/game-repository";

test("session reports retain immutable attempts, compose filters and preserve legacy totals", async () => {
  const pg = new PGlite(),
    db = drizzle(pg, { schema: s }) as unknown as GameDatabase;
  try {
    const journal = JSON.parse(
      readFileSync(
        new URL(
          "../../migrations/cloudflare/meta/_journal.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const { tag } of journal.entries)
      await pg.exec(
        readFileSync(
          new URL(`../../migrations/cloudflare/${tag}.sql`, import.meta.url),
          "utf8",
        ),
      );
    await db.insert(s.teachers).values({
      id: fight.teacherId,
      firstName: "Test",
      lastName: "Teacher",
      email: "report@example.invalid",
      emailNormalized: "report@example.invalid",
      passwordHash: "unused",
      guildCode: "REPORT",
      billingAddress: "Test",
      schoolDistrict: "Test",
      school: "Test",
      subject: "Math",
      gradeLevel: "9",
    });
    await db.insert(s.fights).values(fight);
    const p = student("warrior"),
      p2 = student("wizard", "00000000-0000-4000-8000-000000000002");
    p2.nickname = "Second";
    p2.nicknameNormalized = "second";
    await db.insert(s.students).values([p, p2]);
    await db.insert(s.liveCombatSessions).values({
      sessionId: "REPORT01",
      fightId: fight.id,
      teacherId: fight.teacherId,
    });
    let state = startQuestion(
      addStudent(addStudent(initialCombatState("REPORT01", fight), p), p2),
    );
    state = applyAnswer(
      state,
      p.id,
      fight.questions[0].correctAnswer,
      fight.questions[0],
    );
    state = advancePhase(state, fight);
    state.revision = 10;
    assert.deepEqual(
      state.pendingAttempts?.map((a) => a.outcome),
      ["correct", "unanswered"],
    );
    assert.equal("pendingAttempts" in publicSnapshot(state), false);
    await recordSessionReporting(db, state, fight);
    await recordSessionReporting(db, state, fight);
    const get = (query = "") =>
      sessionReport(db, fight.teacherId, new URLSearchParams(query));
    let report = await get();
    assert.equal(report.total, 1);
    assert.equal(report.summary.sessions, 1);
    assert.equal(report.summary.players, 2);
    assert.equal(report.summary.correct, 1);
    assert.equal(report.summary.attempts, 2);
    report = await get("view=players&job=warrior");
    assert.equal(report.total, 1);
    assert.equal(report.rows[0].studentId, p.id);
    report = await get(
      `view=questions&playerId=${p.id}&questionId=${fight.questions[0].id}&sessionId=REPORT01`,
    );
    assert.equal(report.total, 1);
    assert.equal(
      report.rows[0].question?.question,
      fight.questions[0].question,
    );
    const changed = structuredClone(state);
    const editedFight = structuredClone(fight);
    editedFight.questions[0].question = "New question";
    changed.pendingAttempts!.forEach(
      (a) => (a.questionVersion = questionKey(editedFight.questions[0])),
    );
    await recordSessionReporting(db, changed, editedFight);
    assert.equal(
      (await get("view=questions")).rows[0].question?.question,
      fight.questions[0].question,
    );
    assert.equal((await get("search=REPORT01")).total, 1);
    assert.equal((await get("search=impossiblemissing")).total, 0);
    assert.equal(
      (await get("view=questions&pageSize=1&page=2")).rows.length,
      1,
    );
    assert.equal(
      (
        await sessionReport(
          db,
          "00000000-0000-4000-8000-000000000099",
          new URLSearchParams(),
        )
      ).total,
      0,
    );
    await db.insert(s.liveCombatSessions).values({
      sessionId: "LEGACY01",
      fightId: fight.id,
      teacherId: fight.teacherId,
    });
    await db.insert(s.combatResults).values({
      sessionId: "LEGACY01",
      studentId: p.id,
      fightId: fight.id,
      characterClass: "warrior",
      victory: false,
      survived: true,
      totals: {
        ...state.players[p.id].totals,
        questionsCorrect: 3,
        questionsAnswered: 5,
        questionsIncorrect: 2,
      },
      xpEarned: 3,
      goldReward: 0,
    });
    report = await get();
    assert.equal(report.summary.sessions, 2);
    assert.equal(report.summary.historicalParticipants, 1);
    assert.equal(report.summary.correct, 4);
    assert.equal(report.summary.attempts, 7);
    assert.equal((await get(`questionId=${fight.questions[0].id}`)).total, 1);
    assert.equal(
      (await get("view=players&sessionId=LEGACY01")).rows[0].unanswered,
      null,
    );
    // Signed HTTP identity and ownership are enforced before any report or palette writes.
    const sessions = new Map<string, SessionRecord>();
    const repo: any = {
      createSession: async (r: SessionRecord) => {
        sessions.set(r.tokenHash, r);
      },
      findActiveSession: async (h: string) => sessions.get(h),
      revokeSession: async (h: string) => {
        sessions.delete(h);
      },
    };
    const config = {
      cookieName: "usability_test",
      secret: "local-fixture-only-not-a-deployed-key-1234",
      ttlSeconds: 300,
    };
    const teacherCookie = (
      await issueSession(repo, config, "teacher", fight.teacherId)
    ).split(";")[0];
    const otherCookie = (
      await issueSession(
        repo,
        config,
        "teacher",
        "00000000-0000-4000-8000-000000000099",
      )
    ).split(";")[0];
    const studentCookie = (
      await issueSession(repo, config, "student", p.id)
    ).split(";")[0];
    const call = async (
      path: string,
      cookie = teacherCookie,
      body?: unknown,
      method = body ? "POST" : "GET",
    ) => {
      const url = new URL("https://qa.example" + path);
      const res = await handleGame(
        new Request(url, {
          method,
          headers: { Cookie: cookie, "Content-Type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
        url,
        repo,
        config,
        db,
      );
      assert.ok(res);
      return { status: res.status, body: (await res.json()) as any };
    };
    assert.equal((await call("/api/combat-stats/report")).status, 200);
    assert.equal(
      (await call("/api/combat-stats/report", studentCookie)).status,
      403,
    );
    assert.equal((await call("/api/combat-stats/report", "")).status, 401);
    assert.equal(
      (await call("/api/combat-stats/report", otherCookie)).body.total,
      0,
    );
    assert.equal(
      (await call("/api/combat-stats/report?playerId=invalid")).status,
      400,
    );
    const visual = {
      baseItemId: "basic_armor",
      palette: { primary: "#1246ff", secondary: "#667788", accent: "#ffd233" },
    };
    const itemBody = {
      name: "Blue armor",
      itemType: "armor",
      quality: "common",
      slot: "armor",
      armorCategory: "heavy_armor",
      visual,
      stats: { def: 2 },
    };
    const created = await call("/api/equipment-items", teacherCookie, itemBody);
    assert.equal(created.status, 201);
    assert.deepEqual(
      (await call("/api/equipment-items/" + created.body.id)).body.visual,
      visual,
    );
    assert.equal(
      (
        await call(
          "/api/equipment-items/" + created.body.id,
          otherCookie,
          { visual },
          "PATCH",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/api/equipment-items", teacherCookie, {
          ...itemBody,
          visual: { ...visual, baseItemId: "missing" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/equipment-items", teacherCookie, {
          ...itemBody,
          slot: "weapon",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/api/equipment-items", teacherCookie, {
          ...itemBody,
          visual: { ...visual, palette: { primary: "url(javascript:bad)" } },
        })
      ).status,
      400,
    );
    await db.insert(s.studentJobLevels).values({studentId:p.id,jobClass:"warrior",level:2,experience:0});
    const profile = await combatProfile(db, { ...p, armor: created.body.id });
    const withGear = addStudent(
      initialCombatState("GEARTEST", fight),
      p,
      profile,
    );
    assert.deepEqual(
      publicSnapshot(withGear).players[p.id].equipmentVisuals?.armor,
      visual,
    );
    assert.equal(
      (
        await call(
          "/api/equipment-items/" + created.body.id,
          teacherCookie,
          { visual: null },
          "PATCH",
        )
      ).body.visual,
      null,
    );
    // A room already running at rollout has partial attempts; keep earlier totals without inventing question detail.
    const partial = structuredClone(state);
    partial.revision++;
    partial.players[p.id].totals.questionsCorrect = 4;
    partial.players[p.id].totals.questionsAnswered = 4;
    partial.players[p.id].totals.damageDealt = 50;
    await recordSessionReporting(db, partial, fight);
    const partialReport = await get(
      `view=players&sessionId=REPORT01&playerId=${p.id}`,
    );
    assert.equal(partialReport.rows[0].correct, 4);
    assert.equal(partialReport.rows[0].unanswered, null);
    assert.equal(partialReport.summary.historicalParticipants, 1);
    const scoped = await get(
      `sessionId=REPORT01&questionId=${fight.questions[0].id}`,
    );
    assert.equal(scoped.summary.correct, 1);
    assert.equal(scoped.rows[0].damage, 0);
    const questionView = await get("view=questions");
    assert.equal(questionView.summary.sessions, 1);
    assert.equal(questionView.summary.correct, 1);
    assert.equal(questionView.summary.attempts, 2);
    const later = structuredClone(partial),
      laterFight = structuredClone(fight);
    const nextQuestion = {
      ...fight.questions[0],
      id: "q2",
      question: "Unrelated lesson",
    };
    laterFight.questions.push(nextQuestion);
    later.pendingAttempts = [
      {
        ...state.pendingAttempts![0],
        round: 2,
        questionId: "q2",
        questionVersion: questionKey(nextQuestion),
      },
    ];
    later.revision++;
    await recordSessionReporting(db, later, laterFight);
    const searched = await get("view=questions&search=Unrelated");
    assert.equal(searched.total, 1);
    assert.equal(searched.summary.correct, 1);
    assert.equal(searched.summary.attempts, 1);
    assert.equal(searched.summary.players, 1);
    assert.equal(searched.rows[0].questionId, "q2");
  } finally {
    await pg.close();
  }
});

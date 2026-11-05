// Review draft: no network or fixture writes without --execute and a reviewed
// isolated-target manifest. Never import the canonical live acceptance scripts:
// they execute immediately and default to the production origin.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { validateTarget, assertAward, close, nextStep } from './campaign-acceptance-contract.mjs';

if (!process.argv.includes('--execute')) {
  console.log('PLAN ONLY: 1 QA teacher, 1 QA student, 1 QA guild, 2 one-question fights, 1 campaign; two guardian victories. No network requests. See docs/reviews/2026-11-05-campaign-guardian-acceptance.md.');
} else {
  const manifestPath = process.argv[process.argv.indexOf('--execute') + 1];
  assert.ok(manifestPath && !manifestPath.startsWith('--'), 'Supply reviewed target JSON after --execute');
  const target = validateTarget(JSON.parse(await readFile(manifestPath, 'utf8')));
  const { chromium } = await import('playwright');
  const origin = target.origin, run = `qa-campaign-${randomUUID().slice(0, 12)}`;
  const runDeadline = Date.now() + 20 * 60 * 1000;
  const out = `artifacts/campaign-acceptance/${run}`;
  await mkdir(out, { recursive: true });
  const evidence = { run, target, status: 'incomplete', fixture: {}, encounters: [], checks: [] };
  const record = async () => writeFile(`${out}/evidence.json`, JSON.stringify(evidence, null, 2));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const teacher = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const student = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const tp = await teacher.newPage(), sp = await student.newPage();
  const pageErrors = [];
  for (const p of [tp, sp]) p.on('pageerror', e => pageErrors.push(e.message));
  let teacherId, studentId, campaignId, bankId;
  const actors = [];
  async function api(context, path, method = 'GET', data, statuses = [200]) {
    if (!path.endsWith('/logout')) assert.ok(Date.now() < runDeadline, 'Acceptance exceeded 20-minute budget');
    const response = await context.request.fetch(origin + path, {
      method, data, headers: { Origin: origin }, maxRedirects: 0, timeout: 30000,
    });
    assert.ok(statuses.includes(response.status()), `${method} ${path}: HTTP ${response.status()}`);
    return response.status() === 204 ? null : response.json();
  }
  async function until(fn, label, timeout = 30000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const value = await fn();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out: ${label}`);
  }
  function watch(page) {
    const events = [];
    page.on('websocket', socket => {
      if (new URL(socket.url()).pathname !== '/ws') return;
      socket.on('framereceived', ({ payload }) => {
        try { events.push(JSON.parse(String(payload))); } catch { /* non-JSON control frame */ }
      });
    });
    return events;
  }
  const events = watch(sp);
  const view = () => api(student, `/api/campaigns/${campaignId}`);
  const stamina = () => api(student, `/api/student/${studentId}/stamina`);
  const history = () => api(student, `/api/combat-stats/student/${studentId}?limit=100`);
  const studentRecord = () => api(student, `/api/student/${studentId}`);
  async function clickAction(name) {
    const [response] = await Promise.all([
      sp.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `/api/campaigns/${campaignId}/actions`),
      sp.getByRole('button', { name, exact: true }).click(),
    ]);
    assert.equal(response.status(), 200, `Campaign action ${name}`);
    return { next: await response.json(), command: response.request().postDataJSON() };
  }
  async function openGate(open) {
    const [response] = await Promise.all([
      tp.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `/api/campaigns/${campaignId}/gates`),
      tp.getByRole('button', { name: open ? 'Open gate' : 'Close gate', exact: true }).click(),
    ]);
    assert.equal(response.status(), 200);
    await tp.getByRole('button', { name: open ? 'Close gate' : 'Open gate', exact: true }).waitFor();
  }
  async function stableSaved(expected) {
    await sp.reload();
    await sp.getByRole('button', { name: 'Move north', exact: true }).waitFor();
    const saved = await view();
    assert.deepEqual(saved.layout, expected.layout);
    assert.deepEqual(saved.progress, expected.progress);
    assert.equal(saved.progressRevision, expected.progressRevision);
    return saved;
  }
  function recoveryFields(s) {
    const p = s.players[studentId];
    return { sessionId: s.sessionId, round: s.round, phase: s.currentPhase, deadline: s.phaseDeadline,
      players: Object.keys(s.players), health: p.health, mp: p.mp, answered: p.hasAnswered,
      potions: p.healingPotions, enemies: s.enemies.map(e => [e.id, e.health, e.maxHealth]) };
  }
  async function finishEncounter(start, boss, reconnect) {
    const sessionId = start.progress.activeSessionId;
    assert.ok(sessionId);
    const before = await stamina();
    assert.ok(before.resetsAt - Date.now() > 15 * 60 * 1000, 'Too close to Denver midnight');
    const state = () => events.findLast(m => m.type === 'combat_state' && m.state.sessionId === sessionId);
    const first = await until(state, 'authenticated campaign WebSocket');
    const firstEventIndex = events.indexOf(first);
    assert.equal(first.state.fightId, bankId);
    assert.deepEqual(Object.keys(first.state.players), [studentId]);
    assert.equal(first.state.players[studentId].health, start.progress.health);
    assert.equal(first.state.players[studentId].mp, start.progress.mp);
    assert.equal(first.state.enemies[0].name, boss ? 'Cave Guardian' : 'Wild Slime');
    assert.equal(first.state.enemies[0].role, boss ? 'boss' : 'normal');
    if (reconnect) {
      const active = await until(() => {
        const m = state(); return m?.state.currentPhase === 'question' && m.state.phaseDeadline - Date.now() > 10000 && m;
      }, 'stable active question before reconnect');
      const expected = recoveryFields(active.state), cursor = events.length;
      // A real browser reload closes/reopens its authenticated socket. No mocked
      // API response, synthetic combat state or bypass of animation playback.
      await sp.reload();
      const recovered = await until(() => events.slice(cursor).find(m => m.type === 'combat_state' && m.state.sessionId === sessionId), 'reconnected room');
      assert.deepEqual(recoveryFields(recovered.state), expected);
      assert.equal((await view()).progress.activeSessionId, sessionId);
      evidence.checks.push('active guardian reload preserved room, deadline, resources and enemy HP');
    }
    const deadline = Date.now() + 6 * 60 * 1000;
    let completed;
    while (Date.now() < deadline) {
      const m = state(), s = m?.state;
      if (s?.currentPhase === 'game_over') {
        // Public receipts omit sessionId. Only inspect events after this room's
        // first snapshot, then match the receipt to its persistent session below.
        completed = events.slice(firstEventIndex).findLast(e => e.type === 'game_over' && e.results?.some(r => r.studentId === studentId));
        if (completed) break;
      }
      assert.ok(!s || s.round <= 60, 'Encounter exceeded the fixed 60-round budget');
      if (s?.currentPhase === 'question' && !s.players[studentId].hasAnswered) {
        assert.equal(m.question?.id, 'qa-selected-q', 'Question must come from selected assigned bank');
        const answer = sp.getByRole('textbox', { name: 'Your answer', exact: true });
        if (await answer.isVisible()) {
          await answer.fill('4');
          await sp.getByRole('button', { name: 'Submit answer', exact: true }).click();
        }
      } else if (s?.currentPhase === 'actions' && !s.players[studentId].ready) {
        const attack = sp.getByRole('button', { name: 'Confirm Attack & Ready', exact: true });
        if (await attack.isVisible()) await attack.click();
      } else if (s?.currentPhase === 'abilities' && !s.players[studentId].ready) {
        const ready = sp.getByRole('button', { name: /^Ready — / });
        if (await ready.isVisible()) await ready.click();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(completed, 'No complete, persisted encounter within fixed deadline');
    assert.equal(completed.victory, true, 'Fixture must win through normal combat');
    const receipts = (await history()).filter(r => r.sessionId === sessionId);
    assert.equal(receipts.length, 1);
    const receipt = receipts[0];
    assert.equal(receipt.fightId, bankId);
    assert.ok(receipt.questionsAnswered > 0);
    assert.equal(receipt.questionsAnswered, receipt.questionsCorrect);
    assert.equal(completed.results.find(r => r.studentId === studentId).id, receipt.id);
    const after = await stamina(), award = assertAward(before, after, receipt, boss);
    const settled = await view(), finalPlayer = state().state.players[studentId];
    assert.equal(settled.progress.activeSessionId, null);
    assert.equal(settled.progress.cleared, boss);
    assert.equal(settled.progress.health, Math.min(finalPlayer.health, settled.progress.maxHealth));
    assert.equal(settled.progress.mp, Math.min(finalPlayer.mp, settled.progress.maxMp));
    assert.equal(settled.progress.healingPotions, finalPlayer.healingPotions);
    assert.deepEqual(settled.layout, start.layout);
    if (boss) {
      await sp.getByText(`Campaign boss reward: +${Math.round(award.restored * 1000) / 10}% stamina restored.`, { exact: true }).waitFor();
      await sp.screenshot({ path: `${out}/guardian-${evidence.encounters.filter(e => e.boss).length + 1}.png`, fullPage: true });
      const saved = { stamina: after, student: await studentRecord(), jobs: await api(student, `/api/student/${studentId}/job-levels`), progress: settled.progress, revision: settled.progressRevision, history: await history() };
      // Re-enter the completed room from a second real authenticated tab, then
      // refresh the original. Both must receive the existing persisted receipt.
      const second = await student.newPage(), otherEvents = watch(second);
      await second.goto(origin + '/student/combat');
      await until(() => otherEvents.some(m => m.type === 'game_over' && m.results?.some(r => r.id === receipt.id)), 'completed-room second-tab replay');
      const cursor = events.length;
      await sp.reload();
      await until(() => events.slice(cursor).some(m => m.type === 'game_over' && m.results?.some(r => r.id === receipt.id)), 'completed-room reload receipt');
      await second.close();
      const repeated = await Promise.all([view(), view(), view()]);
      for (const v of repeated) { assert.deepEqual(v.progress, saved.progress); assert.equal(v.progressRevision, saved.revision); }
      assert.deepEqual(await stamina(), saved.stamina);
      assert.deepEqual(await studentRecord(), saved.student);
      assert.deepEqual(await api(student, `/api/student/${studentId}/job-levels`), saved.jobs);
      assert.deepEqual(await history(), saved.history);
      evidence.checks.push('completed-room reload/second-tab replay changed neither receipt, stamina, XP/gold nor progress');
    }
    evidence.encounters.push({ sessionId, resultId: receipt.id, boss, before, after, appliedXpRate: receipt.xpMultiplier, staminaRestored: receipt.staminaRestored, award });
    assert.ok(evidence.encounters.length <= 60, 'Acceptance exceeded 60 encounter budget');
    await record();
    await sp.getByRole('button', { name: 'Return to adventure', exact: true }).click();
    await sp.waitForURL(`**/student/campaign/${campaignId}`);
    return stableSaved(settled);
  }
  async function walk(targetPoint) {
    for (let n = 0; n < 200; n++) {
      const current = await view();
      if (current.progress.activeSessionId) { await finishEncounter(current, false, false); continue; }
      const step = nextStep(current, targetPoint);
      if (!step) return current;
      const { next } = await clickAction(`Move ${step.direction}`);
      if (next.progress.activeSessionId) await finishEncounter(next, false, false);
    }
    throw new Error('Traversal exceeded 200 real steps');
  }
  try {
    assert.equal((await api(teacher, '/api/health/ready')).status, 'ready');
    const password = `Qa-${randomUUID()}!`;
    const t = await api(teacher, '/api/teacher/signup', 'POST', { firstName: 'Campaign QA', lastName: run,
      email: `${run}@example.invalid`, password, billingAddress: 'Isolated QA', schoolDistrict: 'QA', school: 'QA', subject: 'Math', gradeLevel: '5' }, [200, 201]);
    teacherId = t.id || t.teacher?.id; assert.ok(teacherId); actors.push([teacher, 'teacher']);
    evidence.fixture.teacherId = teacherId; await record();
    const s = await api(student, '/api/student/login', 'POST', { nickname: run, password });
    studentId = s.id; assert.ok(studentId); actors.push([student, 'student']);
    evidence.fixture.studentId = studentId; await record();
    await api(student, `/api/student/${studentId}/character`, 'PATCH', { characterClass: 'warrior', gender: 'A' });
    const guild = await api(teacher, '/api/guilds', 'POST', { name: run, description: 'Isolated guardian acceptance' }, [201]);
    evidence.fixture.guildId = guild.id; await record();
    await api(student, `/api/guilds/${guild.id}/members`, 'POST', { studentId });
    assert.deepEqual((await api(student, `/api/student/${studentId}/guilds`)).map(g => g.id), [guild.id]);
    assert.equal((await api(teacher, '/api/campaigns/availability')).enabled, true, 'Target requires isolated campaign-preview policy');
    async function makeFight(kind) {
      const selected = kind === 'selected';
      const f = await api(teacher, '/api/fights', 'POST', { teacherId, title: `${run}-${kind}`,
        questions: [{ id: selected ? 'qa-selected-q' : 'qa-template-q', type: 'short_answer', question: selected ? '2+2' : '9+9', correctAnswer: selected ? '4' : '18', timeLimit: 60 }],
        enemies: [{ id: 'qa-slime', name: 'QA Slime', image: '/enemies/slime-v2.png', enemyType: 'slime', difficultyMultiplier: 1, quantity: 1, role: 'normal' }],
        baseXP: 1, baseEnemyDamage: 1, enemyDisplayMode: 'consecutive', lootTable: [], randomizeQuestions: false, shuffleOptions: false }, [201]);
      evidence.fixture[`${kind}FightId`] = f.id; await record(); return f;
    }
    const template = await makeFight('template'), bank = await makeFight('selected'); bankId = bank.id;
    await api(teacher, `/api/guilds/${guild.id}/fights`, 'POST', { fightId: bankId });
    for (const [page, role, id] of [[tp, 'teacher', teacherId], [sp, 'student', studentId]]) {
      // Identity hints only. Real HTTP-issued, httpOnly session cookies remain
      // in separate contexts and authenticate every API/WS request.
      await page.addInitScript(({ role, id }) => localStorage.setItem(`${role}Id`, id), { role, id });
    }
    await tp.goto(origin + '/teacher/campaigns');
    await tp.getByLabel('Campaign name', { exact: true }).fill(run);
    await tp.getByLabel('Dungeon name', { exact: true }).fill('QA Cave');
    await tp.getByLabel('Campaign guild', { exact: true }).selectOption(guild.id);
    await tp.getByLabel('Dungeon quiz', { exact: true }).selectOption(template.id);
    await tp.getByLabel('Required keys', { exact: true }).fill('QA Cave Key');
    const [created] = await Promise.all([tp.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/campaigns'), tp.getByRole('button', { name: 'Generate campaign', exact: true }).click()]);
    assert.equal(created.status(), 201); campaignId = (await created.json()).id;
    evidence.fixture.campaignId = campaignId; await record();
    await sp.goto(origin + `/student/campaign/${campaignId}`);
    const enter = sp.getByRole('button', { name: 'Enter campaign beta', exact: true });
    await enter.waitFor(); assert.equal(await enter.isDisabled(), true);
    const options = await sp.getByLabel('Assigned fight', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(n => n.value).filter(Boolean));
    assert.deepEqual(options, [bankId], 'Unassigned campaign template is not a selectable bank');
    await sp.getByLabel('Assigned fight', { exact: true }).selectOption(bankId);
    const { next: selected } = await clickAction('Enter campaign beta');
    assert.equal(selected.progress.questionBankFightId, bankId);
    assert.equal(selected.gates[0].open, false);
    const keeper = selected.layout.npcs.find(n => n.gateId === selected.gates[0].id);
    assert.ok(keeper); await walk(keeper);
    const collect = sp.getByRole('button', { name: 'Collect key', exact: true });
    await collect.waitFor(); assert.equal(await collect.isDisabled(), true);
    const closed = await view();
    await api(student, `/api/campaigns/${campaignId}/actions`, 'POST', { commandId: randomUUID(), revision: closed.progressRevision, action: { type: 'quest', gateId: closed.gates[0].id } }, [400]);
    assert.deepEqual((await view()).progress, closed.progress);
    await openGate(true);
    await until(async () => !(await collect.isDisabled()), 'keeper unlocked by live polling without student refresh', 15000);
    const { next: keyed, command } = await clickAction('Collect key');
    assert.deepEqual(keyed.progress.claimedUnlocks, [closed.gates[0].id]);
    const retried = await api(student, `/api/campaigns/${campaignId}/actions`, 'POST', command);
    assert.deepEqual(retried.progress, keyed.progress); assert.equal(retried.progressRevision, keyed.progressRevision);
    await stableSaved(keyed);
    await openGate(false);
    await until(async () => !(await view()).gates[0].open, 'teacher closes collected-key gate');
    let atDoor = await walk(keyed.layout.entrance);
    assert.equal(await sp.getByRole('button', { name: 'Enter QA Cave', exact: true }).isDisabled(), true);
    assert.deepEqual(atDoor.progress.claimedUnlocks, keyed.progress.claimedUnlocks);
    await openGate(true);
    await until(async () => !(await sp.getByRole('button', { name: 'Enter QA Cave', exact: true }).isDisabled()), 'cave reopened with saved key', 15000);
    evidence.checks.push('teacher configuration, explicit assigned bank, closed/open/reclosed gates, key retry and saved key');
    // Exercise a real ordinary fight before the first guardian, even if the
    // generated route happened to produce none. No stamina or HP SQL seeding.
    for (let n = 0; (await stamina()).completedCombats < 2; n++) {
      assert.ok(n < 100, 'No ordinary encounter within 100 outside-town steps');
      const v = await view(), map = v.layout.overworld, p = v.progress.position;
      const dirs = [[1, 0, 'east'], [-1, 0, 'west'], [0, 1, 'south'], [0, -1, 'north']];
      const choices = dirs.filter(([dx, dy]) => {
        const x = p.x + dx, y = p.y + dy;
        return x > 7 && x < map.width && y >= 0 && y < map.height && !['wall', 'water', 'mountain'].includes(map.tiles[y * map.width + x]);
      });
      assert.ok(choices.length);
      const { next } = await clickAction(`Move ${choices[n % choices.length][2]}`);
      if (next.progress.activeSessionId) await finishEncounter(next, false, false);
    }
    for (let pass = 1; pass <= 2; pass++) {
      if (pass === 2) {
        await sp.goto(origin + '/student/campaigns');
        await sp.getByRole('button', { name: 'Reset campaign', exact: true }).click();
        const dialog = sp.getByRole('alertdialog');
        await dialog.getByRole('button', { name: 'Reset campaign', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await sp.goto(origin + `/student/campaign/${campaignId}`);
        const reset = await view();
        assert.equal(reset.progress.cleared, false); assert.deepEqual(reset.progress.claimedUnlocks, []);
        assert.deepEqual(reset.layout, selected.layout);
        await walk(keeper); await clickAction('Collect key');
      }
      await walk((await view()).layout.entrance);
      await clickAction('Enter QA Cave');
      await walk((await view()).layout.objective);
      const { next } = await clickAction('Challenge guardian');
      const cleared = await finishEncounter(next, true, pass === 1);
      assert.equal(cleared.progress.cleared, true);
      await sp.getByRole('button', { name: 'Guardian defeated', exact: true }).waitFor();
    }
    const guardians = evidence.encounters.filter(e => e.boss);
    assert.equal(guardians.length, 2); assert.notEqual(guardians[0].sessionId, guardians[1].sessionId);
    assert.notEqual(guardians[0].resultId, guardians[1].resultId);
    for (const g of guardians) close(g.staminaRestored, 0.2, 'Depleted guardian recovery');
    assert.ok(evidence.encounters.filter(e => !e.boss).length >= 2);
    assert.deepEqual(pageErrors, []);
    evidence.status = 'browser-and-api-passed-provider-audit-pending';
  } catch (error) {
    evidence.status = 'failed'; evidence.failure = error.message;
    await sp.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    const logouts = await Promise.allSettled(actors.map(([context, role]) => api(context, `/api/${role}/logout`, 'POST')));
    evidence.logoutPassed = logouts.every(r => r.status === 'fulfilled');
    await record(); await browser.close();
    assert.equal(evidence.logoutPassed, true, 'QA logout failed; preserve inventory for follow-up');
  }
  console.log(`Browser/API checks complete; provider audit still required. Evidence: ${out}/evidence.json`);
}

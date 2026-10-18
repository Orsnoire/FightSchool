import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { build } from 'esbuild';

const baseline = 'e02f46d7367f8f006a97565fec0d4d5b85ff648b';
const source = (path, text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const oldLobby = source('Lobby.tsx', execFileSync('git', ['show', `${baseline}:client/src/pages/Lobby.tsx`], { encoding: 'utf8' }));
function body(file, name) {
  let found;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer && ts.isArrowFunction(node.initializer)) found = node.initializer.body;
    ts.forEachChild(node, visit);
  };
  visit(file); assert.ok(found, name);
  return ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, found, file);
}
const preserved = {
  handleClassChange: 'client/src/features/lobby/useClassAppearance.ts',
  updateEquipment: 'client/src/features/lobby/useLoadoutActions.ts',
  updateCrossClassAbility: 'client/src/features/lobby/useLoadoutActions.ts',
  handleDragStart: 'client/src/features/lobby/CrossClassPanel.tsx',
  handleDragEnd: 'client/src/features/lobby/CrossClassPanel.tsx',
  joinFight: 'client/src/pages/Lobby.tsx',
  handleLogout: 'client/src/pages/Lobby.tsx',
};
for (const [name, path] of Object.entries(preserved)) assert.equal(body(source(path, await readFile(path, 'utf8')), name), body(oldLobby, name), name);

const retired = ['getPlayerCombatStats', 'calculateCriticalHit', 'calculatePhysicalDamage', 'calculateMagicalDamage', 'calculateRangedDamage', 'calculateHybridDamage', 'calculateDamageReduction', 'calculateSoloModeEnemyScaling', 'ResolutionFeedbackType', 'ResolutionFeedback', 'EnemyAIAttackData', 'PartyDamageData'];
const matches = execFileSync('git', ['grep', '-n', '-w', '-E', retired.join('|'), baseline, '--', '*.ts', '*.tsx', '*.js', '*.mjs'], { encoding: 'utf8' }).trim().split('\n');
assert.ok(matches.every(line => line.startsWith(`${baseline}:shared/schema.ts:`)), 'retired symbols had no callers outside their legacy declaration file');
const schema = source('shared/schema.ts', await readFile('shared/schema.ts', 'utf8'));
assert.ok(schema.statements.every(node => !node.name || !retired.includes(node.name.text)));
assert.match(await readFile('client/src/pages/StudentGuildLobby.tsx', 'utf8'), /useQuery<CombatState\[\]>/);
assert.match(await readFile('shared/schema.ts', 'utf8'), /export interface CombatState/);
// Room recovery owners must stay byte-identical to the released baseline.
for (const path of ['worker/combat/room-recovery.ts', 'worker/combat/room-state.ts']) {
  assert.equal(await readFile(path, 'utf8'), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' }));
}
const bundled = await build({ entryPoints: ['client/src/pages/CreateFight.tsx', 'client/src/pages/Lobby.tsx'], bundle: true, write: false, outdir: '/tmp/c11-audit', platform: 'browser', format: 'esm', packages: 'external', metafile: true, loader: { '.css': 'empty', '.png': 'empty' } });
const inputs = bundled.metafile.inputs;
const files = Object.keys(inputs);
assert.ok(!files.some(path => path.startsWith('worker/')), 'client runtime must not import Worker implementations');
const features = files.filter(path => path.startsWith('client/src/features/'));
function visit(path, stack = []) {
  assert.ok(!stack.includes(path), `runtime feature cycle: ${[...stack, path].join(' -> ')}`);
  for (const item of inputs[path].imports) if (features.includes(item.path)) visit(item.path, [...stack, path]);
}
features.forEach(path => visit(path));
const lengths = {};
for (const path of ['client/src/pages/CreateFight.tsx', 'client/src/pages/Lobby.tsx', 'shared/schema.ts']) {
  lengths[path] = { before: execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' }).trimEnd().split('\n').length, after: (await readFile(path, 'utf8')).trimEnd().split('\n').length };
}
console.log(JSON.stringify({ baseline, preservedLobbyHandlers: Object.keys(preserved), retired, baselineReferenceLines: matches.length, retainedLegacyCaller: 'StudentGuildLobby active-sessions', savedRoomOwnersUnchanged: true, runtimeFeatureModules: features.length, runtimeFeatureCycles: 0, lengths }, null, 2));

import assert from 'node:assert/strict';
const median = values => [...values].sort((a,b)=>a-b)[Math.ceil(values.length/2)-1];

export function summarizePerformance(samples, repetitions) {
  assert.ok(Number.isInteger(repetitions) && repetitions >= 3 && repetitions <= 10);
  assert.equal(samples.length,repetitions*2,'Unexpected or missing performance sample');
  const groups = [30,60].map(players => {
    const runs = samples.filter(s => s.players === players);
    assert.equal(runs.length, repetitions, 'Missing classroom repetition');
    assert.equal(new Set(runs.map(s=>s.repetition)).size, repetitions);
    assert.ok(runs.every(s=>Number.isInteger(s.repetition) && s.repetition>=1 && s.repetition<=repetitions));
    for (const {manifest:m} of runs) {
      assert.equal(m.mode,'isolated'); assert.equal(m.status,'passed'); assert.equal(m.pending.length,0);
      assert.equal(m.answerAckMs.count,players);
      assert.equal(m.history?.perStudent,100); assert.equal(m.history.results,players*100);
      for (const key of ['guildQuests','classActions','classSupport']) assert.equal(m.metrics?.[key]?.count,players);
      for (const key of ['reconnect','completion']) assert.equal(m.metrics?.[key]?.count,1);
      for (const stats of [m.answerAckMs,...Object.values(m.metrics)]) {
        assert.ok(['p50','p95','max'].every(k=>Number.isFinite(stats[k]) && stats[k]>=0));
        assert.ok(stats.p50<=stats.p95 && stats.p95<=stats.max);
      }
    }
    return {players,repetitions,medianRunP95Ms:median(runs.map(s=>s.manifest.answerAckMs.p95)),
      worstRunP95Ms:Math.max(...runs.map(s=>s.manifest.answerAckMs.p95)),
      runs:runs.map(s=>({repetition:s.repetition,manifest:s.path,runId:s.manifest.runId,answers:s.manifest.answerAckMs,metrics:s.manifest.metrics}))};
  });
  assert.equal(new Set(samples.map(s=>s.manifest.runId)).size,samples.length,'A reused run is not a repetition');
  assert.equal(new Set(samples.map(s=>JSON.stringify([s.manifest.isolationId,s.manifest.origin,s.manifest.release.commit,s.manifest.release.workerVersion]))).size,1,'Release or target changed between samples');
  return {groups,proposed30PlayerTargetMs:1000,proposedTargetMet:groups[0].worstRunP95Ms<1000,
    signoff:'pending: provider diagnostics, browser render/memory, recovery/rollback, physical classroom observation and threshold calibration remain separate gates'};
}

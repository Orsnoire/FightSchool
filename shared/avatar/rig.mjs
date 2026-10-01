// Pure presentation math. No clocks, browser APIs, combat state, or persistence.
const radians = degrees => degrees * Math.PI / 180;
const degrees = radians => radians * 180 / Math.PI;
export function transformPoint(transform, point) {
  const angle = radians(transform.rotation), c = Math.cos(angle), s = Math.sin(angle);
  return { x: transform.x + c * point.x - s * point.y, y: transform.y + s * point.x + c * point.y };
}
export function worldTransforms(bones, pose) {
  const result = {};
  for (const bone of bones) {
    const local = pose[bone.id];
    if (!bone.parent) result[bone.id] = { ...local };
    else {
      const parent = result[bone.parent];
      if (!parent) throw new Error(`Parent must precede child: ${bone.id}`);
      result[bone.id] = { ...transformPoint(parent, local), rotation: parent.rotation + local.rotation };
    }
  }
  return result;
}
export function sampleTrack(keys, time) {
  if (time <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (time > keys[i][0]) continue;
    const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
    const u = (time - t0) / (t1 - t0), smooth = u * u * (3 - 2 * u);
    return v0 + (v1 - v0) * smooth;
  }
  return keys.at(-1)[1];
}
export function validateRig(rig, clips) {
  if (rig.bones.filter(b => !b.parent).length !== 1 || rig.bones[0]?.id !== 'root') throw new Error('Expected one ground root');
  const ids = new Set();
  for (const bone of rig.bones) {
    if (ids.has(bone.id) || (bone.parent && !ids.has(bone.parent))) throw new Error(`Invalid hierarchy: ${bone.id}`);
    if (![bone.x, bone.y, bone.rotation].every(Number.isFinite)) throw new Error(`Invalid transform: ${bone.id}`);
    ids.add(bone.id);
  }
  for (const part of rig.parts) {
    if (!ids.has(part.bone)) throw new Error(`Missing attachment: ${part.id}`);
    if (part.rect.length !== 4 || !part.rect.every(Number.isFinite) || part.rect[2] <= 0 || part.rect[3] <= 0) throw new Error(`Invalid part bounds: ${part.id}`);
  }
  for (const constraint of rig.feet) {
    for (const id of [constraint.upper, constraint.lower, constraint.foot]) if (!ids.has(id)) throw new Error(`Invalid leg: ${id}`);
    if (constraint.lengths.length !== 2 || !constraint.lengths.every(n => Number.isFinite(n) && n > 0) || constraint.target.length !== 2 || !constraint.target.every(Number.isFinite)) throw new Error('Invalid foot constraint');
    const lower = rig.bones.find(b => b.id === constraint.lower), foot = rig.bones.find(b => b.id === constraint.foot);
    if (lower.parent !== constraint.upper || foot.parent !== constraint.lower || lower.x !== 0 || foot.x !== 0 || lower.y !== constraint.lengths[0] || foot.y !== constraint.lengths[1]) throw new Error('Leg lengths do not match the skeleton');
  }
  for (const clip of Object.values(clips)) {
    if (!(clip.duration > 0)) throw new Error('Invalid clip duration');
    for (const [id, channels] of Object.entries(clip.tracks)) {
      if (!ids.has(id)) throw new Error(`Unknown animated bone: ${id}`);
      for (const [channel, keys] of Object.entries(channels)) {
        if (!['x', 'y', 'rotation'].includes(channel) || !keys.length) throw new Error('Invalid animation track');
        keys.forEach(([t, v], i) => {
          if (!Number.isFinite(t) || !Number.isFinite(v) || t < 0 || t > clip.duration || (i && t <= keys[i - 1][0])) throw new Error('Invalid keyframe');
        });
      }
    }
  }
  return true;
}

// Two-bone leg constraints keep both ankle anchors fixed while the torso breathes.
function plantFeet(rig, pose) {
  for (const constraint of rig.feet) {
    let world = worldTransforms(rig.bones, pose);
    const hip = world[constraint.upper];
    const target = transformPoint(world.root, { x: constraint.target[0], y: constraint.target[1] });
    const dx = target.x - hip.x, dy = target.y - hip.y;
    const [a, b] = constraint.lengths;
    const distance = Math.hypot(dx, dy), d = Math.max(Math.abs(a - b) + .0001, Math.min(a + b - .0001, distance));
    const direction = Math.atan2(-dx, dy);
    const bend = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
    const upperRotation = degrees(direction - bend);
    const parent = rig.bones.find(bone => bone.id === constraint.upper).parent;
    pose[constraint.upper].rotation = upperRotation - world[parent].rotation;
    world = worldTransforms(rig.bones, pose);
    const knee = world[constraint.lower];
    const lowerRotation = degrees(Math.atan2(-(target.x - knee.x), target.y - knee.y));
    pose[constraint.lower].rotation = lowerRotation - upperRotation;
    pose[constraint.foot].rotation = -lowerRotation;
  }
}

export function sampleRig(rig, clips, clipId, seconds, { loop = true, reducedMotion = false } = {}) {
  const clip = clips[clipId];
  if (!clip) throw new Error(`Unknown clip: ${clipId}`);
  if (!Number.isFinite(seconds)) throw new Error('Invalid time');
  const time = reducedMotion ? 0 : loop ? ((seconds % clip.duration) + clip.duration) % clip.duration : Math.max(0, Math.min(seconds, clip.duration));
  const pose = Object.fromEntries(rig.bones.map(b => [b.id, { x: b.x, y: b.y, rotation: b.rotation }]));
  for (const [id, channels] of Object.entries(clip.tracks)) for (const [channel, keys] of Object.entries(channels)) pose[id][channel] += sampleTrack(keys, time);
  plantFeet(rig, pose);
  return { time, pose, world: worldTransforms(rig.bones, pose) };
}

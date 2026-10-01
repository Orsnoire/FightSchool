import { sampleRig, transformPoint } from './rig.mjs';

// Uses the Canvas 2D API in either a browser or the offline preview renderer.
export function drawAvatar(ctx, data, textures, options = {}) {
  const { rig, clips } = data;
  const { clip = 'idle', time = 0, outfit = 'starter', skeleton = false, weapons = true, reducedMotion = false } = options;
  const frame = sampleRig(rig, clips, clip, time, { reducedMotion });
  const kit = rig.kits[outfit];
  if (!kit) throw new Error(`Unknown outfit: ${outfit}`);
  for (const part of rig.parts) {
    if (part.weapon && !weapons) continue;
    const spriteId = part.slot ? kit[part.slot] : part.sprite;
    if (!spriteId) continue;
    const texture = textures[spriteId];
    if (!texture) throw new Error(`Missing texture: ${spriteId}`);
    const bone = frame.world[part.bone];
    ctx.save();
    ctx.translate(bone.x, bone.y);
    ctx.rotate(bone.rotation * Math.PI / 180);
    ctx.globalAlpha = part.opacity ?? 1;
    if (part.flipX) ctx.scale(-1, 1);
    if (part.layerRegion === 'sleeve-front') {
      const [x, y, w, h] = part.rect;
      // The rear opening is drawn before the arm. Keep the shell and front
      // cuff lip above it, leaving the interior open for the emerging limb.
      ctx.beginPath();
      ctx.moveTo(x, y);ctx.lineTo(x + w, y);ctx.lineTo(x + w, y + h * .91);
      ctx.bezierCurveTo(x + w * .65, y + h * .70, x + w * .25, y + h * .63, x, y + h * .79);
      ctx.closePath();
      ctx.moveTo(x, y + h * .83);
      ctx.bezierCurveTo(x + w * .4, y + h * 1.04, x + w * .85, y + h * 1.06, x + w, y + h * .89);
      ctx.lineTo(x + w, y + h);ctx.lineTo(x, y + h);ctx.closePath();
      ctx.clip();
    }
    ctx.drawImage(texture, ...part.rect);
    ctx.restore();
  }
  if (skeleton) {
    ctx.save();ctx.lineWidth = 4;ctx.strokeStyle = '#20d0c5';ctx.fillStyle = '#f7b84e';
    for (const bone of rig.bones) {
      const point = frame.world[bone.id];
      if (bone.parent) {
        const parent = frame.world[bone.parent];
        ctx.beginPath();ctx.moveTo(parent.x, parent.y);ctx.lineTo(point.x, point.y);ctx.stroke();
      }
      ctx.beginPath();ctx.arc(point.x, point.y, bone.id.includes('grip') ? 10 : 6, 0, Math.PI * 2);ctx.fill();
    }
    ctx.restore();
  }
  frame.swordTip = transformPoint(frame.world.right_grip, { x: 0, y: -320 });
  return frame;
}

export function drawStage(ctx, width, height, data, textures, options = {}) {
  ctx.save();ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#eef0ed';ctx.fillRect(0, 0, width, height);
  const contentHeight = height - 64;
  const scale = Math.min(width / 1100, contentHeight / 1600);
  const x = width / 2 - 550 * scale, y = height - 1550 * scale;
  ctx.translate(x, y);ctx.scale(scale, scale);
  ctx.strokeStyle = '#d1d7d2';ctx.lineWidth = 2;
  ctx.beginPath();ctx.moveTo(130, 1490);ctx.lineTo(1120, 1490);ctx.stroke();
  ctx.fillStyle = '#23393618';ctx.beginPath();ctx.ellipse(535, 1490, 270, 30, 0, 0, Math.PI * 2);ctx.fill();
  const frame = drawAvatar(ctx, data, textures, options);
  ctx.restore();return frame;
}

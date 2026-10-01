import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { prepareTextures } from '../../../shared/avatar/textures.mjs';
import { drawStage } from '../../../shared/avatar/render.mjs';
import { validateRig } from '../../../shared/avatar/rig.mjs';

const root = new URL('../../../', import.meta.url);
const folder = new URL('attached_assets/characters/human/rig-prototype-v1/', root);
const readJson = path => JSON.parse(readFileSync(new URL(path, folder), 'utf8'));
const manifest = readJson('manifest.json'), rig = readJson('rig.json'), clips = readJson('clips.json');
validateRig(rig, clips);
const images = Object.fromEntries(await Promise.all(Object.entries(manifest.sources).map(async ([id, source]) => {
  const bytes = readFileSync(new URL(source.path, root));
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`Source changed: ${source.path}`);
  return [id, await loadImage(fileURLToPath(new URL(source.path, root)))];
})));
const data = { manifest, rig, clips }, textures = prepareTextures(data, images, createCanvas, manifest.defaultColors);
const preview = new URL('preview/', folder);mkdirSync(preview, { recursive: true });
const fps = 20;
function label(ctx, title, subtitle, width) {
  ctx.fillStyle = '#eef0ed';ctx.fillRect(0, 0, width, 57);
  ctx.fillStyle = '#244c40';ctx.font = 'bold 17px sans-serif';ctx.fillText(title, 20, 24);
  ctx.fillStyle = '#617169';ctx.font = '12px sans-serif';ctx.fillText(subtitle, 20, 44);
}
async function exportGif(name, seconds, width, height, paint) {
  const temp = mkdtempSync(join(tmpdir(), 'qa-avatar-frames-'));
  try {
    const count = Math.round(seconds * fps), canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
    for (let i = 0; i < count; i++) { paint(ctx, i / fps);writeFileSync(join(temp, `${String(i).padStart(4, '0')}.png`), canvas.toBuffer('image/png')); }
    const output = fileURLToPath(new URL(name + '.gif', preview));
    const encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(temp, '%04d.png'), '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', output], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';encoder.stderr.on('data', chunk => { error += chunk; });
    const [code] = await once(encoder, 'exit');if (code !== 0) throw new Error(error || 'ffmpeg failed');
    console.log(`${name}.gif: ${count} frames, ${seconds.toFixed(1)}s, infinite loop`);
    const video = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(temp, '%04d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', fileURLToPath(new URL(name + '.mp4', preview))], { stdio: ['ignore', 'ignore', 'pipe'] });
    let videoError = '';video.stderr.on('data', chunk => { videoError += chunk; });
    const [videoCode] = await once(video, 'exit');if (videoCode !== 0) throw new Error(videoError || 'Video export failed');
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

for (const clip of ['idle', 'attack', 'block']) {
  await exportGif(clip, clips[clip].duration, 480, 680, (ctx, time) => {
    drawStage(ctx, 480, 680, data, textures, { clip, time, outfit: 'armor' });
    label(ctx, clips[clip].name, `Rig fitting 02 · ${time.toFixed(2)} / ${clips[clip].duration.toFixed(2)} s`, 480);
  });
}
const total = clips.idle.duration + clips.attack.duration + clips.block.duration;
const panel = createCanvas(420, 680), panelCtx = panel.getContext('2d');
await exportGif('equipment-comparison', total, 840, 680, (ctx, time) => {
  let clip = 'idle', local = time;
  if (time >= clips.idle.duration + clips.attack.duration) { clip = 'block';local -= clips.idle.duration + clips.attack.duration; }
  else if (time >= clips.idle.duration) { clip = 'attack';local -= clips.idle.duration; }
  for (const [i, outfit] of ['starter', 'armor'].entries()) {
    drawStage(panelCtx, 420, 680, data, textures, { clip, time: local, outfit });
    label(panelCtx, outfit === 'starter' ? 'Starter clothing' : 'Steel & blue armor', `${clips[clip].name} · ${local.toFixed(2)} s · fitting 02`, 420);
    ctx.drawImage(panel, i * 420, 0);
  }
});

const contact = createCanvas(1440, 680), ctx = contact.getContext('2d');
for (const [i, [clip, time]] of [['idle', 0], ['attack', .9], ['block', 1.2]].entries()) {
  const c = createCanvas(480, 680), cc = c.getContext('2d');drawStage(cc, 480, 680, data, textures, { clip, time, outfit: 'armor' });label(cc, clips[clip].name, `Inspection pose · ${time.toFixed(2)}s`, 480);ctx.drawImage(c, i * 480, 0);
}
writeFileSync(new URL('review-poses.png', preview), contact.toBuffer('image/png'));
writeFileSync(new URL('export-report.json', preview), JSON.stringify({ fps, renderer: 'shared/avatar/render.mjs', loop: 'infinite', clips: Object.fromEntries(Object.entries(clips).map(([id, c]) => [id, { duration: c.duration, frames: Math.round(c.duration * fps) }])), rigSha256: createHash('sha256').update(readFileSync(new URL('rig.json', folder))).digest('hex'), clipsSha256: createHash('sha256').update(readFileSync(new URL('clips.json', folder))).digest('hex') }, null, 2) + '\n');

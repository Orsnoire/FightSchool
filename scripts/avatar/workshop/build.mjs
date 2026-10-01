import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { validateRig } from '../../../shared/avatar/rig.mjs';

const root = new URL('../../../', import.meta.url);
const folder = new URL('attached_assets/characters/human/rig-prototype-v1/', root);
const readJson = path => JSON.parse(readFileSync(new URL(path, folder), 'utf8'));
const manifest = readJson('manifest.json'), rig = readJson('rig.json'), clips = readJson('clips.json');
validateRig(rig, clips);
const images = {};
for (const [id, source] of Object.entries(manifest.sources)) {
  const bytes = readFileSync(new URL(source.path, root));
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`Source changed: ${source.path}`);
  images[id] = 'data:image/png;base64,' + bytes.toString('base64');
}
const bundle = await build({ entryPoints: [fileURLToPath(new URL('app.mjs', import.meta.url))], bundle: true, write: false, format: 'iife', minify: true, target: 'es2022' });
const payload = JSON.stringify({ manifest, rig, clips, images }).replace(/</g, '\\u003c');
const script = `<script>window.AVATAR_WORKSHOP_DATA=${payload};\n${bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`;
const template = readFileSync(new URL('workshop.html', import.meta.url), 'utf8');
mkdirSync(new URL('preview/', folder), { recursive: true });
writeFileSync(new URL('preview/workshop.html', folder), template.replace('<!--WORKSHOP_SCRIPT-->', script));
console.log('Built offline workshop: ' + fileURLToPath(new URL('preview/workshop.html', folder)));

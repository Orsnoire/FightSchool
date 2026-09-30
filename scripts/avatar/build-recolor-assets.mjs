import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import { recolorAvatar, hexToRgb } from '../../shared/avatar-recolor.mjs';

const folder = new URL('../../attached_assets/characters/human/v1/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', folder), 'utf8'));
const channels = ['hair', 'eyes', 'skin'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const reports = [];
for (const directory of ['masks', 'neutral', 'previews']) {
  mkdirSync(new URL(`recolor/${directory}/`, folder), { recursive: true });
}
for (const model of manifest.models) for (const [viewKey, view] of Object.entries(model.views)) {
  const sourceBytes = readFileSync(new URL(view.file, folder));
  if (sha(sourceBytes) !== view.sha256) throw new Error(`Source changed: ${view.file}`);
  const source = PNG.sync.read(sourceBytes);
  const stem = view.file.replace('.png', '');
  const map = PNG.sync.read(readFileSync(new URL(`recolor/regions/${stem}.png`, folder)));
  const { width, height } = source, n = width * height;
  if (map.width !== width || map.height !== height) throw new Error('Region dimensions differ');
  const masks = Object.fromEntries(channels.map(c => [c, new Uint8Array(n)]));
  const labels = new Uint8Array(n);
  const samples = channels.map(() => []);
  for (let i = 0; i < n; i++) {
    const p = i * 4, r = map.data[p], g = map.data[p + 1], b = map.data[p + 2];
    const c = r === 255 && b === 255 && g === 0 ? 1 : r === 255 && g === 255 && b === 0 ? 2 : g === 255 && r === 0 && b === 0 ? 3 : 0;
    if (!c) {
      if (r || g || b) throw new Error('Invalid semantic region code');
      continue;
    }
    if (!source.data[p + 3]) throw new Error('Mask spills beyond source alpha');
    labels[i] = c;
    masks[channels[c - 1]][i] = 255;
    if (source.data[p + 3] > 200) samples[c - 1].push(source.data[p]);
  }
  // High-percentile fill brightness provides neutral shading independent of
  // source hue. All non-target RGB bytes and EVERY source alpha byte stay exact.
  const referenceRed = samples.map(values => {
    values.sort((a, b) => a - b);
    if (!values.length) throw new Error('Empty recolor channel');
    return values[Math.floor((values.length - 1) * .99)];
  });
  const neutral = Buffer.from(source.data);
  for (let i = 0; i < n; i++) if (labels[i]) {
    const gray = Math.min(255, Math.round(source.data[i * 4] / referenceRed[labels[i] - 1] * 255));
    neutral.fill(gray, i * 4, i * 4 + 3);
  }
  const write = (path, data, options) => {
    const bytes = PNG.sync.write({ width, height, data }, options);
    writeFileSync(new URL(path, folder), bytes);
    return { file: path, sha256: sha(bytes) };
  };
  const artifacts = { masks: {} };
  for (const channel of channels) {
    const data = Buffer.alloc(n * 4, 255);
    for (let i = 0; i < n; i++) data.fill(masks[channel][i], i * 4, i * 4 + 3);
    artifacts.masks[channel] = write(`recolor/masks/${stem}-${channel}.png`, data, { colorType: 0 });
  }
  artifacts.neutral = write(`recolor/neutral/${stem}.png`, neutral);
  const schemes = {
    diagnostic: { hair: '#FF00FF', eyes: '#FFFF00', skin: '#00FF00' },
    light: { hair: '#D3AE63', eyes: '#668CAA', skin: '#F3D8D0' },
    dark: { hair: '#181514', eyes: '#35251C', skin: '#3F2A22' },
    mixed: { hair: '#B5683C', eyes: '#627B55', skin: '#966542' },
  };
  for (const [name, scheme] of Object.entries(schemes)) {
    const colors = Object.fromEntries(channels.map(c => [c, hexToRgb(scheme[c])]));
    write(`recolor/previews/${stem}-${name}.png`, Buffer.from(recolorAvatar(neutral, masks, colors)));
  }
  reports.push({ modelId: model.id, viewKey, referenceRed, artifacts, pixelCounts: Object.fromEntries(channels.map(c => [c, masks[c].reduce((n, v) => n + +(v > 0), 0)])) });
}
writeFileSync(new URL('recolor/build-report.json', folder), JSON.stringify({ version: 1, algorithm: 'source-registered-semantic-masks-v1', reports }, null, 2) + '\n');
console.log(JSON.stringify(reports.map(r => ({ modelId: r.modelId, viewKey: r.viewKey, pixels: r.pixelCounts }))));

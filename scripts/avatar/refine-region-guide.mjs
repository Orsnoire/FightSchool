// Convert an image-generation segmentation guide into technical control data.
// The source image is never edited. Geometry and alpha always come from source.
// Usage: node scripts/avatar/refine-region-guide.mjs source.png guide.png map.png
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [sourcePath, guidePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !guidePath || !outputPath) throw new Error('Expected source, guide and output paths');
const source = PNG.sync.read(readFileSync(sourcePath));
const guide = PNG.sync.read(readFileSync(guidePath));
if (source.width !== guide.width || source.height !== guide.height) throw new Error('Guide dimensions differ');
const { width, height } = source;
const n = width * height;
const labels = new Uint8Array(n);
const possible = new Uint8Array(n);
const queue = new Uint32Array(n);
let head = 0, tail = 0;
const code = (r, g, b) => r > 100 && b > 100 && g < 50 ? 1
  : r > 100 && g > 100 && b < 50 ? 2
  : g > 100 && r < 50 && b < 50 ? 3 : 0;
const compatible = (i, c) => {
  const r = source.data[i * 4], b = source.data[i * 4 + 2];
  // Brows are deliberately darker/warmer than scalp hair in the originals.
  return c === 1 ? (b / r > .34 || r < 100) : b / r < .44;
};
for (let i = 0; i < n; i++) {
  const p = i * 4;
  const [r, g, b, a] = source.data.subarray(p, p + 4);
  // Warm source paint, excluding neutral clothing, whites, and solid black ink.
  possible[i] = +(a > 0 && r > 10 && r - b > 6 && r - g > 3 && g - b > 1 && (r - b) / r > .30);
  const c = code(guide.data[p], guide.data[p + 1], guide.data[p + 2]);
  if (possible[i] && c && compatible(i, c)) {
    labels[i] = c;
    queue[tail++] = i;
  }
}
// Expand within connected ORIGINAL painted pixels, never the generated outline.
// Hue compatibility prevents a tiny open ink seam from joining hair and skin.
while (head < tail) {
  const i = queue[head++], c = labels[i], x = i % width;
  for (const j of [x ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
    if (j < 0 || j >= n || labels[j] || !possible[j] || !compatible(j, c)) continue;
    labels[j] = c;
    queue[tail++] = j;
  }
}
// Tiny antialiased islands can be disconnected from their fill by the ink.
// A nearby semantic guide class may label them, still subject to source paint.
for (let i = 0; i < n; i++) {
  if (!possible[i] || labels[i]) continue;
  const x = i % width, y = Math.floor(i / width);
  let best = 145, selected = 0;
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
    const d = dx * dx + dy * dy;
    if (d >= best || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
    const j = ((y + dy) * width + x + dx) * 4;
    const c = code(guide.data[j], guide.data[j + 1], guide.data[j + 2]);
    if (c && compatible(i, c)) { best = d; selected = c; }
  }
  labels[i] = selected;
}
const map = Buffer.alloc(n * 4);
const colors = [[0, 0, 0], [255, 0, 255], [255, 255, 0], [0, 255, 0]];
const counts = [0, 0, 0, 0];
for (let i = 0; i < n; i++) {
  map.set(colors[labels[i]], i * 4);
  map[i * 4 + 3] = 255;
  counts[labels[i]]++;
}
writeFileSync(outputPath, PNG.sync.write({ width, height, data: map }));
console.log(JSON.stringify({ output: outputPath, counts }));

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const assetRoot = 'attached_assets/characters/human/v1/';
const manifest = JSON.parse(readFileSync(new URL(assetRoot + 'manifest.json', root), 'utf8'));
const routes = new Map([
  ['/', ['scripts/avatar/preview.html', 'text/html; charset=utf-8']],
  ['/avatar-recolor.mjs', ['shared/avatar-recolor.mjs', 'text/javascript; charset=utf-8']],
  ['/manifest.json', [assetRoot + 'manifest.json', 'application/json']],
]);
for (const model of manifest.models) for (const view of Object.values(model.views)) {
  for (const file of [view.file, view.neutralBaseFile, ...Object.values(view.recolorMasks)]) {
    if (file) routes.set('/assets/' + file, [assetRoot + file, 'image/png']);
  }
}
// Loopback only, with an exact allowlist: never serve credentials or arbitrary
// repository files through this development preview.
createServer((req, res) => {
  const route = routes.get(new URL(req.url, 'http://localhost').pathname);
  if (req.method !== 'GET' || !route) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const data = readFileSync(new URL(route[0], root));
    res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  } catch { res.writeHead(500); res.end('Preview asset unavailable'); }
}).listen(4178, '127.0.0.1', () => console.log('Avatar color preview: http://127.0.0.1:4178'));

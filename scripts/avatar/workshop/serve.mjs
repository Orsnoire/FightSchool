import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const page = new URL('../../../attached_assets/characters/human/rig-prototype-v1/preview/workshop.html', import.meta.url);
createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/') { res.writeHead(404);res.end('Not found');return; }
  try { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });res.end(readFileSync(page)); }
  catch { res.writeHead(500);res.end('Run npm run build:avatar-workshop first.'); }
}).listen(4179, '127.0.0.1', () => console.log('Character workshop: http://127.0.0.1:4179'));

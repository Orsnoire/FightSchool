import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

type Chunk = { file: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[]; css?: string[] };
// Run `npm run build:client -- --manifest` first. Count every static dependency,
// including modulepreloads, and add a route's dynamic entry when it exists.
export async function measureInitialLoading(directory = 'dist/public') {
  const manifest: Record<string, Chunk> = JSON.parse(await readFile(resolve(directory, '.vite/manifest.json'), 'utf8'));
  const entries = Object.keys(manifest).filter(key => manifest[key].isEntry);
  if (!entries.length) throw new Error('Build manifest has no HTML entry');
  async function workload(...routes: string[]) {
    const visited = new Set<string>();
    const visit = (key: string) => {
      if (visited.has(key)) return;
      const chunk = manifest[key];
      if (!chunk) throw new Error(`Missing manifest dependency: ${key}`);
      visited.add(key);
      for (const dependency of chunk.imports || []) visit(dependency);
    };
    entries.forEach(visit);
    for (const route of routes) if (manifest[route]) visit(route);
    const js = [...new Set([...visited].map(key => manifest[key].file).filter(file => file.endsWith('.js')))];
    const css = [...new Set([...visited].flatMap(key => manifest[key].css || []))];
    async function sizes(files: string[]) {
      return Promise.all(files.sort().map(async file => {
        const contents = await readFile(resolve(directory, file));
        return { file, bytes: contents.length, gzipBytes: gzipSync(contents).length };
      }));
    }
    const javascript = await sizes(js), styles = await sizes(css);
    return {
      javascript, styles,
      javascriptBytes: javascript.reduce((n, f) => n + f.bytes, 0),
      javascriptGzipBytes: javascript.reduce((n, f) => n + f.gzipBytes, 0),
      cssGzipBytes: styles.reduce((n, f) => n + f.gzipBytes, 0),
    };
  }
  return {
    sourceRef: process.env.MEASURE_SOURCE_REF || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version,
    lockfileSha256: createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),
    method: 'Production Vite manifest static-import closure plus the requested route; gzip default level per asset. Dynamic editors are excluded until used, then measured separately. CSS is recorded separately.',
    workloads: {
      teacherLogin: await workload('src/pages/Login.tsx'),
      studentLogin: await workload('src/pages/StudentLogin.tsx'),
      dashboard: await workload('src/pages/TeacherDashboard.tsx'),
      authoring: await workload('src/pages/CreateFight.tsx'),
      studentMath: await workload('src/pages/Combat.tsx', 'src/components/MathEditorImpl.tsx'),
    },
    totalJavaScriptChunks: Object.values(manifest).filter(chunk => chunk.file.endsWith('.js')).length,
  };
}

if (process.argv[1]?.endsWith('measure-initial-loading.ts')) {
  const output = process.argv[2] || '/tmp/c07-loading.json';
  const report = await measureInitialLoading(process.argv[3]);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, loginGzipBytes: report.workloads.teacherLogin.javascriptGzipBytes, studentLoginGzipBytes: report.workloads.studentLogin.javascriptGzipBytes, chunks: report.totalJavaScriptChunks }));
}

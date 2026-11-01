/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import Image from '@/app/games/[slug]/opengraph-image';
import { getGameBySlug } from '@/lib/games/queries';
jest.mock('@/lib/games/queries', () => ({ getGameBySlug: jest.fn() }));
test('unknown game has no image card', async () => {
  (getGameBySlug as jest.Mock).mockResolvedValue(null);
  const response = await Image({ params: Promise.resolve({ slug: 'missing' }) });
  expect(response.status).toBe(404);
});
test.each([false, true])('renders Cyrillic winner in a 1200 by 630 PNG, photo: %s', async (withPhoto) => {
  const result = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const Module = require('node:module');
    const ts = require('typescript');
    for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
      module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
      }).outputText, filename);
    };
    const load = Module._load;
    Module._load = function(id, parent, main) {
      if (id === '@/lib/games/queries') return { getGameBySlug: async () => ({
        session: { createdAt: '2026-10-31T12:00:00Z' }, winner: { playerId: 'p1', name: 'Александра' }, bank: 19000, photos: ${withPhoto ? JSON.stringify([{ url: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#64748b"/></svg>').toString('base64') }]) : '[]'}, images: []
      }) };
      return load.call(this, id.startsWith('@/') ? process.cwd() + '/' + id.slice(2) : id, parent, main);
    };
    require('./app/games/[slug]/opengraph-image.tsx').default({ params: Promise.resolve({ slug: 'fixture' }) })
      .then(async response => process.stdout.write(Buffer.from(await response.arrayBuffer())))
      .catch(error => { console.error(error); process.exit(1); });
  `], { cwd: process.cwd(), maxBuffer: 5 * 1024 * 1024 });
  expect(result.stderr.toString()).toBe('');
  expect(result.status).toBe(0);
  const png = result.stdout;
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

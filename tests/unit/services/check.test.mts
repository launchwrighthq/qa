import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { describe, expect, it } from 'vitest';
import { qaConfigOf } from '../../../src/config.mts';
import {
  bundleFindings,
  C3_PATTERNS,
  c3Findings,
  findingLine,
  isQaFile,
  projectWaitFindings,
  runChecks,
  waitFindings,
  worldFindings,
} from '../../../src/services/check.mts';

const GENERATED = '2026-01-01T00:00:00.000Z';
const MARKER = 'lw-qa-dev-only';

async function project(files: Record<string, string>): Promise<string> {
  const root = await tmpDir();
  for (const [file, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), text);
  }
  return root;
}

const ROUTES = "export default routes((r) => r.group({ name: 'public' }, (g) => { g.page('/', 'home'); }));";
const HOME = 'export default function Home() { return null; }';
const WORLD = "export default { personas: [{ id: 'member', summary: 'A member', seed: async () => ({ userId: 'u1' }) }] };\n";

describe('rule C3: no component reads ?qa= or a QA flag', () => {
  const hits: Array<[string, string]> = [
    ['query', "const next = `${location.pathname}?qa=${persona}`;"],
    ['search-params', "const persona = new URLSearchParams(location.search).get('qa');"],
    ['search-params', 'if (params.has("qa")) return null;'],
    ['param-constant', 'const p = url.searchParams.get(QA_PERSONA_PARAM);'],
    ['env-flag', 'if (import.meta.env.VITE_QA_MODE) show();'],
    ['env-flag', 'const on = process.env.QA_FLAG === "1";'],
    ['global-flag', 'if (window.__lwQa) return <Fake />;'],
    ['flag-name', 'export const Banner = ({ isQa }: Props) => (isQa ? null : <b />);'],
  ];

  it.each(hits)('finds the %s pattern', (name, line) => {
    const pattern = C3_PATTERNS.find((p) => p.name === name);
    expect(pattern?.pattern.test(line)).toBe(true);
    const findings = c3Findings('apps/client/src/a.tsx', `import x from 'y';\n${line}\n`);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ rule: 'C3', file: 'apps/client/src/a.tsx', line: 2 });
  });

  it('passes ordinary code that names neither the parameter nor a flag', () => {
    const text = [
      "const q = new URLSearchParams(location.search).get('quality');",
      "const href = '/shop?quantity=2';",
      'window.__lwFakeTelegram = diag;',
      'const equality = a === b;',
    ].join('\n');
    expect(c3Findings('apps/client/src/b.tsx', text)).toEqual([]);
  });

  it('skips a comment line that names the parameter', () => {
    expect(c3Findings('apps/client/src/c.tsx', '// the dev host strips ?qa= before the bundle runs\n * isQa is gone\n')).toEqual([]);
  });

  it('skips a file that carries the dev-only marker', () => {
    expect(c3Findings('apps/client/src/dev/launch.ts', `export const MARK = '${MARKER}';\nconst p = params.get('qa');\n`)).toEqual([]);
  });
});

describe('the waitForTimeout ban in QA files', () => {
  it('finds a call and skips a comment', () => {
    const text = ['// never waitForTimeout here', 'await page.waitForTimeout(500);'].join('\n');
    expect(waitFindings('qa/flows/x.mts', text).map((f) => [f.rule, f.line])).toEqual([['wait', 2]]);
  });

  it('names world files, shot manifests and code under a qa folder as QA files', () => {
    expect(isQaFile('apps/api/src/telegram/start.world.mts', 'docs/qa')).toBe(true);
    expect(isQaFile('docs/qa/2026-01-01-x.shots.json', 'docs/qa')).toBe(true);
    expect(isQaFile('qa/flows/drive.mts', 'docs/qa')).toBe(true);
    expect(isQaFile('apps/client/src/qa/panel.tsx', 'docs/qa')).toBe(true);
    expect(isQaFile('apps/client/src/home.tsx', 'docs/qa')).toBe(false);
    expect(isQaFile('docs/qa/2026-01-01-x.md', 'docs/qa')).toBe(false);
    expect(isQaFile('docs/qa/assets/x/log.json', 'docs/qa')).toBe(false);
    expect(isQaFile('docs/qa/dist/x.js', 'docs/qa/')).toBe(false);
  });

  it('reports every QA file of a project that waits on time, and skips node_modules', async () => {
    const root = await project({
      'qa/flows/drive.mts': 'await page.waitForTimeout(1000);\n',
      'apps/api/src/shop/shop.world.mts': 'await new Promise((r) => setTimeout(r, 5));\n',
      'docs/qa/x.shots.json': '{ "act": [{ "waitForTimeout": 300 }] }\n',
      'apps/client/src/home.tsx': 'await page.waitForTimeout(1000);\n',
      'node_modules/pkg/qa/x.mts': 'await page.waitForTimeout(1000);\n',
    });
    expect((await projectWaitFindings(root, 'docs/qa')).map((f) => f.file)).toEqual(['docs/qa/x.shots.json', 'qa/flows/drive.mts']);
  });
});

describe('rule S1: world files', () => {
  it('fails raw SQL and a feature with a client route but no world file', async () => {
    const root = await project({
      'apps/api/src/telegram/open.feature.mts': "export default { commands: { open: (ctx) => ctx.reply('x', { keyboard: [[{ text: 'Open', web_app: { url } }]] }) } };\n",
      'apps/api/src/telegram/help.feature.mts': 'export default { commands: { help: (ctx) => ctx.reply("help") } };\n',
      'apps/api/src/telegram/shop.feature.mts': 'export default { miniAppUrl };\n',
      'apps/api/src/telegram/shop.world.mts': 'await db.execute(sql`delete from x`);\n',
    });
    const findings = await worldFindings(root);
    expect(findings.map((f) => [f.rule, f.file, f.line])).toEqual([
      ['S1', 'apps/api/src/telegram/shop.world.mts', 1],
      ['S1', 'apps/api/src/telegram/open.feature.mts', 0],
    ]);
    expect(findings[1]?.message).toContain('has no open.world.mts beside it');
  });
});

describe('rule S3: the production bundle marker', () => {
  it('fails a build file that holds the marker, with its line', async () => {
    const root = await project({
      'apps/client/dist/index.html': '<html></html>',
      'apps/client/dist/assets/app.js': `var a=1;\nvar b="${MARKER}";\n`,
    });
    const findings = await bundleFindings(root, ['apps/client/dist'], false);
    expect(findings).toEqual([expect.objectContaining({ rule: 'S3', file: 'apps/client/dist/assets/app.js', line: 2 })]);
  });

  it('passes a clean build', async () => {
    const root = await project({ 'apps/client/dist/assets/app.js': 'var a=1;\n' });
    expect(await bundleFindings(root, ['apps/client/dist'], true)).toEqual([]);
  });

  it('reports a missing build folder only when a build is required', async () => {
    const root = await project({});
    expect(await bundleFindings(root, ['apps/client/dist'], false)).toEqual([]);
    expect(await bundleFindings(root, ['apps/client/dist'], true)).toEqual([expect.objectContaining({ rule: 'S3', file: 'apps/client/dist', line: 0 })]);
  });
});

describe('runChecks', () => {
  const qa = qaConfigOf({});

  it('passes a project that keeps every rule', async () => {
    const root = await project({
      'apps/api/src/routes.mts': ROUTES,
      'apps/client/src/pages/home.page.tsx': HOME,
      'apps/client/src/tile.tsx': "export type TileState = 'a' | 'b';\nexport interface TileProps { state: TileState }\nexport const Tile = (p: TileProps) => null;",
      'qa/members.world.mts': WORLD,
      'apps/client/dist/assets/app.js': 'var a=1;\n',
    });
    expect(await runChecks({ root, qa, generated: GENERATED, requireBuild: true })).toEqual([]);
  });

  it('reports a neither union, a QA flag, raw SQL, a wait and the marker, sorted by rule', async () => {
    const root = await project({
      'apps/api/src/routes.mts': ROUTES,
      'apps/client/src/pages/home.page.tsx': "export default function Home() { return new URLSearchParams(location.search).get('qa'); }",
      'apps/client/src/menu.ts': "export type MenuPhase = 'idle' | 'busy';\n",
      'qa/members.world.mts': 'await db.execute(sql`truncate users`);\nawait page.waitForTimeout(10);\n',
      'apps/client/dist/assets/app.js': MARKER,
    });
    const findings = await runChecks({ root, qa, generated: GENERATED, requireBuild: false });
    expect(findings.map((f) => [f.rule, f.file, f.line])).toEqual([
      ['C1', 'apps/client/src/menu.ts', 1],
      ['C3', 'apps/client/src/pages/home.page.tsx', 1],
      ['S1', 'qa/members.world.mts', 1],
      ['S3', 'apps/client/dist/assets/app.js', 1],
      ['wait', 'qa/members.world.mts', 2],
    ]);
    expect(findingLine(findings[0]!)).toMatch(/^C1 apps\/client\/src\/menu\.ts:1 MenuPhase is neither an input nor an output/);
  });
});

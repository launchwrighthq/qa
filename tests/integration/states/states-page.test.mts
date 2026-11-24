import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir } from '../../../src/kernel/testing/index.mts';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { keepsHtmlTransform, type QaStatesOptions, qaStatesPage } from '../../../src/states-host/vite.mts';

/** A project plugin that rewrites every HTML page it sees, as an app shell plugin does. */
const projectShell: Plugin = {
  name: 'project-shell',
  transformIndexHtml: (html) => html.replace('<body>', '<body><script>window.projectShell = true;</script>'),
};

/** The same rewrite as an object hook with an order. Both plugin objects serve every server of the file, as a reused config does. */
const projectMeta: Plugin = {
  name: 'project-meta',
  transformIndexHtml: { order: 'pre', handler: (html) => html.replace('<head>', '<head><meta name="project-meta" content="1">') },
};

let server: ViteDevServer | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function serve(options: Partial<QaStatesOptions> = {}): Promise<{ page: string; index: string }> {
  const root = await tmpDir();
  writeFileSync(join(root, 'index.html'), '<!doctype html><html><head></head><body><div id="app"></div></body></html>');
  writeFileSync(join(root, 'Tile.tsx'), 'export const Tile = () => null;');
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false, ws: false },
    plugins: [projectShell, projectMeta, qaStatesPage({ framework: 'solid', components: { Tile: './Tile.tsx' }, ...options })],
  });
  await server.listen();
  const origin = server.resolvedUrls?.local[0]?.replace(/\/$/, '');
  if (origin === undefined) throw new Error('the dev server gave no local URL');
  const page = await (await fetch(`${origin}/__states?c=Tile`)).text();
  const index = await (await fetch(`${origin}/`)).text();
  return { page, index };
}

describe('state page HTML transforms', () => {
  it('keeps Vite and leaves out the project HTML hooks by default, while the app page keeps them', async () => {
    const { page, index } = await serve();
    expect(page).toContain('/@vite/client');
    expect(page).toContain('data-qa-states');
    expect(page).not.toContain('projectShell');
    expect(page).not.toContain('project-meta');
    expect(index).toContain('window.projectShell = true;');
    expect(index).toContain('<meta name="project-meta" content="1">');
  });

  it('runs every project hook with htmlTransforms all, and the named ones with a list', async () => {
    expect((await serve({ htmlTransforms: 'all' })).page).toContain('window.projectShell = true;');
    await server?.close();
    const listed = (await serve({ htmlTransforms: ['project-meta'] })).page;
    expect(listed).toContain('<meta name="project-meta" content="1">');
    expect(listed).not.toContain('projectShell');
  });

  it('keeps the hooks of Vite and its official plugins under every setting', () => {
    expect(keepsHtmlTransform('vite:react-refresh')).toBe(true);
    expect(keepsHtmlTransform('project-shell')).toBe(false);
    expect(keepsHtmlTransform('project-shell', 'all')).toBe(true);
    expect(keepsHtmlTransform('project-shell', ['project-shell'])).toBe(true);
  });
});

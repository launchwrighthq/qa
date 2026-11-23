// The harness items of the QA library (spec 2.13, R20, R21): harness.toml names five skills and
// one rule, each file exists, and the finish step of lw-qa-pass demands `lw qa report check`.
// The harness module has no fixture format for a skill, so this guard reads the skill text.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'smol-toml';
import { describe, expect, it } from 'vitest';

const MODULE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface Manifest {
  skill?: Array<{ id: string; dir: string }>;
  rule?: Array<{ id: string; file: string; paths?: string[] }>;
}

const manifest = parse(readFileSync(join(MODULE_ROOT, 'harness.toml'), 'utf8')) as unknown as Manifest;
const skillText = (id: string): string => readFileSync(join(MODULE_ROOT, 'harness', 'skills', id, 'SKILL.md'), 'utf8');

/** The `{{lw:<key>}}` values that `lw harness sync` fills in. */
const TEMPLATE_KEYS = new Set(['adapterDir', 'baseBranch', 'gateCommand', 'landCommand', 'envCommand', 'memoryIndex']);

/** The text of one `## <n>. <title>` section, up to the next `## ` heading outside a code fence. */
function section(text: string, heading: RegExp): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return '';
  let fenced = false;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.startsWith('```')) fenced = !fenced;
    else if (!fenced && line.startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

describe('qa harness manifest', () => {
  it('names the five lw-qa skills and the qa-testability rule', () => {
    expect((manifest.skill ?? []).map((s) => s.id)).toEqual(['lw-qa-pass', 'lw-qa-worktree', 'lw-qa-device', 'lw-qa-intake', 'lw-qa-world']);
    expect((manifest.rule ?? []).map((r) => [r.id, r.file])).toEqual([['qa-testability', 'harness/rules/qa-testability.md']]);
  });

  it('points each item at a file whose front matter names the skill', () => {
    for (const s of manifest.skill ?? []) {
      expect(s.dir).toBe(`harness/skills/${s.id}`);
      expect(skillText(s.id)).toMatch(new RegExp(`^---\\nname: ${s.id}\\ndescription: .+\\n---\\n`));
    }
    for (const r of manifest.rule ?? []) expect(existsSync(join(MODULE_ROOT, r.file))).toBe(true);
  });

  it('uses only the template keys that sync fills in', () => {
    const files = [...(manifest.skill ?? []).map((s) => join(MODULE_ROOT, s.dir, 'SKILL.md')), ...(manifest.rule ?? []).map((r) => join(MODULE_ROOT, r.file))];
    const keys = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\{\{lw:([A-Za-z]+)\}\}/g)].map((m) => m[1] as string));
    expect(keys.filter((k) => !TEMPLATE_KEYS.has(k))).toEqual([]);
  });

  it('reads the product facts of lw-qa-pass and lw-qa-device from their adapters', () => {
    expect(skillText('lw-qa-pass')).toContain('{{lw:adapterDir}}/qa-pass/');
    expect(skillText('lw-qa-device')).toContain('{{lw:adapterDir}}/qa-device/');
  });
});

describe('lw-qa-pass finish step (R21)', () => {
  const text = skillText('lw-qa-pass');

  it('keeps the nine steps of the source in order', () => {
    const steps = [...text.matchAll(/^## (\d)\. (.+)$/gm)].map((m) => `${m[1]} ${m[2]}`);
    expect(steps).toEqual([
      '1 Resolve what this pass is about',
      '2 Write sections 1 and 2 before any browser opens',
      '3 The world, and an address for every state',
      '4 Derive the rows from prose',
      '5 Run',
      '6 Videos',
      '7 The report',
      '8 Language',
      '9 Finish',
    ]);
  });

  it('is done only when lw-qa report check exits 0', () => {
    const finish = section(text, /^## 9\. Finish$/);
    expect(finish).toContain('lw-qa report check docs/qa/<slug>.md');
    expect(finish).toMatch(/The pass is done only when it exits 0\./);
    expect(finish).toMatch(/Until then, report the\s+pass as not done/);
    expect(finish.indexOf('lw-qa report update')).toBeLessThan(finish.indexOf('lw-qa report check'));
    expect(text).toMatch(/^description: .*The pass is done only when lw-qa report check exits 0\.$/m);
  });

  it('writes section 3 with lw-qa report update, never by hand', () => {
    const report = section(text, /^## 7\. The report$/);
    expect(report).toContain('lw-qa report update docs/qa/<slug>.md');
    expect(report).toContain('Never type section 3');
  });

  it('takes a range, a spec or issues as input', () => {
    const resolve = section(text, /^## 1\. Resolve/);
    expect(resolve).toContain('lw-qa changes --since');
    expect(resolve).toContain('lw-qa session resolve docs/specs/<name>.md');
    expect(resolve).toContain('lw-qa session resolve --issue <id>');
  });
});

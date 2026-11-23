// The `lw-qa` command (spec 2.13): a consumer runs `lw-qa <subcommand>` without the framework CLI.
// It reads the plain local config file `qa.toml` (or `.lw/qa.toml`) the library documents, then
// delegates to the same subcommand dispatch the framework's `lw qa` uses.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { qaCommand } from '../commands/qa.command.mts';
import { qaExtension as deviceExtension } from '../device/services/extension.mts';
import { qaExtension as intakeExtension } from '../intake/services/extension.mts';

/** The config sections from the project's `qa.toml`, or `{}` when none exists (defaults apply). */
function loadSections(cwd: string): Record<string, unknown> {
  for (const name of ['qa.toml', '.lw/qa.toml']) {
    const path = join(cwd, name);
    if (!existsSync(path)) continue;
    const parsed = parseToml(readFileSync(path, 'utf8')) as Record<string, unknown>;
    return 'qa' in parsed ? parsed : { qa: parsed };
  }
  return {};
}

const cwd = process.cwd();
const code = await qaCommand.run(process.argv.slice(2), {
  cwd,
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  config: loadSections(cwd),
  env: process.env.LW_ENV ?? 'local',
  processEnv: process.env,
  commandName: 'lw-qa',
  extensions: [deviceExtension, intakeExtension],
});
process.exit(code);

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

/**
 * Resolves when the OS has every chunk that `stream` queued before this call. On a pipe, Node
 * writes stdout and stderr asynchronously, so an exit before this point drops the queued tail. A
 * write error still resolves: the stream emits it as its own `error` event.
 */
function flushed(stream: NodeJS.WriteStream): Promise<void> {
  return new Promise((done) => {
    stream.write('', () => done());
  });
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
process.exitCode = code;
await Promise.all([flushed(process.stdout), flushed(process.stderr)]);
// The exit after the flush ends a command that left a handle open, such as a client socket. A
// long-running command (serve, sink, telegram) returns from `run` only after its own signal stop.
process.exit(code);

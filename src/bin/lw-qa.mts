// The `lw-qa` command (spec 2.13): a consumer runs `lw-qa <subcommand>` without the framework CLI.
// It reads the plain local config file `qa.toml` (or `.lw/qa.toml`) the library documents, then
// delegates to the same subcommand dispatch the framework's `lw qa` uses.
import { qaCommand } from '../commands/qa.command.mts';
import { qaExtension as deviceExtension } from '../device/services/extension.mts';
import { qaExtension as intakeExtension } from '../intake/services/extension.mts';
import { isCodedError } from '../kernel/index.mts';
import { loadQaToml } from '../services/qa-toml.mts';

/** The config sections of `qa.toml` with the env references filled, or exit 2 with the coded error. */
function loadSections(cwd: string): Record<string, unknown> {
  try {
    return loadQaToml(cwd, process.env);
  } catch (err) {
    if (!isCodedError(err)) throw err;
    process.stderr.write(`lw-qa: ${err.message} [${err.code}]\n`);
    process.exit(2);
  }
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

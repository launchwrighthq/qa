// The `KEY=value` parse of the framework dev module, which `lw qa worktree` gets as `deps.parseEnv`.
const KEY_LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

/** The values of an env file text. A value in matching single or double quotes loses the quotes. */
export function parseEnvText(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = KEY_LINE.exec(line.trim());
    if (!match) continue;
    let value = match[2] as string;
    const first = value[0];
    if (value.length >= 2 && (first === '"' || first === "'") && value.endsWith(first)) value = value.slice(1, -1);
    values[match[1] as string] = value;
  }
  return values;
}

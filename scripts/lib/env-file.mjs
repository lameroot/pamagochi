import { readFileSync, existsSync } from 'node:fs';

/**
 * Minimal dotenv-style parser (no external dependency) used by the
 * orchestration scripts. Returns an object of KEY -> value. Lines starting
 * with `#` and blank lines are ignored. Never logs values.
 */
export function parseEnvFile(path) {
  if (!existsSync(path)) return {};

  const content = readFileSync(path, 'utf8');
  const result = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function loadEnvFileInto(path, target = process.env) {
  const parsed = parseEnvFile(path);
  for (const [key, value] of Object.entries(parsed)) {
    target[key] = value;
  }
  return parsed;
}

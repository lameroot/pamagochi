#!/usr/bin/env node
/**
 * Guards against real credentials accidentally being committed into
 * `*.example` env files (which are meant to be safe, placeholder-only
 * templates tracked in git). Scans for patterns that look like real
 * secrets: JWTs, Postgres connection strings with a real-looking
 * password, and long hex/base64-ish strings assigned to *_KEY/*_SECRET/
 * *_TOKEN/*_PASSWORD variables.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files "*.example"', {
  cwd: process.cwd(),
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const PATTERNS = [
  { name: 'JWT-like token', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  {
    name: 'Postgres connection string with a real-looking password',
    re: /postgresql:\/\/[^:\s]+:(?!replace-me|password|pamagochi\b)[A-Za-z0-9]{8,}@/,
  },
  {
    name: 'long secret-shaped value assigned to a *_KEY/*_SECRET/*_TOKEN/*_PASSWORD variable',
    // Placeholder values are expected to read as human instructions
    // ("replace-with-...", "replace-me", "your-...") — real secrets never
    // contain hyphenated English words like "replace" or "with".
    re: /^[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)\s*=\s*(?!replace-|your-|<|CHANGE_ME)[A-Za-z0-9+/_]{20,}$/m,
  },
];

let hasIssues = false;

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    for (const { name, re } of PATTERNS) {
      if (re.test(line)) {
        hasIssues = true;
        const [key] = line.split('=');
        console.error(`✗ ${file}: possible real secret in "${key}" (${name})`);
      }
    }
  }
}

if (hasIssues) {
  console.error(
    '\nRefusing to proceed: one or more *.example files appear to contain real credentials ' +
      'instead of placeholders. Replace them with placeholder values (e.g. "replace-me") before committing.',
  );
  process.exit(1);
}

console.log(`Checked ${files.length} example env file(s), no real-looking secrets found.`);

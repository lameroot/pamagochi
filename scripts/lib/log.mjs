const SECRET_KEY_PATTERN = /(secret|password|token|key|database_url|direct_database_url)/i;

/** Never print raw env values; only key names, for safe diagnostics. */
export function listSafeEnvKeys(env) {
  return Object.keys(env).filter((key) => !SECRET_KEY_PATTERN.test(key));
}

export function step(message) {
  console.log(`\n\u2192 ${message}`);
}

export function ok(message) {
  console.log(`  \u2713 ${message}`);
}

export function warn(message) {
  console.warn(`  ! ${message}`);
}

export function fail(message) {
  console.error(`  \u2717 ${message}`);
}

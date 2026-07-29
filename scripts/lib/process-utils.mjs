import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const activeChildren = new Set();
let signalsWired = false;

function wireSignalForwarding() {
  if (signalsWired) return;
  signalsWired = true;

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      for (const child of activeChildren) {
        child.kill(signal);
      }
    });
  }
}

export function spawnTracked(command, args, options = {}) {
  wireSignalForwarding();
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  activeChildren.add(child);
  child.on('exit', () => activeChildren.delete(child));
  return child;
}

export function runToCompletion(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnTracked(command, args, options);
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export function killAllTracked(signal = 'SIGTERM') {
  for (const child of activeChildren) {
    child.kill(signal);
  }
}

/**
 * Best-effort cleanup for leftover processes from a previous, imperfectly
 * terminated run (e.g. `node --watch` grandchildren that did not receive a
 * forwarded SIGTERM). Safe to call even if nothing is listening on the
 * port, and safe if `lsof` is unavailable.
 */
export async function killProcessesOnPort(port) {
  try {
    const { stdout } = await execFileAsync('lsof', ['-t', `-i:${port}`]);
    const pids = stdout
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter(
        (pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid && pid !== process.ppid,
      );
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Process may have already exited; ignore.
      }
    }
  } catch {
    // lsof not installed, or nothing listening on the port — nothing to do.
  }
}

export async function waitForHttpOk(url, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
      lastError = new Error(`Received status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timed out waiting for ${url} to respond OK: ${lastError?.message ?? 'unknown error'}`,
  );
}

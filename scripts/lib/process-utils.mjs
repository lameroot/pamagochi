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
        killChild(child, signal);
      }
    });
  }
}

export function spawnTracked(command, args, options = {}) {
  wireSignalForwarding();
  // `detached: true` puts the child in its own process group (POSIX), so we
  // can later signal the *whole* group (see killChild below). This matters
  // for multi-hop dev commands like `pnpm run dev` -> `sh -c` -> a watcher
  // script -> `tsc --watch` / `node --watch`, where a signal to just the
  // immediate child is not reliably forwarded all the way down, and
  // `node --watch` in particular can swallow SIGTERM for its currently
  // running module without the wrapper process itself exiting.
  const child = spawn(command, args, { stdio: 'inherit', detached: true, ...options });
  activeChildren.add(child);
  child.on('exit', () => activeChildren.delete(child));
  return child;
}

function killChild(child, signal) {
  if (child.pid === undefined) return;
  try {
    // Negative pid signals the entire process group created by `detached: true`.
    process.kill(-child.pid, signal);
  } catch {
    try {
      child.kill(signal);
    } catch {
      // Process (group) may have already exited; ignore.
    }
  }
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
    killChild(child, signal);
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

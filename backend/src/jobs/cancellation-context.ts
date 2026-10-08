import { AsyncLocalStorage } from 'node:async_hooks';
import { ChildProcess, execFileSync } from 'node:child_process';

export class ProcessingCancelled extends Error {
  constructor() {
    super('Processing cancelled');
  }
}

interface ExecutionContext {
  signal: AbortSignal;
  children: Set<Promise<void>>;
}
export const mediaExecution = new AsyncLocalStorage<ExecutionContext>();
export const cancellationSignal = () => mediaExecution.getStore()?.signal;
export function assertNotCancelled() {
  if (cancellationSignal()?.aborted) throw new ProcessingCancelled();
}

/** Track through close, not just exit: inherited file handles may still be open. */
export function trackCancellableProcess(proc: ChildProcess) {
  const context = mediaExecution.getStore();
  if (!context) return;
  let closed = false;
  let force: NodeJS.Timeout | undefined;
  const kill = (signal: NodeJS.Signals) => {
    if (!proc.pid) return;
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
          windowsHide: true,
          timeout: 2000,
          stdio: 'ignore',
        });
      } else process.kill(-proc.pid, signal);
    } catch {
      try {
        proc.kill(signal);
      } catch {
        /* already stopped */
      }
    }
  };
  const abort = () => {
    kill('SIGTERM');
    force = setTimeout(() => {
      if (!closed) kill('SIGKILL');
    }, 5000);
  };
  const done = new Promise<void>((resolve) => {
    proc.once('close', () => {
      // Stop descendants too, even if their supervisor exited first.
      if (context.signal.aborted) kill('SIGKILL');
      closed = true;
      if (force) clearTimeout(force);
      context.signal.removeEventListener('abort', abort);
      resolve();
    });
  });
  context.children.add(done);
  void done.then(() => context.children.delete(done));
  context.signal.addEventListener('abort', abort, { once: true });
  if (context.signal.aborted) abort();
}

export async function drainMediaChildren() {
  const context = mediaExecution.getStore();
  if (context) await Promise.all([...context.children]);
}

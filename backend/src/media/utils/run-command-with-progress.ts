import { spawn } from 'child_process';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import { hostCommand } from './host-command';
import {
  cancellationSignal,
  ProcessingCancelled,
} from '../../jobs/cancellation-context';

export function runCommandWithProgress(
  command: string,
  args: string[],
  onLine: (line: string) => void,
  processRegistry?: ProcessRegistryService,
): Promise<void> {
  const signal = cancellationSignal();
  return new Promise((resolve, reject) => {
    processRegistry?.assertRunning();
    const limited = hostCommand(command, args);
    const proc = spawn(limited.command, limited.args, {
      detached: true,
      windowsHide: true,
      env: limited.env,
    });
    processRegistry?.register(proc);

    let stderrBuffer = '';
    let stdoutBuffer = '';
    let fullStderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n|\r/);
      stdoutBuffer = lines.pop() || '';
      lines.forEach(onLine);
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      fullStderr = (fullStderr + text).slice(-4000);
      stderrBuffer += text;
      const lines = stderrBuffer.split(/\r?\n|\r/);
      stderrBuffer = lines.pop() || '';
      lines.forEach(onLine);
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (stdoutBuffer) onLine(stdoutBuffer);
      if (stderrBuffer) onLine(stderrBuffer);
      if (signal?.aborted) {
        reject(new ProcessingCancelled());
        return;
      }
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} exited with code ${code}: ${fullStderr.slice(-500)}`,
          ),
        );
    });
  });
}

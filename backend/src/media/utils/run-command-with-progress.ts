import { spawn } from 'child_process';
import { ProcessRegistryService } from '../../common/services/process-registry.service';
import { hostCommand } from './host-command';
import { usageExecution, usageSample } from '../../billing/usage-context';
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
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    processRegistry?.assertRunning();
    const limited = hostCommand(
      command,
      command === 'ffmpeg' && usageExecution.getStore()
        ? ['-benchmark', ...args]
        : args,
    );
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
      if (command === 'ffmpeg') {
        const cpu = fullStderr.match(/utime=([\d.]+)s stime=([\d.]+)s/);
        usageSample('ffmpeg', {
          wallSeconds: (Date.now() - startedAt) / 1000,
          cpuSeconds: cpu ? Number(cpu[1]) + Number(cpu[2]) : null,
          exitCode: code,
        });
      }
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

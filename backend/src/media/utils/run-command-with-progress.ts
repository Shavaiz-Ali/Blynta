import { spawn } from 'child_process';
import { ProcessRegistryService } from '../../common/services/process-registry.service';

export function runCommandWithProgress(
  command: string,
  args: string[],
  onLine: (line: string) => void,
  processRegistry?: ProcessRegistryService,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { detached: true });
    processRegistry?.register(proc);

    let stderrBuffer = '';
    let stdoutBuffer = '';
    let fullStderr = '';

    proc.stdout?.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n|\r/);
      stdoutBuffer = lines.pop() || '';
      lines.forEach(onLine);
    });

    proc.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      fullStderr += text;
      stderrBuffer += text;
      const lines = stderrBuffer.split(/\r?\n|\r/);
      stderrBuffer = lines.pop() || '';
      lines.forEach(onLine);
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${fullStderr.slice(-500)}`));
    });
  });
}

import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import { FfmpegCommand } from 'fluent-ffmpeg';

@Injectable()
export class ProcessRegistryService {
  private readonly logger = new Logger(ProcessRegistryService.name);
  private readonly activeProcesses = new Set<ChildProcess>();
  private readonly activeFfmpegCommands = new Set<FfmpegCommand>();

  /**
   * Call this immediately after spawn(), e.g.:
   *   const proc = spawn('yt-dlp', args, { detached: true });
   *   this.processRegistry.register(proc);
   */
  register(proc: ChildProcess): void {
    this.activeProcesses.add(proc);
    proc.once('exit', () => this.activeProcesses.delete(proc));
    proc.once('close', () => this.activeProcesses.delete(proc));
  }

  /**
   * Register fluent-ffmpeg command instance to be tracked and killed on shutdown.
   */
  registerFfmpeg(cmd: FfmpegCommand): void {
    this.activeFfmpegCommands.add(cmd);
    cmd.once('end', () => this.activeFfmpegCommands.delete(cmd));
    cmd.once('error', () => this.activeFfmpegCommands.delete(cmd));
  }

  /**
   * Called from the shutdown hook. Sends SIGTERM to every still-running
   * child / ffmpeg command, waits briefly, then SIGKILLs anything that didn't exit.
   */
  async killAll(timeoutMs = 5000): Promise<void> {
    const procCount = this.activeProcesses.size;
    const ffmpegCount = this.activeFfmpegCommands.size;

    if (procCount === 0 && ffmpegCount === 0) {
      return;
    }

    this.logger.warn(
      `Killing ${procCount} active child process(es) and ${ffmpegCount} active ffmpeg command(s) on shutdown`,
    );

    // 1. Signal fluent-ffmpeg commands
    const ffmpegCmds = Array.from(this.activeFfmpegCommands);
    for (const cmd of ffmpegCmds) {
      try {
        cmd.kill('SIGTERM');
      } catch (err) {
        this.logger.warn(`Failed to SIGTERM ffmpeg command: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Signal raw child processes (process group first)
    const procs = Array.from(this.activeProcesses);
    for (const proc of procs) {
      if (proc.pid) {
        try {
          // Negative PID sends the signal to the whole process group
          process.kill(-proc.pid, 'SIGTERM');
        } catch {
          try {
            proc.kill('SIGTERM');
          } catch {
            // ignore if already exited
          }
        }
      }
    }

    // Wait for graceful exit
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));

    // 3. Force kill any remaining ffmpeg commands
    for (const cmd of ffmpegCmds) {
      try {
        cmd.kill('SIGKILL');
      } catch {
        // ignore
      }
    }

    // 4. Force kill any remaining child processes
    for (const proc of procs) {
      if (!proc.killed && proc.pid) {
        this.logger.warn(`Force-killing process PID ${proc.pid} (did not exit after SIGTERM)`);
        try {
          process.kill(-proc.pid, 'SIGKILL');
        } catch {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
      }
    }

    this.activeProcesses.clear();
    this.activeFfmpegCommands.clear();
  }
}

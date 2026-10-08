import { EventEmitter } from 'node:events';
import { ChildProcess } from 'node:child_process';
import { ProcessRegistryService } from './process-registry.service';

describe('worker child shutdown', () => {
  it('blocks all new media commands once shutdown begins', () => {
    const registry = new ProcessRegistryService();
    registry.beginShutdown();
    expect(() => registry.assertRunning()).toThrow('shutting down');
  });
  it('escalates to SIGKILL even if a child has already been signalled', async () => {
    const registry = new ProcessRegistryService();
    const proc = Object.assign(new EventEmitter(), {
      pid: 1234,
      killed: true,
      kill: jest.fn(),
    });
    registry.register(proc as unknown as ChildProcess);
    const signal = jest.spyOn(process, 'kill').mockReturnValue(true);
    try {
      await registry.killAll(1);
      expect(signal).toHaveBeenCalledWith(-1234, 'SIGTERM');
      expect(signal).toHaveBeenCalledWith(-1234, 'SIGKILL');
    } finally {
      signal.mockRestore();
    }
  });
});

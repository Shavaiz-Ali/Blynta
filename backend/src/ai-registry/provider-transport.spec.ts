import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { ProviderTransport } from './provider-transport.service';
import type { AIProvider } from './registry.schemas';
jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));
const provider = { adapter: 'google' } as AIProvider;
const target =
  'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1';
describe('Pinned provider transport', () => {
  beforeEach(() => jest.resetAllMocks());
  it('blocks a private DNS result before HTTPS is called', async () => {
    jest
      .mocked(lookup)
      .mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never);
    await expect(
      new ProviderTransport().fetch(provider, new Request(target)),
    ).rejects.toThrow('Unsafe resolved');
    expect(request).not.toHaveBeenCalled();
  });
  it('pins the validated address, strips arbitrary headers and never follows redirects', async () => {
    jest
      .mocked(lookup)
      .mockResolvedValue([{ address: '142.250.70.10', family: 4 }] as never);
    let options: {
      headers: Record<string, string>;
      lookup: (
        host: string,
        options: { all: boolean },
        callback: (error: unknown, address: unknown, family?: number) => void,
      ) => void;
    };
    jest.mocked(request).mockImplementation(((
      _url: unknown,
      opts: typeof options,
      receive: (response: EventEmitter) => void,
    ) => {
      options = opts;
      const req = new EventEmitter() as EventEmitter & { end: () => void };
      req.end = () => {
        const response = Object.assign(new EventEmitter(), {
          statusCode: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' },
        });
        receive(response);
        response.emit('end');
      };
      return req;
    }) as never);
    const result = await new ProviderTransport().fetch(
      provider,
      new Request(target, {
        headers: {
          'x-goog-api-key': 'synthetic-secret',
          'x-untrusted-header': 'private',
        },
      }),
    );
    expect(result.status).toBe(302);
    expect(request).toHaveBeenCalledTimes(1);
    expect(options!.headers).toEqual({ 'x-goog-api-key': 'synthetic-secret' });
    const callback = jest.fn();
    options!.lookup(
      'generativelanguage.googleapis.com',
      { all: false },
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, '142.250.70.10', 4);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
  it('rejects an unapproved origin and a cancelled request before DNS or HTTPS', async () => {
    await expect(
      new ProviderTransport().fetch(
        provider,
        new Request('https://evil.test/v1beta/models'),
      ),
    ).rejects.toThrow();
    await expect(
      new ProviderTransport().fetch(
        provider,
        new Request(target, { signal: AbortSignal.abort() }),
      ),
    ).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});

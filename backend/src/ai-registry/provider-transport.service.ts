import { Injectable, HttpStatus } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { AI_LIMITS, providerEndpoint } from './provider-policy';
import type { AIProvider } from './registry.schemas';

/** IPv4-only pinned transport. TLS still verifies the approved hostname. No redirects. */
export function publicProviderAddress(address: string) {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b, c] = parts;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
@Injectable()
export class ProviderTransport {
  async fetch(provider: AIProvider, input: Request): Promise<Response> {
    const endpoint = providerEndpoint(provider);
    const url = new URL(input.url);
    if (
      url.origin !== endpoint.baseUrl ||
      !url.pathname.startsWith(`/${endpoint.apiVersion}/models`) ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new TypeError('Unapproved provider request');
    input.signal.throwIfAborted();
    let abort!: () => void;
    const cancelled = new Promise<never>((_resolve, reject) => {
      abort = () => {
        const reason: unknown = input.signal.reason;
        reject(
          reason instanceof Error
            ? reason
            : new DOMException('Provider request cancelled', 'AbortError'),
        );
      };
      input.signal.addEventListener('abort', abort, { once: true });
    });
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, family: 4 }),
      cancelled,
    ]).finally(() => input.signal.removeEventListener('abort', abort));
    input.signal.throwIfAborted();
    if (
      !addresses.length ||
      addresses.some((result) => !publicProviderAddress(result.address))
    )
      throw new TypeError('Unsafe resolved provider destination');
    const body = input.body
      ? Buffer.from(await input.arrayBuffer())
      : undefined;
    if (body && body.length > AI_LIMITS.MAX_REQUEST_BYTES)
      throw new TypeError('Provider request exceeds limit');
    const headers: Record<string, string> = {};
    for (const name of [
      'content-type',
      'accept',
      'x-goog-api-key',
      'x-goog-api-client',
    ]) {
      const value = input.headers.get(name);
      if (value) headers[name] = value;
    }
    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method: input.method,
          headers,
          signal: input.signal,
          family: 4,
          lookup: (_host, options, callback) => {
            if (options.all) callback(null, addresses);
            else callback(null, addresses[0].address, 4);
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > AI_LIMITS.MAX_RESPONSE_BYTES) {
              response.destroy(
                new TypeError('Provider response exceeds limit'),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => {
            const status = response.statusCode ?? HttpStatus.BAD_GATEWAY;
            const responseHeaders = new Headers();
            if (response.headers['content-type'])
              responseHeaders.set(
                'content-type',
                response.headers['content-type'],
              );
            resolve(
              new Response(
                [
                  HttpStatus.NO_CONTENT,
                  HttpStatus.RESET_CONTENT,
                  HttpStatus.NOT_MODIFIED,
                ].includes(status)
                  ? null
                  : new Uint8Array(Buffer.concat(chunks)),
                { status, headers: responseHeaders },
              ),
            );
          });
        },
      );
      req.on('error', () => {
        const safe = new TypeError('Provider transport failed');
        safe.name = input.signal.aborted ? 'AbortError' : 'TypeError';
        reject(safe);
      });
      req.end(body);
    });
  }
}

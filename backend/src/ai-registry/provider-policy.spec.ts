import { BadRequestException, HttpStatus } from '@nestjs/common';
import {
  validateProviderEndpoint,
  providerEndpoint,
  ADAPTER_POLICY,
} from './provider-policy';
import { publicProviderAddress } from './provider-transport.service';
import { classifyProviderFailure } from './provider-errors';
describe('Approved provider endpoint policy', () => {
  it('uses the pinned legacy Google policy and normalizes the approved origin', () => {
    expect(providerEndpoint({ adapter: 'google' })).toEqual({
      baseUrl: ADAPTER_POLICY.google.baseUrl,
      apiVersion: 'v1beta',
    });
    expect(
      validateProviderEndpoint(
        'google',
        ADAPTER_POLICY.google.baseUrl + '/',
        'v1',
      ),
    ).toHaveProperty('apiVersion', 'v1');
  });
  it.each([
    'http://generativelanguage.googleapis.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://169.254.169.254',
    'https://10.0.0.1',
    'https://generativelanguage.googleapis.com.evil.test',
    'https://user:secret@generativelanguage.googleapis.com',
    'https://generativelanguage.googleapis.com/path',
    'https://generativelanguage.googleapis.com?key=secret',
    'https://generativelanguage.googleapis.com#secret',
    'https://generativelanguage.googleapis.com:8443',
  ])('rejects unsafe or unapproved base URL %s', (baseUrl) => {
    expect(() => validateProviderEndpoint('google', baseUrl, 'v1beta')).toThrow(
      BadRequestException,
    );
  });
  it('rejects unsupported adapter endpoints and arbitrary API version paths', () => {
    expect(() =>
      validateProviderEndpoint('openai', 'https://api.openai.com', 'v1'),
    ).toThrow();
    expect(() =>
      validateProviderEndpoint(
        'google',
        ADAPTER_POLICY.google.baseUrl,
        '../secret',
      ),
    ).toThrow();
  });
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.100.100.200',
    '0.0.0.0',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
  ])('rejects nonpublic DNS destination %s', (address) =>
    expect(publicProviderAddress(address)).toBe(false),
  );
  it('allows public IPv4 destinations', () =>
    expect(publicProviderAddress('142.250.70.10')).toBe(true));
  it('preserves serialized generation and credential error classifications', () => {
    expect(classifyProviderFailure({ status: HttpStatus.FORBIDDEN }).code).toBe(
      'AI_AUTH_FAILED',
    );
    expect(
      classifyProviderFailure({ status: HttpStatus.FORBIDDEN }, true).code,
    ).toBe('AI_AUTH_OR_ACCESS_FAILED');
    expect(
      classifyProviderFailure({ status: HttpStatus.TOO_MANY_REQUESTS }).code,
    ).toBe('AI_QUOTA_OR_RATE_LIMIT');
  });
});

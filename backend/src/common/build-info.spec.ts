import { readFileSync } from 'node:fs';
import { readBuildInfo } from './build-info';
jest.mock('node:fs', () => ({ readFileSync: jest.fn() }));
describe('Backend build identity', () => {
  afterEach(() => jest.resetAllMocks());
  it('reports unknown when an older build has no manifest', () => {
    jest.mocked(readFileSync).mockImplementation(() => {
      throw new Error('missing');
    });
    expect(readBuildInfo()).toEqual({ revision: 'unknown' });
  });
  it('returns only validated manifest fields, including the dirty-source warning', () => {
    const build = {
      revision: 'a'.repeat(40),
      artifactHash: 'b'.repeat(64),
      sourceDirty: true,
      builtAt: '2026-10-14T08:00:00.000Z',
    };
    jest
      .mocked(readFileSync)
      .mockReturnValue(
        JSON.stringify({ ...build, privateMetadata: 'not-returned' }),
      );
    expect(readBuildInfo()).toEqual(build);
  });
  it.each([
    'invalid JSON',
    JSON.stringify({ revision: 'unverified', privateMetadata: 'not-returned' }),
  ])('does not invent an identity from malformed metadata', (value) => {
    jest.mocked(readFileSync).mockReturnValue(value);
    expect(readBuildInfo()).toEqual({ revision: 'unknown' });
  });
});

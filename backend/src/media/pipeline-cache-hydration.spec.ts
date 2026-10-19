import { model } from 'mongoose';
import { JobSchema } from '../jobs/schemas/job.schema';
import { artifactHash, highlightIdentity } from './pipeline-cache-identity';

describe('Saved transcript identity during BullMQ resume', () => {
  const Job = model('CacheHydrationRegression', JobSchema);
  const transcript = [{ startTime: 0, endTime: 1, text: 'Synthetic speech' }];
  it('hashes real Mongoose transcript rows identically to fresh provider rows without walking parent cycles', () => {
    const saved = new Job({ transcript });
    const configuration = { provider: 'synthetic', version: 1 };
    const fresh = artifactHash({ segments: transcript, configuration });
    expect(artifactHash({ segments: saved.transcript, configuration })).toBe(
      fresh,
    );
    expect(artifactHash({ segments: saved.transcript, configuration })).toBe(
      fresh,
    );
    expect(saved.transcript[0].text).toBe(transcript[0].text);
    expect(
      highlightIdentity({
        source: 'source',
        transcript: fresh,
        preset: 'default',
        presetInstructions: '',
        owner: 'owner',
        template: 'template',
        configuration,
      }),
    ).toHaveLength(64);
  });
  it('rejects actual cyclic or excessively deep identities without a stack overflow, allowing shared acyclic references', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.parent = cyclic;
    expect(() => artifactHash(cyclic)).toThrow(
      'Artifact identity contains a cycle',
    );
    const root: Record<string, unknown> = {};
    let cursor = root;
    for (let i = 0; i < 100; i++) {
      cursor.child = {};
      cursor = cursor.child as Record<string, unknown>;
    }
    expect(() => artifactHash(root)).toThrow(
      'Artifact identity exceeds nesting budget',
    );
    const shared = { text: 'Synthetic speech' };
    expect(artifactHash([shared, shared])).toBe(
      artifactHash([{ ...shared }, { ...shared }]),
    );
  });
});

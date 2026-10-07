import {
  workerConcurrency,
  renderJobId,
  pipelineJobId,
} from './jobs.constants';

describe('worker capacity configuration', () => {
  it('defaults to one and accepts explicit integer capacity', () => {
    expect(workerConcurrency(undefined, 'RENDER_CONCURRENCY')).toBe(1);
    expect(workerConcurrency('2', 'PIPELINE_CONCURRENCY')).toBe(2);
  });
  it.each(['', '0', '-1', '2.5', '50', 'no', null, Infinity])(
    'rejects unsafe value %s',
    (value) => {
      expect(() => workerConcurrency(value, 'RENDER_CONCURRENCY')).toThrow(
        'integer between 1 and 8',
      );
    },
  );
  it('uses stable BullMQ-compatible IDs', () => {
    expect(pipelineJobId('a')).toBe('pipeline-a');
    expect(renderJobId('a', 'b')).toBe('render-a-b');
    expect(renderJobId('a', 'b')).not.toContain(':');
  });
});

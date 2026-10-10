import { BadRequestException, ConflictException } from '@nestjs/common';
import { examplePlan } from '../edit-plan.fixture';
import { compileTimeline } from '../timeline';
import { mergeEditPatch } from './edit-patch';
import { searchTranscript } from './agent-tools.service';
const zoom = {
  id: 'zoom',
  type: 'zoom',
  start: 0,
  end: 2,
  params: {
    fromScale: 1,
    toScale: 1.2,
    focusX: 0.5,
    focusY: 0.5,
    easing: 'linear',
  },
};
describe('AI proposal patches reuse Phase 1', () => {
  it('uses original typed audio tracks for music adjustment and preserves unrelated effects', () => {
    const track = {
      id: 'music',
      role: 'music_track',
      assetId: 'owned_music',
      start: 0,
      sourceStart: 0,
      sourceEnd: 3,
      gain: 0.5,
    };
    const added = mergeEditPatch(examplePlan(), 1, {
      baseRevision: 1,
      changes: [
        { action: 'add_audio_track', track },
        { action: 'add', operation: zoom },
      ],
    }).plan;
    const reduced = mergeEditPatch(added, 2, {
      baseRevision: 2,
      changes: [
        {
          action: 'update_audio_track',
          trackId: 'music',
          track: { ...added.audio.tracks[0], gain: 0.4 },
        },
        {
          action: 'update_original_audio',
          controls: { ...added.audio.original, gain: 0.8 },
        },
      ],
    }).plan;
    expect(reduced.audio.tracks[0].gain).toBe(0.4);
    expect(reduced.operations).toEqual(added.operations);
    expect(reduced.audio.original.gain).toBe(0.8);
    expect(compileTimeline(reduced, 3).duration).toBe(3);
  });
  it('adds multiple operations without mutating source or unrelated settings', () => {
    const p = examplePlan();
    const result = mergeEditPatch(p, 1, {
      baseRevision: 1,
      changes: [
        { action: 'add', operation: zoom },
        {
          action: 'add',
          operation: {
            id: 'text',
            type: 'text_overlay',
            start: 0,
            end: 2,
            params: {
              text: 'Hello',
              x: 0.5,
              y: 0.5,
              font: 'sans',
              fontSize: 24,
              color: '#ffffff',
            },
          },
        },
      ],
    });
    expect(p.operations).toEqual([]);
    expect(result.plan.audio).toEqual(p.audio);
    expect(result.plan.operations).toHaveLength(2);
    expect(compileTimeline(result.plan, 3).duration).toBe(3);
  });
  it('updates, disables, enables and removes existing effects', () => {
    const p = mergeEditPatch(examplePlan(), 1, {
      baseRevision: 1,
      changes: [{ action: 'add', operation: zoom }],
    }).plan;
    const updated = mergeEditPatch(p, 2, {
      baseRevision: 2,
      changes: [
        {
          action: 'update',
          operationId: 'zoom',
          operation: { ...zoom, end: 1 },
        },
      ],
    }).plan;
    expect(updated.operations[0].end).toBe(1);
    const off = mergeEditPatch(updated, 3, {
      baseRevision: 3,
      changes: [{ action: 'disable', operationId: 'zoom' }],
    }).plan;
    expect(off.operations[0].enabled).toBe(false);
    const on = mergeEditPatch(off, 4, {
      baseRevision: 4,
      changes: [{ action: 'enable', operationId: 'zoom' }],
    }).plan;
    expect(on.operations[0].enabled).toBe(true);
    expect(
      mergeEditPatch(on, 5, {
        baseRevision: 5,
        changes: [{ action: 'remove', operationId: 'zoom' }],
      }).plan.operations,
    ).toEqual([]);
  });
  it('rejects stale revisions and duplicate or missing identities', () => {
    expect(() =>
      mergeEditPatch(examplePlan(), 2, {
        baseRevision: 1,
        changes: [{ action: 'add', operation: zoom }],
      }),
    ).toThrow(ConflictException);
    expect(() =>
      mergeEditPatch(examplePlan(), 1, {
        baseRevision: 1,
        changes: [{ action: 'remove', operationId: 'missing' }],
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      mergeEditPatch(examplePlan(), 1, {
        baseRevision: 1,
        changes: [
          { action: 'add', operation: zoom },
          { action: 'add', operation: zoom },
        ],
      }),
    ).toThrow(BadRequestException);
  });
  it('rejects command/filter injection and invalid timestamps through the original contracts', () => {
    expect(() =>
      mergeEditPatch(examplePlan(), 1, {
        baseRevision: 1,
        changes: [
          {
            action: 'add',
            operation: {
              ...zoom,
              params: { ...zoom.params, ffmpeg: '-i https://bad' },
            },
          },
        ],
      }),
    ).toThrow(BadRequestException);
    const invalid = mergeEditPatch(examplePlan(), 1, {
      baseRevision: 1,
      changes: [{ action: 'add', operation: { ...zoom, end: 10 } }],
    }).plan;
    expect(() => compileTimeline(invalid, 3)).toThrow(BadRequestException);
  });
  it('finds exact cross-segment phrases and reports ambiguity without invented word times', () => {
    const rows = [
      { startTime: 0, endTime: 1, text: 'Hello' },
      { startTime: 1, endTime: 2, text: 'world' },
      { startTime: 4, endTime: 5, text: 'hello world' },
    ];
    const result = searchTranscript(rows, 'HELLO, world');
    expect(result.found).toBe(true);
    expect(result.ambiguous).toBe(true);
    expect(result.matches[0]).toMatchObject({
      sourceStart: 0,
      sourceEnd: 2,
      confidence: 1,
      matchType: 'exact',
    });
  });
  it('supports approximate token matching and explicitly reports missing phrases', () => {
    expect(
      searchTranscript(
        [{ startTime: 0, endTime: 1, text: 'We should edit this clip today' }],
        'We should edit that clip',
      ).matches[0].matchType,
    ).toBe('approximate');
    expect(
      searchTranscript(
        [{ startTime: 0, endTime: 1, text: 'hello' }],
        'nonexistent phrase',
      ),
    ).toEqual({ found: false, ambiguous: false, matches: [] });
  });
});

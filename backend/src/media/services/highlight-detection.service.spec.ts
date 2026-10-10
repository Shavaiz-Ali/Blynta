import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

class MockNoObjectGeneratedError extends Error {
  readonly text?: string;
  readonly cause?: unknown;
  readonly finishReason?: string;
  readonly usage?: unknown;
  readonly response?: unknown;

  constructor({
    message = 'No object generated',
    cause,
    text,
    finishReason,
    usage,
    response,
  }: {
    message?: string;
    cause?: unknown;
    text?: string;
    finishReason?: string;
    usage?: unknown;
    response?: unknown;
  }) {
    super(message);
    this.name = 'NoObjectGeneratedError';
    this.cause = cause;
    this.text = text;
    this.finishReason = finishReason;
    this.usage = usage;
    this.response = response;
  }

  static isInstance(error: unknown): error is MockNoObjectGeneratedError {
    return (
      error instanceof MockNoObjectGeneratedError ||
      (typeof error === 'object' &&
        error !== null &&
        (error as any).name === 'NoObjectGeneratedError')
    );
  }
}

const mockGenerateObject = jest.fn();

jest.mock('ai', () => ({
  generateObject: (...args: any[]) => mockGenerateObject(...args),
  NoObjectGeneratedError: MockNoObjectGeneratedError,
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn().mockReturnValue({
    chat: jest.fn((modelName: string) => `openai-chat:${modelName}`),
  }),
}));

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest
    .fn()
    .mockReturnValue((modelName: string) => `google-model:${modelName}`),
}));

import {
  HighlightDetectionService,
  HighlightSchema,
  HighlightsResponseSchema,
} from './highlight-detection.service';
import { buildHighlightSystemPrompt } from '../prompts/highlight-detection.prompts';

describe('HighlightDetectionService & Schemas', () => {
  describe('Google response recovery', () => {
    const segments = [
      { startTime: 0, endTime: 30, text: 'Hello world transcript' },
    ];
    const response = {
      videoTitle: 'Recovered video',
      highlights: [
        {
          startTime: 5,
          endTime: 25,
          contextComplete: true,
          presetRelevant: true,
          groundedQuote: 'Hello world transcript',
          reason: 'Good hook',
          score: 0.9,
          clipTitle: 'A highlight',
          clipDescription: 'A complete moment',
        },
      ],
    };
    let service: HighlightDetectionService;

    beforeEach(() => {
      mockGenerateObject.mockReset();
      service = new HighlightDetectionService({
        get: (key: string, fallback?: string) =>
          key === 'LLM_API_KEY' ? 'test-key' : fallback,
      } as ConfigService);
    });

    it('recovers fenced JSON only after validating the schema', async () => {
      mockGenerateObject.mockRejectedValueOnce(
        new MockNoObjectGeneratedError({
          text: '```json\n' + JSON.stringify(response) + '\n```',
          finishReason: 'stop',
        }),
      );
      const result = await service.detectHighlightsWithMetadata(segments);
      expect(result.videoTitle).toBe('Recovered video');
      expect(result.highlights).toHaveLength(1);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });

    it.each(['stop', 'length'])(
      'retries malformed output with finishReason=%s',
      async (finishReason) => {
        mockGenerateObject
          .mockRejectedValueOnce(
            new MockNoObjectGeneratedError({
              text: '{"highlights": [',
              finishReason,
            }),
          )
          .mockResolvedValueOnce({
            object: HighlightsResponseSchema.parse(response),
          });
        const result = await service.detectHighlightsWithMetadata(segments);
        expect(result.highlights).toHaveLength(1);
        expect(mockGenerateObject).toHaveBeenCalledTimes(2);
        expect(mockGenerateObject.mock.calls[1][0]).toMatchObject({
          temperature: 0.1,
          maxOutputTokens: finishReason === 'length' ? 16384 : 8192,
        });
      },
    );

    it('throws after the bounded retry instead of returning zero clips', async () => {
      mockGenerateObject.mockRejectedValue(
        new MockNoObjectGeneratedError({
          text: '{"highlights":[{}]}',
          finishReason: 'stop',
        }),
      );
      await expect(service.detectHighlights(segments)).rejects.toThrow(
        'Highlight detection failed',
      );
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });

    it('propagates API errors without a JSON retry', async () => {
      mockGenerateObject.mockRejectedValueOnce(new Error('Invalid API key'));
      await expect(service.detectHighlights(segments)).rejects.toThrow(
        'Highlight detection failed',
      );
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    });
  });

  describe('System Prompt Generation', () => {
    it('should generate long-form duration rule for videos >= 10 minutes (600s)', () => {
      const prompt = buildHighlightSystemPrompt(600);
      expect(prompt).toContain(
        'Every clip duration (endTime − startTime) MUST be strictly between 45',
      );
      expect(prompt).toContain('NEVER produce a clip shorter than 45 seconds.');
      expect(prompt).toContain('curiosity-hook');
      expect(prompt).toContain('emotional-ken-burns');
    });

    it('should generate short-form duration rule for videos < 10 minutes (600s)', () => {
      const prompt = buildHighlightSystemPrompt(300);
      expect(prompt).toContain(
        'This video is under 10 minutes long, so clips do NOT need to hit a',
      );
      expect(prompt).toContain('45-second minimum.');
      expect(prompt).toContain('curiosity-hook');
    });
  });

  describe('Zod Schema Length Constraints', () => {
    it('should validate valid highlight objects', () => {
      const validHighlight = {
        startTime: 10,
        endTime: 25,
        reason: 'A great moment explaining the key takeaway clearly.',
        score: 0.9,
        clipTitle: 'Key Takeaway',
        clipDescription: 'Explanation of the main insight.',
        tags: ['strategy', 'business'],
        style: 'curiosity-hook',
      };
      expect(() => HighlightSchema.parse(validHighlight)).not.toThrow();
    });

    it('should reject reason exceeding 300 characters', () => {
      const invalidHighlight = {
        startTime: 10,
        endTime: 25,
        reason: 'A'.repeat(301),
        score: 0.9,
        clipTitle: 'Valid title',
        clipDescription: 'Valid description',
      };
      expect(() => HighlightSchema.parse(invalidHighlight)).toThrow();
    });

    it('should reject clipTitle exceeding 80 characters', () => {
      const invalidHighlight = {
        startTime: 10,
        endTime: 25,
        reason: 'Valid reason',
        score: 0.9,
        clipTitle: 'A'.repeat(81),
        clipDescription: 'Valid description',
      };
      expect(() => HighlightSchema.parse(invalidHighlight)).toThrow();
    });

    it('should reject clipDescription exceeding 400 characters', () => {
      const invalidHighlight = {
        startTime: 10,
        endTime: 25,
        reason: 'Valid reason',
        score: 0.9,
        clipTitle: 'Valid title',
        clipDescription: 'A'.repeat(401),
      };
      expect(() => HighlightSchema.parse(invalidHighlight)).toThrow();
    });

    it('should validate full HighlightsResponseSchema with video metadata', () => {
      const validResponse = {
        videoTitle: 'Great Video Title',
        videoDescription: 'A great video description here.',
        keywords: 'growth, business, tips',
        hashtags: ['#business', '#growth'],
        highlights: [
          {
            startTime: 12,
            endTime: 58,
            reason: 'Compelling insight',
            score: 0.95,
            clipTitle: 'The Insight',
            clipDescription: 'Describing the clip',
            tags: ['business'],
            style: 'motivational-zoom-in',
          },
        ],
      };
      expect(() => HighlightsResponseSchema.parse(validResponse)).not.toThrow();
    });
  });

  describe('HighlightDetectionService execution and retries', () => {
    let service: HighlightDetectionService;

    beforeEach(async () => {
      jest.clearAllMocks();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          HighlightDetectionService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'LLM_PROVIDER') return 'groq';
                if (key === 'GROQ_API_KEY') return 'test-groq-key';
                if (key === 'LLM_MODEL_NAME')
                  return defaultValue || 'openai/gpt-oss-120b';
                return defaultValue;
              }),
            },
          },
        ],
      }).compile();

      service = module.get<HighlightDetectionService>(
        HighlightDetectionService,
      );
    });

    it('should call generateObject with schemaName and explicit system prompt', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          videoTitle: 'Test Video',
          videoDescription: 'Test Description',
          keywords: 'test',
          hashtags: ['#test'],
          highlights: [
            {
              startTime: 5,
              endTime: 20,
              reason: 'Good hook',
              score: 0.85,
              clipTitle: 'Great Hook',
              clipDescription: 'Interesting beginning',
              tags: ['hook'],
              style: 'curiosity-hook',
              hookText: 'Watch till the end 🤯',
              emojis: ['🤯', '🔥'],
            },
          ],
        },
      });

      const segments = [
        { startTime: 0, endTime: 30, text: 'Hello world transcript' },
      ];
      const result = await service.detectHighlights(segments);

      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      const callArgs = mockGenerateObject.mock.calls[0][0];
      expect(callArgs.schemaName).toBe('HighlightsResponse');
      expect(callArgs.temperature).toBe(0.3);
      expect(result).toHaveLength(1);
      expect(result[0].clipTitle).toBe('Great Hook');
      expect(result[0].style).toBe('curiosity-hook');
      expect(result[0].hookText).toBe('Watch till the end 🤯');
      expect(result[0].emojis).toEqual(['🤯', '🔥']);
    });

    it('should retry on json_validate_failed schema mismatch with lower temperature (0.1)', async () => {
      const schemaError = new Error(
        'Generated JSON does not match the expected schema: json_validate_failed',
      );
      (schemaError as any).code = 'json_validate_failed';

      mockGenerateObject
        .mockRejectedValueOnce(schemaError)
        .mockResolvedValueOnce({
          object: {
            highlights: [
              {
                startTime: 10,
                endTime: 30,
                reason: 'Recovered after retry',
                score: 0.9,
                clipTitle: 'Recovered Clip',
                clipDescription: 'Clean generation',
                tags: ['clean'],
                style: 'fixed-caption-clean',
              },
            ],
          },
        });

      const segments = [
        { startTime: 0, endTime: 30, text: 'Hello world transcript' },
      ];
      const result = await service.detectHighlights(segments);

      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      expect(mockGenerateObject.mock.calls[0][0].temperature).toBe(0.3);
      expect(mockGenerateObject.mock.calls[1][0].temperature).toBe(0.1);
      expect(result).toHaveLength(1);
      expect(result[0].clipTitle).toBe('Recovered Clip');
      expect(result[0].style).toBe('fixed-caption-clean');
    });

    it('should retry on finishReason=length with temperature 0.1', async () => {
      const lengthError = new MockNoObjectGeneratedError({
        message: 'Length cutoff',
        text: 'truncated json...',
        finishReason: 'length',
      });

      mockGenerateObject
        .mockRejectedValueOnce(lengthError)
        .mockResolvedValueOnce({
          object: {
            highlights: [
              {
                startTime: 10,
                endTime: 30,
                reason: 'Recovered after retry',
                score: 0.9,
                clipTitle: 'Recovered Clip',
                clipDescription: 'Clean generation',
                tags: ['recovered'],
                style: 'meme-zoom-pop',
              },
            ],
          },
        });

      const segments = [
        { startTime: 0, endTime: 30, text: 'Hello world transcript' },
      ];
      const result = await service.detectHighlights(segments);

      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      expect(mockGenerateObject.mock.calls[1][0].temperature).toBe(0.1);
      expect(result).toHaveLength(1);
    });

    it('should return empty list gracefully if retries fail', async () => {
      const schemaError1 = new Error('json_validate_failed 1');
      (schemaError1 as any).code = 'json_validate_failed';
      const schemaError2 = new Error('json_validate_failed 2');
      (schemaError2 as any).code = 'json_validate_failed';

      mockGenerateObject
        .mockRejectedValueOnce(schemaError1)
        .mockRejectedValueOnce(schemaError2);

      const segments = [
        { startTime: 0, endTime: 30, text: 'Hello world transcript' },
      ];

      const result = await service.detectHighlights(segments);
      expect(result).toEqual([]);
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    });
  });
});

describe('quality discovery and independent authorized selection', () => {
  const candidate = (index: number, seconds = 45) => ({
    startTime: index * 80,
    endTime: index * 80 + seconds,
    score: 0.95 - index * 0.001,
    reason: 'A complete distinct insight',
    clipTitle: 'Clip ' + index,
    clipDescription: 'Distinct complete moment',
    tags: [],
    style: 'curiosity-hook',
    contextComplete: true,
    presetRelevant: true,
    groundedQuote: 'Specific ' + index + ' complete meaningful source moment',
  });
  const segments = Array.from({ length: 40 }, (_, index) => ({
    startTime: index * 80,
    endTime: index * 80 + 60,
    text: candidate(index).groundedQuote,
  }));
  const response = (highlights: ReturnType<typeof candidate>[]) => ({
    videoTitle: 'Video',
    videoDescription: '',
    keywords: '',
    hashtags: [],
    highlights,
    cacheable: true,
  });
  let service: HighlightDetectionService;
  beforeEach(() => {
    mockGenerateObject.mockReset();
    service = new HighlightDetectionService(
      new ConfigService({ LLM_PROVIDER: 'google', LLM_API_KEY: 'test' }),
    );
  });
  const requestAt = (index: number) =>
    (
      mockGenerateObject.mock.calls as unknown as Array<
        [{ prompt: string; system: string; maxOutputTokens: number }]
      >
    )[index][0];
  test.each([
    ['free', 6],
    ['pro', 9],
    ['business', 9],
  ] as const)(
    '%s selects within its cap from the same spare pool',
    async (plan, max) => {
      mockGenerateObject.mockResolvedValueOnce({
        object: response(Array.from({ length: 10 }, (_, i) => candidate(i))),
      });
      const result = await service.detectHighlightsWithMetadata(
        segments.slice(0, 10),
        {
          plan,
          videoDuration: 800,
          maxHighlights: max,
          maxOutputSeconds: max * 60,
        },
      );
      expect(result.highlights).toHaveLength(max);
      expect(result.candidates).toHaveLength(10);
      expect(requestAt(0).system).toContain('Never exceed 12');
      expect(requestAt(0).system).toContain('NO minimum clip count');
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    },
  );
  test('few genuine moments are valid and do not trigger a quota-filling loop', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: response([candidate(0), candidate(1)]),
    });
    const result = await service.detectHighlightsWithMetadata(
      segments.slice(0, 10),
      { videoDuration: 800, maxHighlights: 9 },
    );
    expect(result.highlights).toHaveLength(2);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });
  test('long sources receive broad overlapping analysis windows and preserve a plan-independent pool', async () => {
    mockGenerateObject.mockImplementation((request: { prompt: string }) => {
      const ranges = [
        ...request.prompt.matchAll(/\[(\d+\.\d+)s - (\d+\.\d+)s\]/g),
      ];
      const indices = ranges.map((r) => Math.round(Number(r[1]) / 80));
      return Promise.resolve({
        object: response(indices.slice(0, 3).map((i) => candidate(i))),
      });
    });
    const result = await service.detectHighlightsWithMetadata(segments, {
      videoDuration: 3200,
      maxHighlights: 9,
      maxOutputSeconds: 540,
    });
    expect(result.candidates!.length).toBeGreaterThan(9);
    expect(result.highlights).toHaveLength(9);
    expect(mockGenerateObject).toHaveBeenCalledTimes(4);
    expect(requestAt(3).prompt).toContain('[3120.0s - 3180.0s]');
  });
  test('duration filtering invokes one bounded pass across later uncovered regions', async () => {
    const internal = service as unknown as {
      detectHighlightsAcrossWindows: (
        s: typeof segments,
        o: unknown,
      ) => Promise<ReturnType<typeof response>>;
    };
    const detection = jest
      .spyOn(internal, 'detectHighlightsAcrossWindows')
      .mockResolvedValueOnce(
        response([
          ...Array.from({ length: 5 }, (_, i) => candidate(i)),
          candidate(5, 5),
        ]),
      )
      .mockResolvedValueOnce(response([candidate(35)]));
    const result = await service.detectHighlightsWithMetadata(segments, {
      videoDuration: 3200,
      maxHighlights: 9,
      maxOutputSeconds: 540,
    });
    expect(result.highlights).toHaveLength(6);
    expect(result.highlights.some((h) => h.startTime === 2800)).toBe(true);
    expect(detection).toHaveBeenCalledTimes(2);
    expect(detection.mock.calls[1][0]).toContainEqual(segments[35]);
    expect(detection.mock.calls[1][0]).not.toContainEqual(segments[0]);
  });
  test('retains quality across initial and recovery passes and returns fewer rather than filler', async () => {
    const internal = service as unknown as {
      detectHighlightsAcrossWindows: (
        s: typeof segments,
        o: unknown,
      ) => Promise<ReturnType<typeof response>>;
    };
    const detection = jest
      .spyOn(internal, 'detectHighlightsAcrossWindows')
      .mockResolvedValueOnce(
        response([
          candidate(0),
          { ...candidate(1), score: 0.2 },
          candidate(2, 5),
        ]),
      )
      .mockResolvedValueOnce(response([{ ...candidate(30), score: 0.2 }]));
    const result = await service.detectHighlightsWithMetadata(segments, {
      videoDuration: 3200,
      maxHighlights: 9,
    });
    expect(result.highlights).toHaveLength(1);
    expect(detection).toHaveBeenCalledTimes(2);
  });
  test('rejects invalid times, incomplete context, irrelevant presets, false quotes and repeated content', () => {
    const result = service.selectCandidates(
      [
        candidate(0),
        candidate(0),
        { ...candidate(1), startTime: -1 },
        { ...candidate(2), contextComplete: false },
        { ...candidate(3), presetRelevant: false },
        {
          ...candidate(4),
          groundedQuote: 'This never appears in the transcript',
        },
        candidate(5, 61),
      ],
      segments,
      { videoDuration: 3200, maxHighlights: 9 },
    );
    expect(result).toHaveLength(1);
  });
  test('chooses the strongest non-overlapping combination rather than greedily blocking better clips', () => {
    const a = {
      ...candidate(0),
      startTime: 0,
      endTime: 60,
      score: 0.95,
      groundedQuote: undefined,
    };
    const b = { ...a, endTime: 45, score: 0.8 };
    const c = { ...b, startTime: 45, endTime: 90 };
    const selected = service.selectCandidates(
      [a, b, c],
      [{ startTime: 0, endTime: 90, text: 'A full complete transcript' }],
      { videoDuration: 900, maxHighlights: 2, maxOutputSeconds: 90 },
    );
    expect(selected).toHaveLength(2);
    expect(selected.map((h) => h.startTime)).toEqual([0, 45]);
  });
  test('deduplicates repeated content at distinct non-overlapping timestamps', () => {
    const text =
      'This complete useful moment contains the same repeated explanation';
    const first = { ...candidate(0), groundedQuote: text };
    const second = { ...candidate(1), groundedQuote: text };
    expect(
      service.selectCandidates(
        [first, second],
        [first, second].map((h) => ({
          startTime: h.startTime,
          endTime: h.endTime,
          text,
        })),
        { videoDuration: 900, maxHighlights: 9, maxOutputSeconds: 540 },
      ),
    ).toHaveLength(1);
  });
  test('applies the current plan cap and exact budget to a larger cached candidate pool', () => {
    const pool = Array.from({ length: 12 }, (_, i) => candidate(i));
    expect(
      service.selectCandidates(pool, segments, {
        videoDuration: 3200,
        maxHighlights: 6,
        maxOutputSeconds: 360,
      }),
    ).toHaveLength(6);
    expect(
      service.selectCandidates(pool, segments, {
        videoDuration: 3200,
        maxHighlights: 9,
        maxOutputSeconds: 540,
      }),
    ).toHaveLength(9);
    expect(
      service.selectCandidates(pool, segments, {
        videoDuration: 3200,
        maxHighlights: 9,
        maxOutputSeconds: 100,
      }),
    ).toHaveLength(2);
    expect(
      service.selectCandidates(pool, segments, {
        videoDuration: 3200,
        maxHighlights: 9,
        maxOutputSeconds: 0,
      }),
    ).toHaveLength(0);
    expect(pool).toHaveLength(12);
  });
  test('engaging short videos are not subject to a duration-derived count cap', async () => {
    const short = Array.from({ length: 9 }, (_, i) => ({
      ...candidate(i),
      startTime: i * 20,
      endTime: i * 20 + 15,
      groundedQuote: 'Moment ' + i,
    }));
    mockGenerateObject.mockResolvedValueOnce({ object: response(short) });
    const result = await service.detectHighlightsWithMetadata(
      short.map((h) => ({
        startTime: h.startTime,
        endTime: h.endTime,
        text: h.groundedQuote,
      })),
      { videoDuration: 180, maxHighlights: 9, maxOutputSeconds: 180 },
    );
    expect(result.highlights).toHaveLength(9);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });
  test('exact 45 and 60-second fractional boundaries survive arithmetic noise', () => {
    const clips = [
      {
        ...candidate(0),
        startTime: 4.01,
        endTime: 64.01,
        groundedQuote: undefined,
      },
      {
        ...candidate(1),
        startTime: 84.01,
        endTime: 129.01,
        groundedQuote: undefined,
      },
    ];
    expect(
      service.selectCandidates(
        clips,
        [{ startTime: 0, endTime: 180, text: 'Complete transcript' }],
        { videoDuration: 900, maxHighlights: 9, maxOutputSeconds: 105 },
      ),
    ).toHaveLength(2);
  });
});

describe('registry highlight adapter integration', () => {
  const selection = {
    registryId: '111111111111111111111111',
    providerId: '222222222222222222222222',
    modelId: 'gemini-registered',
    configurationHash: 'synthetic-hash',
    auto: false,
  };
  function registryFixture() {
    const model = {
      modelId: 'gemini-registered',
      providerId: selection.providerId,
      settings: {
        timeoutMs: 1000,
        maxOutputTokens: 512,
        temperature: 0.2,
        maxRetries: 0,
      },
      pricing: {
        inputCostPerMillionTokens: 1,
        outputCostPerMillionTokens: 2,
        currency: 'USD',
      },
    };
    const routing = {
      resolve: jest
        .fn()
        .mockResolvedValue({ model, secret: 'synthetic-registry-key' }),
    };
    const registry = { recordUsage: jest.fn().mockResolvedValue(undefined) };
    const service = new HighlightDetectionService(
      new ConfigService({
        LLM_PROVIDER: 'google',
        LLM_MODEL_NAME: 'gemini-environment',
        LLM_API_KEY: 'synthetic-env-key',
      }),
      routing as never,
      registry as never,
    );
    return { service, routing, registry };
  }
  it('uses the database-selected adapter/settings and records measured tokens with existing metering', async () => {
    const s = registryFixture();
    mockGenerateObject
      .mockReset()
      .mockResolvedValue({
        object: HighlightsResponseSchema.parse({ highlights: [] }),
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      });
    await s.service.detectHighlightsWithMetadata(
      [
        {
          startTime: 0,
          endTime: 30,
          text: 'A transcript excerpt about a surprising idea and a useful conclusion.',
        },
      ],
      { videoDuration: 30, registeredModel: { userId: 'owner', selection } },
    );
    expect(s.routing.resolve).toHaveBeenCalledWith('owner', selection);
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'google-model:gemini-registered',
        maxOutputTokens: 512,
        maxRetries: 0,
        temperature: 0.2,
      }),
    );
    expect(s.registry.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: selection.registryId,
        providerModelId: 'gemini-registered',
        status: 'success',
        inputTokens: 100,
        outputTokens: 20,
        estimatedCostUsd: 0.00014,
      }),
    );
  });
  it('reports provider failures safely without an environment fallback or fabricated highlights', async () => {
    const s = registryFixture();
    mockGenerateObject
      .mockReset()
      .mockRejectedValue(
        new Error('synthetic-registry-key RAW PROVIDER ERROR'),
      );
    await expect(
      s.service.detectHighlightsWithMetadata(
        [
          {
            startTime: 0,
            endTime: 30,
            text: 'A transcript excerpt about a surprising idea.',
          },
        ],
        { videoDuration: 30, registeredModel: { userId: 'owner', selection } },
      ),
    ).rejects.toThrow('Selected AI model could not generate highlights');
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(s.registry.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'HIGHLIGHT_PROVIDER_FAILED',
      }),
    );
  });
});

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
        'Invalid API key',
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

describe('clip target enforcement and bounded recovery', () => {
  const candidate = (index: number) => ({
    startTime: index * 80,
    endTime: index * 80 + 45,
    reason: 'Complete moment',
    score: 0.9 - index * 0.01,
    clipTitle: `Clip ${index}`,
    clipDescription: 'Distinct moment',
    tags: [],
    style: 'curiosity-hook',
  });
  const segments = Array.from({ length: 40 }, (_, index) => ({
    startTime: index * 80,
    endTime: index * 80 + 60,
    text: `Distinct transcript moment ${index}`,
  }));
  let service: HighlightDetectionService;
  beforeEach(() => {
    mockGenerateObject.mockReset();
    service = new HighlightDetectionService(
      new ConfigService({ LLM_PROVIDER: 'google', LLM_API_KEY: 'test' }),
    );
  });
  test.each([6, 9])(
    'caps genuine candidates at %s and retains separate ranges',
    async (max) => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          highlights: Array.from({ length: 12 }, (_, i) => candidate(i)),
        },
      });
      const result = await service.detectHighlightsWithMetadata(segments, {
        videoDuration: 3200,
        maxHighlights: max,
      });
      expect(result.highlights).toHaveLength(max);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(mockGenerateObject.mock.calls[0][0].system).toContain(
        `Never exceed ${max}`,
      );
    },
  );
  test('one initial result recovers five genuine uncovered moments with one extra call', async () => {
    mockGenerateObject
      .mockResolvedValueOnce({ object: { highlights: [candidate(0)] } })
      .mockResolvedValueOnce({
        object: {
          highlights: Array.from({ length: 5 }, (_, i) => candidate(i + 1)),
        },
      });
    const result = await service.detectHighlightsWithMetadata(segments, {
      videoDuration: 3200,
      maxHighlights: 6,
    });
    expect(result.highlights).toHaveLength(6);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
    expect(mockGenerateObject.mock.calls[1][0].prompt).toContain(
      'uncovered excerpt',
    );
    expect(mockGenerateObject.mock.calls[1][0].prompt).not.toContain(
      '[0.0s - 60.0s]',
    );
  });
  test('does not fabricate extra moments when recovery returns the same moment', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { highlights: [candidate(0)] },
    });
    const result = await service.detectHighlightsWithMetadata(segments, {
      videoDuration: 3200,
    });
    expect(result.highlights).toHaveLength(1);
    expect(mockGenerateObject).toHaveBeenCalledTimes(2);
  });
  test('rejects out-of-source, short long-form, overlap, and silent gaps', () => {
    const selection = (service as any).validateCandidates(
      [
        candidate(0),
        { ...candidate(1), startTime: -1 },
        { ...candidate(2), endTime: 3300 },
        { ...candidate(3), endTime: 245 },
        { ...candidate(0), startTime: 5 },
        { ...candidate(4), startTime: 3050, endTime: 3095 },
      ],
      segments.slice(0, 5),
      3200,
      9,
    );
    expect(selection).toHaveLength(1);
  });
});

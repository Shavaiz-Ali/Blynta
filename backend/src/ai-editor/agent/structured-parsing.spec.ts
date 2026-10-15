import { z } from 'zod';
import { GoogleAdapter } from '../../ai-registry/google-adapter.service';
import type { AIModel, AIProvider } from '../../ai-registry/registry.schemas';
it('preserves structured parsing failure as an internal error rather than unsupported or an authentication failure', async () => {
  const adapter = new GoogleAdapter();
  jest.spyOn(adapter, 'create').mockReturnValue({
    withStructuredOutput: () => ({
      invoke: () => Promise.resolve({ parsed: { private: 'DO-NOT-LOG' } }),
    }),
  } as unknown as ReturnType<GoogleAdapter['create']>);
  await expect(
    adapter.structured(
      {} as AIModel,
      'PRIVATE-KEY',
      z.object({ ok: z.boolean() }),
      'system',
      'PRIVATE-PROMPT',
      AbortSignal.timeout(1000),
      {} as AIProvider,
    ),
  ).rejects.toMatchObject({
    response: {
      code: 'AI_STRUCTURED_OUTPUT_INVALID',
      message: 'AI returned malformed structured output',
    },
  });
});

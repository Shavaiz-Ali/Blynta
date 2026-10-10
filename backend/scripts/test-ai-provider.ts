import 'reflect-metadata';
import { z } from 'zod';
import { GoogleAdapter } from '../src/ai-registry/google-adapter.service';
import { modelInput } from '../src/ai-registry/registry.contract';
async function main() {
  // Dedicated explicit test configuration. Never reads the application's .env.
  const secret = process.env.AI_TEST_API_KEY,
    modelId = process.env.AI_TEST_MODEL_ID;
  if (!secret || !modelId) throw new Error();
  const model = {
    ...modelInput.parse({
      providerId: '111111111111111111111111',
      modelId,
      displayName: 'Smoke test',
      capabilities: {
        text: true,
        vision: false,
        audioInput: false,
        structuredOutput: true,
        toolCalling: false,
      },
      settings: { maxOutputTokens: 128, timeoutMs: 15000, maxRetries: 0 },
      access: { allowedPlans: ['free'], selectable: false },
    }),
    archived: false,
  };
  const google = new GoogleAdapter(),
    signal = AbortSignal.timeout(20000);
  await google.verifyModel(modelId, secret, signal);
  const result = await google.structured(
    model,
    secret,
    z.object({ ok: z.boolean() }).strict(),
    'Return ok true.',
    'Connectivity test.',
    signal,
  );
  if (result.parsed?.ok !== true) throw new Error();
  console.log(
    'Live Gemini model lookup and structured output smoke test passed.',
  );
}
main().catch(() => {
  console.error(
    'Live AI smoke test failed or test configuration is missing; provider details are suppressed.',
  );
  process.exitCode = 1;
});

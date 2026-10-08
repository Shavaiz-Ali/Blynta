import { generateObject } from 'ai';
import { usageSample } from './usage-context';
/** Capture actual SDK usage, including each chunk/retry. Missing measurements stay unknown. */
export const meteredGenerateObject: typeof generateObject = (async (
  ...args: Parameters<typeof generateObject>
) => {
  const model = args[0].model as { provider?: string; modelId?: string };
  try {
    const result = await generateObject(...args);
    await usageSample('llm', {
      provider: model.provider,
      model: model.modelId,
      usage: result.usage,
    });
    return result;
  } catch (error) {
    const measured = error as { usage?: unknown };
    await usageSample('llm', {
      provider: model.provider,
      model: model.modelId,
      usage: measured.usage,
      failed: true,
    });
    throw error;
  }
}) as typeof generateObject;

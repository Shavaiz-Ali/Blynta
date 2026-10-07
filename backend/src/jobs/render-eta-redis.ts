import type { IRedisClient } from 'bullmq';

const registered = new WeakMap<IRedisClient, Set<string>>();

/** Use BullMQ's adapter API rather than depending on ioredis-only commands. */
export async function runEtaScript(
  client: IRedisClient,
  name: string,
  lua: string,
  args: (string | number)[],
): Promise<unknown> {
  const commands = registered.get(client) ?? new Set<string>();
  if (!commands.has(name)) {
    client.defineCommand(name, { numberOfKeys: 1, lua });
    commands.add(name);
    registered.set(client, commands);
  }
  return client.runCommand(name, args);
}

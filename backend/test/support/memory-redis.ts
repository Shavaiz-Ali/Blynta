/** Models the Redis commands and TTL/compare-delete semantics used by the protocol. */
export class MemoryRedis {
  values = new Map<string, { value: string; expires: number }>();
  set(key: string, value: string, _mode: string, ttl: number) {
    void _mode;
    this.values.set(key, { value, expires: Date.now() + ttl * 1000 });
  }
  get(key: string) {
    const item = this.values.get(key);
    if (!item || item.expires <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return item.value;
  }
  exists(key: string) {
    return this.get(key) ? 1 : 0;
  }
  del(key: string) {
    return this.values.delete(key) ? 1 : 0;
  }
  scan() {
    return ['0', [...this.values.keys()]];
  }
  eval(script: string, _count: number, key: string, expected?: string) {
    void _count;
    if (script.includes('INCR')) {
      const old = this.get(key);
      const count = Number(old || 0) + 1;
      this.values.set(key, {
        value: String(count),
        expires: this.values.get(key)?.expires || Date.now() + 60000,
      });
      return count;
    }
    // Atomic (no await between compare and delete), matching the Lua script.
    const item = this.values.get(key);
    if (item && item.expires > Date.now() && item.value === expected)
      return this.values.delete(key) ? 1 : 0;
    return 0;
  }
}

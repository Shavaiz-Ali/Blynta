import type { EditorDocument } from '../../types';
// Serialize writes per editor. A delayed response can never overwrite newer edits,
// and the server revision protects against a second browser/editor.
export class SaveSession {
  private latest: EditorDocument;
  private saved: EditorDocument;
  private active?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<() => void>();
  status = 'Saved';
  error?: Error;
  constructor(initial: EditorDocument, public revision: number,
    private write: (revision: number, document: EditorDocument) => Promise<{ revision: number }>) {
    this.latest = this.saved = initial;
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { this.listeners.forEach((listener) => listener()); }
  enqueue(document: EditorDocument) {
    this.latest = document;
    if (this.latest === this.saved) return;
    if (this.error) return;
    this.status = 'Saving…'; this.notify();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush().catch(() => {}); }, 750);
  }
  async flush(): Promise<number> {
    clearTimeout(this.timer);
    if (this.active) { await this.active; return this.flush(); }
    if (this.error) throw this.error;
    this.active = (async () => {
      while (this.latest !== this.saved) {
        const document = this.latest;
        const result = await this.write(this.revision, document);
        this.revision = result.revision; this.saved = document;
      }
      this.status = 'Saved'; this.notify();
    })();
    try { await this.active; } catch (error) {
      this.error = error instanceof Error ? error : new Error('Save failed');
      this.status = `Save failed · ${this.error.message}`; this.notify(); throw this.error;
    } finally { this.active = undefined; }
    return this.revision;
  }
  retry() { this.error = undefined; this.status = 'Saving…'; this.notify(); return this.flush(); }
  get dirty() { return this.latest !== this.saved; }
}

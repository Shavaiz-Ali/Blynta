import { diagnosticOutput } from './agent-diagnostics';
describe('Sanitized graph diagnostics', () => {
  it('records actual decision fields but never summaries, prompts, reasoning, asset names, or arbitrary operation text', () => {
    const result = diagnosticOutput({
      outcome: 'unsupported',
      summary: 'PRIVATE-CONTENT',
      patchJson: '',
      reasoning: 'PRIVATE-REASONING',
      prompt: 'PRIVATE-PROMPT',
    });
    expect(result).toMatchObject({
      outcome: 'unsupported',
      unsupportedClaim: true,
      patchJsonPresent: false,
      patchSchemaValid: false,
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
  it('only derives action and operation identifiers from a schema-valid patch', () => {
    const result = diagnosticOutput({
      outcome: 'proposal',
      patchJson: JSON.stringify({
        baseRevision: 1,
        changes: [
          {
            action: 'add',
            operation: { type: 'SECRET', params: { secret: 'PRIVATE' } },
          },
        ],
      }),
    });
    expect(result.patchSchemaValid).toBe(false);
    expect(result.operations).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE/);
  });
});

import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
describe('shared validation error envelope', () => {
  function run(exception: BadRequestException) {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({ url: '/ai-editor/plans' }),
      }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(exception, host);
    return response;
  }
  it('preserves domain codes and actionable field issues', () => {
    const issues = [
      { path: 'operations.0.end', message: 'Outside output timeline' },
    ];
    const response = run(
      new BadRequestException({
        message: 'Invalid timeline',
        code: 'INVALID_TIMELINE',
        issues,
      }),
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: 'INVALID_TIMELINE',
          message: 'Invalid timeline',
          details: issues,
        },
      }),
    );
  });
  it('keeps legacy plain HTTP errors unchanged', () => {
    const response = run(new BadRequestException('Existing error'));
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: { code: 'BAD_REQUEST', message: 'Existing error' },
      }),
    );
  });
});

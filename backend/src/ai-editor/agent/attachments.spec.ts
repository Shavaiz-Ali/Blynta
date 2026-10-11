import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AgentTools } from './agent-tools.service';
import { examplePlan } from '../edit-plan.fixture';
const user = '111111111111111111111111',
  clip = '222222222222222222222222',
  planId = '333333333333333333333333';
const image = {
  assetId: 'image-1',
  name: 'Brand.png',
  kind: 'image',
  mimeType: 'image/png',
  size: 100,
  width: 32,
  height: 32,
};
function setup(records: unknown[] = [image]) {
  const query = {
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maxTimeMS: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(records),
  };
  const assets = { find: jest.fn().mockReturnValue(query) };
  const validator = {
    validate: jest.fn().mockResolvedValue({ timeline: { duration: 3 } }),
  };
  const tools = new AgentTools(
    {} as never,
    {} as never,
    assets as never,
    validator as never,
  );
  const owned = jest.spyOn(tools, 'owned').mockResolvedValue({
    plan: { plan: examplePlan(), revision: 1, sourceMedia: { duration: 3 } },
  } as never);
  return { tools, assets, validator, owned };
}
describe('Selected attachment context', () => {
  it('requires the owned clip/plan and ready assets belonging to that user', async () => {
    const s = setup();
    expect(
      await s.tools.selectedAssets(user, clip, planId, ['image-1']),
    ).toEqual([image]);
    expect(s.owned).toHaveBeenCalledWith(user, clip, planId);
    expect(s.assets.find).toHaveBeenCalledWith({
      userId: user,
      assetId: { $in: ['image-1'] },
      status: 'ready',
    });
  });
  it('cannot query assets without access to the editing plan', async () => {
    const s = setup();
    s.owned.mockRejectedValue(new NotFoundException());
    await expect(
      s.tools.selectedAssets(user, clip, planId, ['image-1']),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s.assets.find).not.toHaveBeenCalled();
  });
  it.each([
    [],
    [image, image],
    [{ ...image, kind: 'video', mimeType: 'video/mp4' }],
    [{ ...image, mimeType: 'image/jpeg' }],
    [{ ...image, width: 4000, height: 4000 }],
    [{ ...image, size: 101 * 1024 * 1024 }],
    [
      {
        ...image,
        kind: 'audio',
        mimeType: 'audio/mp4',
        hasAudio: false,
        duration: 3,
      },
    ],
  ])(
    'rejects missing, ambiguous or incompatible media (%j)',
    async (...args) => {
      const records = args as unknown[];
      // it.each spreads each row: reconstruct its asset records.
      const s = setup(records);
      await expect(
        s.tools.selectedAssets(user, clip, planId, ['image-1']),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
  it('accepts validated audio metadata', async () => {
    const s = setup([
      {
        ...image,
        kind: 'audio',
        mimeType: 'audio/mpeg',
        hasAudio: true,
        duration: 3,
      },
    ]);
    expect(
      await s.tools.selectedAssets(user, clip, planId, ['image-1']),
    ).toHaveLength(1);
  });
  it('rejects a generated patch referencing another owned asset outside selection', async () => {
    const s = setup();
    const scoped = s.tools.scoped(user, clip, planId, () => {}, ['image-1']);
    await expect(
      scoped.validate.invoke({
        baseRevision: 1,
        changes: [
          {
            action: 'add',
            operation: {
              id: 'overlay',
              type: 'image_overlay',
              start: 0,
              end: 1,
              params: { assetId: 'other-owned', x: 0, y: 0, width: 0.2 },
            },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.validator.validate).not.toHaveBeenCalled();
  });
});

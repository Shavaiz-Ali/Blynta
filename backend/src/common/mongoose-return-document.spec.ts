import { model, Schema } from 'mongoose';

describe('Mongoose update return semantics', () => {
  const Model = model(
    'ReturnDocumentRegression',
    new Schema({ name: String }, { bufferCommands: false }),
  );
  afterEach(() => jest.restoreAllMocks());
  it('requests and returns the updated document without using deprecated new options', async () => {
    const update = jest
      .spyOn(Model.collection, 'findOneAndUpdate')
      .mockResolvedValue({ name: 'after' } as never);
    const value = await Model.findOneAndUpdate(
      { name: 'before' },
      { $set: { name: 'after' } },
      { returnDocument: 'after' },
    );
    expect(value?.name).toBe('after');
    const options = (update.mock.calls[0] as unknown[])[2];
    expect(options).toMatchObject({ returnDocument: 'after' });
    expect(options).not.toHaveProperty('new');
  });
});

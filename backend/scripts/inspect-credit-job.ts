import { ConfigModule } from '@nestjs/config';
import { createConnection, Types } from 'mongoose';
async function main() {
  await ConfigModule.forRoot();
  const id = process.argv[2];
  if (!id || !Types.ObjectId.isValid(id))
    throw new Error('Supply a valid job ID');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI unavailable');
  const db = await createConnection(process.env.MONGO_URI, {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  }).asPromise();
  try {
    const job = await db
      .collection('jobs')
      .findOne(
        { _id: new Types.ObjectId(id) },
        {
          projection: {
            userId: 1,
            status: 1,
            videoDuration: 1,
            clips: 1,
            creditOperationId: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      );
    if (!job) {
      console.log(JSON.stringify({ found: false, jobId: id }));
      return;
    }
    const operation = job.creditOperationId
      ? await db
          .collection('creditoperations')
          .findOne({ operationId: job.creditOperationId })
      : null;
    const ledger = operation
      ? await db
          .collection('creditentries')
          .find(
            { operationId: job.creditOperationId },
            { projection: { key: 0, metadata: 0, userId: 0 } },
          )
          .sort({ createdAt: 1 })
          .toArray()
      : [];
    const account = await db
      .collection('users')
      .findOne(
        { _id: job.userId },
        {
          projection: {
            _id: 0,
            creditsBalance: 1,
            creditsReserved: 1,
            creditLedgerInitialized: 1,
          },
        },
      );
    const hello = await db.db!.admin().command({ hello: 1 });
    const indexes = await db
      .collection('creditentries')
      .indexes()
      .catch(() => []);
    const deduction = await db
      .collection('activities')
      .find(
        { userId: job.userId, 'metadata.jobId': id },
        { projection: { _id: 0, type: 1, 'metadata.amount': 1, createdAt: 1 } },
      )
      .toArray();
    console.log(
      JSON.stringify(
        {
          jobId: id,
          status: job.status,
          sourceSeconds: job.videoDuration,
          createdAt: job.createdAt,
          clips: (
            (job.clips as {
              status: string;
              startTime: number;
              endTime: number;
            }[]) || []
          ).map((c) => ({
            status: c.status,
            seconds: c.endTime - c.startTime,
          })),
          creditOperationId: job.creditOperationId || null,
          operation: operation
            ? {
                authorized: operation.authorized,
                held: operation.held,
                charged: operation.charged,
                status: operation.status,
                pricing: operation.pricing,
              }
            : null,
          ledger,
          deduction,
          account,
          transactionsSupported: !!hello.setName || hello.msg === 'isdbgrid',
          ledgerIndexes: indexes.map((i) => ({
            key: i.key,
            unique: i.unique || false,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await db.close();
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.name +
          ': inspection failed (details omitted to protect connection credentials)'
      : 'Inspection failed',
  );
  process.exitCode = 1;
});

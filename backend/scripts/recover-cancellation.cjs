// Read-only by default. Apply ONLY after independently verifying the named
// worker/API instance and all its subprocesses have stopped on the owning host.
const mongoose = require('mongoose');
const { Queue } = require('bullmq');
const args = process.argv.slice(2);
const id = args[0];
const apply = args.includes('--apply');
const tokens = args.flatMap((value, index) =>
  value === '--execution' ? [args[index + 1]] : [],
);
async function main() {
  if (!/^[a-f0-9]{24}$/i.test(id || ''))
    throw new Error(
      'Usage: node --env-file=.env scripts/recover-cancellation.cjs JOB_ID [--execution EXACT_TOKEN --workers-stopped --apply]',
    );
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  if (
    apply &&
    (!args.includes('--workers-stopped') ||
      !tokens.length ||
      tokens.some((t) => !t))
  )
    throw new Error(
      'Apply requires exact --execution tokens and --workers-stopped confirmation. Never infer shutdown from an expired queue lock.',
    );
  const connection = await mongoose
    .createConnection(process.env.MONGO_URI)
    .asPromise();
  const queues = ['clip-jobs', 'clip-renders'].map(
    (name) =>
      new Queue(name, {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT || 6379),
        },
      }),
  );
  try {
    const collection = connection.collection('jobs');
    const job = await collection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (!job || job.status !== 'cancelling' || !job.cancellationRequestedAt)
      throw new Error('The job must have durable pending cancellation intent');
    console.log(
      JSON.stringify(
        {
          jobId: id,
          status: job.status,
          activeExecutions: job.activeExecutions || [],
        },
        null,
        2,
      ),
    );
    if (!apply) return;
    if (tokens.some((t) => !job.activeExecutions?.includes(t)))
      throw new Error(
        'An execution token changed. Inspect again before applying.',
      );
    for (const queue of queues) {
      const active = await queue.getJobs(['active']);
      if (active.some((entry) => entry.data.jobId === id))
        throw new Error(
          'BullMQ still has active work. Allow stopped work to settle before acknowledging shutdown.',
        );
    }
    await collection.updateOne(
      {
        _id: job._id,
        status: 'cancelling',
        cancellationRequestedAt: { $exists: true },
      },
      {
        $pull: { activeExecutions: { $in: tokens } },
        $set: { updatedAt: new Date() },
      },
    );
    console.log(
      'Stopped execution tokens acknowledged. Check cancellation in the video menu to finalize; the worker reconciler also finalizes it.',
    );
  } finally {
    await Promise.all(queues.map((queue) => queue.close()));
    await connection.close();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

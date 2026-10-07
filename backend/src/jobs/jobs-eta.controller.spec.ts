import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { UsersService } from '../users/users.service';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import { UserPlan } from '../users/schemas/user.schema';
import { JobStatus, type JobDocument } from './schemas/job.schema';

describe('existing job response overall ETA', () => {
  const jobs = { getRenderSnapshot: jest.fn() };
  const controller = new JobsController(
    jobs as unknown as JobsService,
    {} as UsersService,
    {} as R2Service,
    {} as ActivitiesService,
  );
  const response = (status: JobStatus, manifest = true) => {
    const fields = { status, renderManifestReady: manifest, highlights: [] };
    return (
      controller as unknown as {
        shapeJobResponse: (
          job: JobDocument,
          plan: UserPlan,
        ) => Promise<Record<string, unknown>>;
      }
    ).shapeJobResponse(
      { ...fields, toObject: () => fields } as unknown as JobDocument,
      UserPlan.FREE,
    );
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('puts numeric seconds at the root where the existing frontend reads them', async () => {
    jobs.getRenderSnapshot.mockResolvedValue({
      progressPercent: 39,
      ready: 2,
      total: 7,
      estimatedRemainingSeconds: 1280,
      clips: [],
    });
    expect(await response(JobStatus.CUTTING_CLIPS)).toMatchObject({
      progressPercent: 39,
      estimatedRemainingSeconds: 1280,
      render: { ready: 2, total: 7, estimatedRemainingSeconds: 1280 },
    });
  });
  it('explicitly returns null before a render manifest exists', async () => {
    expect(await response(JobStatus.TRANSCRIBING, false)).toMatchObject({
      estimatedRemainingSeconds: null,
    });
    expect(jobs.getRenderSnapshot).not.toHaveBeenCalled();
  });
  it('preserves terminal zero and failure null', async () => {
    jobs.getRenderSnapshot.mockResolvedValue({ estimatedRemainingSeconds: 0 });
    expect(await response(JobStatus.COMPLETED)).toMatchObject({
      estimatedRemainingSeconds: 0,
    });
    jobs.getRenderSnapshot.mockResolvedValue({
      estimatedRemainingSeconds: null,
    });
    expect(await response(JobStatus.FAILED)).toMatchObject({
      estimatedRemainingSeconds: null,
    });
  });
});

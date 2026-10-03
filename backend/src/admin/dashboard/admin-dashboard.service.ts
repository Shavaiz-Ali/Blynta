import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import {
  User,
  UserDocument,
  UserPlan,
  UserRole,
} from '../../users/schemas/user.schema';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import {
  Customer,
  CustomerDocument,
} from '../../billing/schemas/customer.schema';
import {
  Activity,
  ActivityDocument,
} from '../../activities/schemas/activity.schema';
import { JOBS_QUEUE } from '../../jobs/jobs.constants';
import { YOUTUBE_PUBLISHING_QUEUE } from '../../youtube/youtube.constants';
import { NOTIFICATIONS_QUEUE } from '../../notifications/notifications.constants';
import { MAIL_QUEUE } from '../../mail/mail.constants';
import { ACTIVITIES_QUEUE } from '../../activities/activities.constants';

export interface QueueMetric {
  name: string;
  label: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  isHealthy: boolean;
}

export type DashboardRange = '7d' | '30d' | '90d';

const DASHBOARD_RANGE_DAYS: Record<DashboardRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export interface DashboardOverviewResult {
  range: DashboardRange;
  users: {
    total: number;
    active: number;
    newThisWeek: number;
    freeCount: number;
    proCount: number;
    businessCount: number;
    paidCount: number;
  };
  jobs: {
    total: number;
    completedToday: number;
    failedToday: number;
    pending: number;
    processing: number;
    successRate: number; // percentage 0 - 100
  };
  clips: {
    total: number;
    generatedToday: number;
    generatedInPeriod: number;
  };
  billing: {
    activeSubscriptions: number;
    mrr: number; // in cents
    pastDue: number;
    freeUsers: number;
    proUsers: number;
    businessUsers: number;
  };
  comparisons: {
    newUsersInPeriod: number;
    jobsInPeriod: number;
    clipsInPeriod: number;
    userGrowthRate: number;
    jobGrowthRate: number;
    clipGrowthRate: number;
  };
  userGrowthSeries: Array<{
    date: string;
    newUsers: number;
  }>;
  jobActivitySeries: Array<{
    date: string;
    completed: number;
    failed: number;
    total: number;
  }>;
  clipActivitySeries: Array<{
    date: string;
    generated: number;
  }>;
  jobStatusDistribution: Array<{
    status: string;
    label: string;
    count: number;
  }>;
  queueHealth: QueueMetric[];
  recentAudit: Array<{
    _id: string;
    adminEmail?: string;
    adminName?: string;
    actorType?: string;
    category?: string;
    action: string;
    title?: string;
    reason: string;
    severity?: string;
    status?: string;
    createdAt: string | Date;
    metadata?: Record<string, any>;
  }>;
}

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Job.name)
    private readonly jobModel: Model<JobDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectQueue(JOBS_QUEUE)
    private readonly jobsQueue: Queue,
    @InjectQueue(YOUTUBE_PUBLISHING_QUEUE)
    private readonly youtubeQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue,
    @InjectQueue(MAIL_QUEUE)
    private readonly mailQueue: Queue,
    @InjectQueue(ACTIVITIES_QUEUE)
    private readonly activitiesQueue: Queue,
  ) {}

  async getDashboardOverview(
    requestedRange?: string,
  ): Promise<DashboardOverviewResult> {
    const range: DashboardRange =
      requestedRange && requestedRange in DASHBOARD_RANGE_DAYS
        ? (requestedRange as DashboardRange)
        : '30d';
    const rangeDays = DASHBOARD_RANGE_DAYS[range];
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const rangeStart = new Date(
      now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000,
    );
    const previousRangeStart = new Date(
      rangeStart.getTime() - rangeDays * 24 * 60 * 60 * 1000,
    );

    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      freeUsersCount,
      proUsersCount,
      businessUsersCount,
      totalJobs,
      completedJobsToday,
      failedJobsToday,
      pendingJobs,
      processingJobs,
      activeSubscriptions,
      pastDueSubscriptions,
      recentActivities,
      userAggByDate,
      jobAggByDate,
      clipAggByDate,
      jobStatusAgg,
      queueHealthMetrics,
      newUsersInPeriod,
      newUsersInPreviousPeriod,
      jobsInPeriod,
      jobsInPreviousPeriod,
      clipMetrics,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: UserRole.USER }).exec(),
      this.userModel
        .countDocuments({ isActive: true, role: UserRole.USER })
        .exec(),
      this.userModel
        .countDocuments({
          createdAt: { $gte: sevenDaysAgo },
          role: UserRole.USER,
        })
        .exec(),
      this.userModel
        .countDocuments({ plan: UserPlan.FREE, role: UserRole.USER })
        .exec(),
      this.userModel
        .countDocuments({ plan: UserPlan.PRO, role: UserRole.USER })
        .exec(),
      this.userModel
        .countDocuments({ plan: UserPlan.BUSINESS, role: UserRole.USER })
        .exec(),
      this.jobModel.countDocuments({}).exec(),
      this.jobModel
        .countDocuments({
          status: JobStatus.COMPLETED,
          updatedAt: { $gte: startOfDay },
        })
        .exec(),
      this.jobModel
        .countDocuments({
          status: JobStatus.FAILED,
          updatedAt: { $gte: startOfDay },
        })
        .exec(),
      this.jobModel.countDocuments({ status: JobStatus.PENDING }).exec(),
      this.jobModel
        .countDocuments({
          status: {
            $in: [
              JobStatus.TRANSCRIBING,
              JobStatus.DETECTING_HIGHLIGHTS,
              JobStatus.CUTTING_CLIPS,
            ],
          },
        })
        .exec(),
      this.customerModel
        .countDocuments({ paddleSubscriptionStatus: 'active' })
        .exec(),
      this.customerModel
        .countDocuments({ paddleSubscriptionStatus: 'past_due' })
        .exec(),
      this.activityModel
        .find()
        .populate('actorId', 'email name role')
        .populate('userId', 'email name role')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .exec(),
      // User signups grouped by day for the requested dashboard window.
      this.userModel.aggregate([
        { $match: { createdAt: { $gte: rangeStart }, role: UserRole.USER } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Job activity grouped by day and status for the requested dashboard window.
      this.jobModel.aggregate([
        { $match: { createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: {
              date: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              status: '$status',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),
      // Generated clips grouped by their embedded creation timestamp.
      this.jobModel.aggregate([
        { $unwind: { path: '$clips', preserveNullAndEmptyArrays: false } },
        { $match: { 'clips.createdAt': { $gte: rangeStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$clips.createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Job status breakdown all-time
      this.jobModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      this.fetchQueueHealth(),
      this.userModel
        .countDocuments({
          role: UserRole.USER,
          createdAt: { $gte: rangeStart },
        })
        .exec(),
      this.userModel
        .countDocuments({
          role: UserRole.USER,
          createdAt: { $gte: previousRangeStart, $lt: rangeStart },
        })
        .exec(),
      this.jobModel.countDocuments({ createdAt: { $gte: rangeStart } }).exec(),
      this.jobModel
        .countDocuments({
          createdAt: { $gte: previousRangeStart, $lt: rangeStart },
        })
        .exec(),
      this.jobModel
        .aggregate<{
          total: number;
          generatedToday: number;
          generatedInPeriod: number;
          generatedInPreviousPeriod: number;
        }>([
          { $unwind: { path: '$clips', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              generatedToday: {
                $sum: {
                  $cond: [{ $gte: ['$clips.createdAt', startOfDay] }, 1, 0],
                },
              },
              generatedInPeriod: {
                $sum: {
                  $cond: [{ $gte: ['$clips.createdAt', rangeStart] }, 1, 0],
                },
              },
              generatedInPreviousPeriod: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ['$clips.createdAt', previousRangeStart] },
                        { $lt: ['$clips.createdAt', rangeStart] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $project: { _id: 0 } },
        ])
        .then(
          (rows) =>
            rows[0] || {
              total: 0,
              generatedToday: 0,
              generatedInPeriod: 0,
              generatedInPreviousPeriod: 0,
            },
        ),
    ]);

    // Calculate MRR: Pro = $19/mo ($1900 cents), Business = $49/mo ($4900 cents)
    const mrrCents = proUsersCount * 1900 + businessUsersCount * 4900;
    const paidCount = proUsersCount + businessUsersCount;

    // Calculate all-time job success rate
    const completedAllTime =
      jobStatusAgg.find((s) => s._id === JobStatus.COMPLETED)?.count || 0;
    const failedAllTime =
      jobStatusAgg.find((s) => s._id === JobStatus.FAILED)?.count || 0;
    const totalFinished = completedAllTime + failedAllTime;
    const successRate =
      totalFinished > 0
        ? Math.round((completedAllTime / totalFinished) * 100)
        : 100;
    const percentChange = (current: number, previous: number): number => {
      if (previous === 0) return current === 0 ? 0 : 100;
      return Math.round(((current - previous) / previous) * 1000) / 10;
    };

    // Build a complete daily timeline so charts include zero-activity days.
    const dateMapUser: Record<string, number> = {};
    const dateMapJob: Record<
      string,
      { completed: number; failed: number; total: number }
    > = {};
    const dateMapClip: Record<string, number> = {};

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dateMapUser[key] = 0;
      dateMapJob[key] = { completed: 0, failed: 0, total: 0 };
      dateMapClip[key] = 0;
    }

    for (const item of userAggByDate) {
      if (dateMapUser[item._id] !== undefined) {
        dateMapUser[item._id] = item.count;
      }
    }

    for (const item of jobAggByDate) {
      const d = item._id.date;
      const status = item._id.status;
      if (dateMapJob[d]) {
        dateMapJob[d].total += item.count;
        if (status === JobStatus.COMPLETED) {
          dateMapJob[d].completed += item.count;
        } else if (status === JobStatus.FAILED) {
          dateMapJob[d].failed += item.count;
        }
      }
    }

    for (const item of clipAggByDate) {
      if (dateMapClip[item._id] !== undefined) {
        dateMapClip[item._id] = item.count;
      }
    }

    const userGrowthSeries = Object.entries(dateMapUser).map(
      ([date, newUsers]) => ({
        date,
        newUsers,
      }),
    );

    const jobActivitySeries = Object.entries(dateMapJob).map(
      ([date, stats]) => ({
        date,
        completed: stats.completed,
        failed: stats.failed,
        total: stats.total,
      }),
    );

    const clipActivitySeries = Object.entries(dateMapClip).map(
      ([date, generated]) => ({
        date,
        generated,
      }),
    );

    // Status distribution mapping
    const STATUS_LABELS: Record<string, string> = {
      [JobStatus.COMPLETED]: 'Completed',
      [JobStatus.PENDING]: 'Pending',
      [JobStatus.TRANSCRIBING]: 'Transcribing',
      [JobStatus.DETECTING_HIGHLIGHTS]: 'AI Highlights',
      [JobStatus.CUTTING_CLIPS]: 'FFmpeg Render',
      [JobStatus.FAILED]: 'Failed',
    };

    const jobStatusDistribution = Object.values(JobStatus).map((status) => {
      const match = jobStatusAgg.find((s) => s._id === status);
      return {
        status,
        label: STATUS_LABELS[status] || status,
        count: match ? match.count : 0,
      };
    });

    const recentAudit = recentActivities.map((act: any) => {
      const adminEmail =
        act.actorId?.email || act.userId?.email || 'system@blynta.com';
      const adminName = act.actorId?.name || act.userId?.name || 'System';

      return {
        _id: act._id.toString(),
        adminEmail,
        adminName,
        actorType: act.actorType || 'system',
        category: act.category || 'system',
        action: act.type || act.action || 'system.event',
        title: act.title || 'System Event',
        reason:
          act.description ||
          act.title ||
          act.reason ||
          act.type ||
          'Activity logged',
        severity: act.severity || 'info',
        status: act.status || 'success',
        createdAt: act.createdAt || new Date(),
        metadata: act.metadata || {},
      };
    });

    return {
      range,
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisWeek: newUsersThisWeek,
        freeCount: freeUsersCount,
        proCount: proUsersCount,
        businessCount: businessUsersCount,
        paidCount,
      },
      jobs: {
        total: totalJobs,
        completedToday: completedJobsToday,
        failedToday: failedJobsToday,
        pending: pendingJobs,
        processing: processingJobs,
        successRate,
      },
      clips: {
        total: clipMetrics.total,
        generatedToday: clipMetrics.generatedToday,
        generatedInPeriod: clipMetrics.generatedInPeriod,
      },
      billing: {
        activeSubscriptions,
        mrr: mrrCents,
        pastDue: pastDueSubscriptions,
        freeUsers: freeUsersCount,
        proUsers: proUsersCount,
        businessUsers: businessUsersCount,
      },
      comparisons: {
        newUsersInPeriod,
        jobsInPeriod,
        clipsInPeriod: clipMetrics.generatedInPeriod,
        userGrowthRate: percentChange(
          newUsersInPeriod,
          newUsersInPreviousPeriod,
        ),
        jobGrowthRate: percentChange(jobsInPeriod, jobsInPreviousPeriod),
        clipGrowthRate: percentChange(
          clipMetrics.generatedInPeriod,
          clipMetrics.generatedInPreviousPeriod,
        ),
      },
      userGrowthSeries,
      jobActivitySeries,
      clipActivitySeries,
      jobStatusDistribution,
      queueHealth: queueHealthMetrics,
      recentAudit,
    };
  }

  private async fetchQueueHealth(): Promise<QueueMetric[]> {
    const queueDefs = [
      {
        queue: this.jobsQueue,
        name: 'media-processing',
        label: 'Media Worker Pipeline',
      },
      {
        queue: this.youtubeQueue,
        name: 'youtube-publishing',
        label: 'YouTube Publisher',
      },
      {
        queue: this.notificationsQueue,
        name: 'notifications',
        label: 'Notifications Engine',
      },
      { queue: this.mailQueue, name: 'mail', label: 'Transactional Mail' },
      {
        queue: this.activitiesQueue,
        name: 'activities',
        label: 'Activity & Audit Log',
      },
    ];

    const results: QueueMetric[] = [];

    for (const def of queueDefs) {
      try {
        const [counts, isPaused] = await Promise.all([
          def.queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
            'paused',
          ),
          def.queue.isPaused().catch(() => false),
        ]);

        results.push({
          name: def.name,
          label: def.label,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: isPaused,
          isHealthy: true,
        });
      } catch (err) {
        this.logger.warn(
          `Could not fetch BullMQ counts for queue ${def.name}: ${err instanceof Error ? err.message : err}`,
        );
        results.push({
          name: def.name,
          label: def.label,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          isHealthy: false,
        });
      }
    }

    return results;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserPlan, UserRole } from '../../users/schemas/user.schema';
import { Job, JobDocument, JobStatus } from '../../jobs/schemas/job.schema';
import { Customer, CustomerDocument } from '../../billing/schemas/customer.schema';
import { Activity, ActivityDocument } from '../../activities/schemas/activity.schema';

export interface DashboardOverviewResult {
  users: {
    total: number;
    active: number;
    newThisWeek: number;
  };
  jobs: {
    total: number;
    completedToday: number;
    failedToday: number;
    pending: number;
  };
  billing: {
    activeSubscriptions: number;
    mrr: number; // in cents
    pastDue: number;
  };
  recentAudit: Array<{
    _id: string;
    adminEmail?: string;
    action: string;
    reason: string;
    createdAt: string | Date;
  }>;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Job.name)
    private readonly jobModel: Model<JobDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) { }

  async getDashboardOverview(): Promise<DashboardOverviewResult> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersThisWeek,
      totalJobs,
      completedJobsToday,
      failedJobsToday,
      pendingJobs,
      activeSubscriptions,
      pastDueSubscriptions,
      proUsersCount,
      businessUsersCount,
      recentActivities,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: UserRole.USER }).exec(),
      this.userModel.countDocuments({ isActive: true, role: UserRole.USER }).exec(),
      this.userModel.countDocuments({ createdAt: { $gte: sevenDaysAgo }, role: UserRole.USER }).exec(),
      this.jobModel.countDocuments({}).exec(),
      this.jobModel.countDocuments({ status: JobStatus.COMPLETED, updatedAt: { $gte: startOfDay } }).exec(),
      this.jobModel.countDocuments({ status: JobStatus.FAILED, updatedAt: { $gte: startOfDay } }).exec(),
      this.jobModel.countDocuments({
        status: {
          $in: [
            JobStatus.PENDING,
            JobStatus.TRANSCRIBING,
            JobStatus.DETECTING_HIGHLIGHTS,
            JobStatus.CUTTING_CLIPS,
          ],
        },
      }).exec(),
      this.customerModel.countDocuments({ paddleSubscriptionStatus: 'active' }).exec(),
      this.customerModel.countDocuments({ paddleSubscriptionStatus: 'past_due' }).exec(),
      this.userModel.countDocuments({ plan: UserPlan.PRO }).exec(),
      this.userModel.countDocuments({ plan: UserPlan.BUSINESS }).exec(),
      this.activityModel
        .find()
        .populate('actorId', 'email name role')
        .populate('userId', 'email name role')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean()
        .exec(),
    ]);

    // Approximate MRR: Pro = $19/mo (1900 cents), Business = $49/mo (4900 cents)
    const mrrCents = proUsersCount * 1900 + businessUsersCount * 4900;

    const recentAudit = recentActivities.map((act: any) => {
      const adminEmail =
        act.actorId?.email ||
        act.actorId?.name ||
        act.userId?.email ||
        'system';
      return {
        _id: act._id.toString(),
        adminEmail,
        action: act.type || act.action || 'system.event',
        reason: act.description || act.title || act.reason || act.type || 'Activity logged',
        createdAt: act.createdAt || new Date(),
      };
    });

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newThisWeek: newUsersThisWeek,
      },
      jobs: {
        total: totalJobs,
        completedToday: completedJobsToday,
        failedToday: failedJobsToday,
        pending: pendingJobs,
      },
      billing: {
        activeSubscriptions,
        mrr: mrrCents,
        pastDue: pastDueSubscriptions,
      },
      recentAudit,
    };
  }
}

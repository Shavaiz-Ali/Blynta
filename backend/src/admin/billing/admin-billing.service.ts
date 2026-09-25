import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Customer, CustomerDocument } from '../../billing/schemas/customer.schema';
import {
  SubscriptionEvent,
  SubscriptionEventDocument,
} from '../../billing/schemas/subscription-event.schema';
import {
  CreditAdjustment,
  CreditAdjustmentDocument,
} from '../schemas/credit-adjustment.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../../activities/schemas/activity.schema';
import { ActivitiesService } from '../../activities/activities.service';
import { PaddleService } from '../../paddle/paddle.service';
import { BillingService } from '../../billing/billing.service';
import { ListCustomersAdminDto } from '../dto/list-customers-admin.dto';
import { AdjustCreditsDto } from '../dto/adjust-credits.dto';
import { CancelSubscriptionAdminDto } from '../dto/update-subscription-admin.dto';
import { PaginatedResult } from '../dto/list-query.dto';

@Injectable()
export class AdminBillingService {
  private readonly logger = new Logger(AdminBillingService.name);

  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(SubscriptionEvent.name)
    private readonly subscriptionEventModel: Model<SubscriptionEventDocument>,
    @InjectModel(CreditAdjustment.name)
    private readonly creditAdjustmentModel: Model<CreditAdjustmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly activitiesService: ActivitiesService,
    private readonly paddleService: PaddleService,
    private readonly billingService: BillingService,
  ) {}

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    return new Types.ObjectId(id);
  }

  async listCustomers(
    dto: ListCustomersAdminDto,
  ): Promise<PaginatedResult<any>> {
    const page = Math.max(1, dto.page || 1);
    const limit = Math.min(100, Math.max(1, dto.limit || 25));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (dto.paddleSubscriptionStatus) {
      filter.paddleSubscriptionStatus = dto.paddleSubscriptionStatus;
    }

    if (dto.search && dto.search.trim()) {
      const term = dto.search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');

      // Find matching users first by email or name
      const matchingUsers = await this.userModel
        .find({ $or: [{ email: regex }, { name: regex }] })
        .select('_id')
        .lean()
        .exec();

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { paddleCustomerId: regex },
        { paddleSubscriptionId: regex },
        { userId: { $in: userIds } },
      ];
    }

    const sortField = dto.sortBy || 'createdAt';
    const sortOrder = dto.sortOrder === 'asc' ? 1 : -1;

    const [customers, total] = await Promise.all([
      this.customerModel
        .find(filter)
        .populate('userId', 'email name plan role creditsBalance')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.customerModel.countDocuments(filter).exec(),
    ]);

    return {
      data: customers,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getCustomerBillingPicture(userId: string): Promise<{
    customer: CustomerDocument | null;
    subscriptionEvents: SubscriptionEventDocument[];
    creditAdjustments: CreditAdjustmentDocument[];
    user: Partial<UserDocument> | null;
  }> {
    const userObjectId = this.toObjectId(userId);

    const [customer, events, creditAdjustments, user] = await Promise.all([
      this.customerModel.findOne({ userId: userObjectId }).lean().exec(),
      this.subscriptionEventModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.creditAdjustmentModel
        .find({ userId: userObjectId })
        .populate('adminId', 'email name')
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.userModel
        .findById(userObjectId)
        .select('email name plan creditsBalance creditsResetAt totalCreditsUsed')
        .lean()
        .exec(),
    ]);

    return {
      customer: customer as unknown as CustomerDocument | null,
      subscriptionEvents:
        events as unknown as SubscriptionEventDocument[],
      creditAdjustments:
        creditAdjustments as unknown as CreditAdjustmentDocument[],
      user: user as unknown as Partial<UserDocument> | null,
    };
  }

  async adjustCredits(
    userId: string,
    dto: AdjustCreditsDto,
    adminId: string,
  ): Promise<{
    success: boolean;
    previousBalance: number;
    newBalance: number;
    creditAdjustment: CreditAdjustmentDocument;
  }> {
    const userObjectId = this.toObjectId(userId);
    const adminObjectId = this.toObjectId(adminId);

    const user = await this.userModel.findById(userObjectId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const previousBalance = user.creditsBalance ?? 0;
    const newBalance = Math.max(0, previousBalance + dto.amount);

    user.creditsBalance = newBalance;
    await user.save();

    // 1. Write dedicated CreditAdjustment record
    const creditAdjustment = await this.creditAdjustmentModel.create({
      userId: userObjectId,
      adminId: adminObjectId,
      amount: dto.amount,
      previousBalance,
      newBalance,
      reason: dto.reason,
    });

    // 2. Write Activity audit entry
    const activityType =
      dto.amount >= 0 ? ActivityType.CREDIT_BONUS : ActivityType.CREDIT_DEDUCT;

    await this.activitiesService.create({
      userId: userObjectId,
      actorType: ActivityActorType.ADMIN,
      actorId: adminObjectId,
      category: ActivityCategory.CREDIT,
      type: activityType,
      title: `Admin adjusted credits (${dto.amount >= 0 ? '+' : ''}${dto.amount})`,
      description: `Reason: ${dto.reason}`,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      entityType: 'credit_adjustment',
      entityId: creditAdjustment._id as Types.ObjectId,
      metadata: {
        amount: dto.amount,
        previousBalance,
        newBalance,
        reason: dto.reason,
      },
    });

    return {
      success: true,
      previousBalance,
      newBalance,
      creditAdjustment: creditAdjustment as unknown as CreditAdjustmentDocument,
    };
  }

  async cancelSubscription(
    userId: string,
    dto: CancelSubscriptionAdminDto,
    adminId: string,
  ): Promise<{ message: string; customer: CustomerDocument | null }> {
    const userObjectId = this.toObjectId(userId);
    const adminObjectId = this.toObjectId(adminId);

    const customer = await this.customerModel
      .findOne({ userId: userObjectId })
      .exec();

    if (!customer || !customer.paddleSubscriptionId) {
      throw new BadRequestException(
        'User does not have an active Paddle subscription to cancel',
      );
    }

    const immediately = dto.immediately ?? false;
    const subscriptionId = customer.paddleSubscriptionId;

    try {
      // 1. Call Paddle API to cancel
      await this.paddleService.paddle.subscriptions.cancel(subscriptionId, {
        effectiveFrom: immediately ? 'immediately' : 'next_billing_period',
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to cancel Paddle subscription ${subscriptionId}: ${err?.message}`,
      );
      throw new InternalServerErrorException(
        `Failed to cancel subscription on Paddle: ${err?.message || 'unknown error'}`,
      );
    }

    // 2. If immediately, revert DB to free
    if (immediately) {
      await this.billingService.revertSubscriptionToFree({
        paddleSubscriptionId: subscriptionId,
        paddleCustomerId: customer.paddleCustomerId,
        status: 'canceled',
        eventType: 'admin.subscription.canceled',
      });
    } else {
      customer.paddleScheduledChangeAction = 'cancel';
      customer.paddleScheduledChangeAt =
        customer.currentBillingPeriodEndsAt ?? new Date();
      await customer.save();
    }

    // 3. Write Activity audit entry
    await this.activitiesService.create({
      userId: userObjectId,
      actorType: ActivityActorType.ADMIN,
      actorId: adminObjectId,
      category: ActivityCategory.BILLING,
      type: ActivityType.BILLING_SUBSCRIPTION_CANCEL,
      title: `Admin canceled subscription (${immediately ? 'immediately' : 'at period end'})`,
      description: `Reason: ${dto.reason}`,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.WARNING,
      entityType: 'subscription',
      metadata: {
        paddleSubscriptionId: subscriptionId,
        immediately,
        reason: dto.reason,
      },
    });

    const updatedCustomer = await this.customerModel
      .findOne({ userId: userObjectId })
      .lean()
      .exec();

    return {
      message: immediately
        ? 'Subscription canceled immediately and user reverted to free plan'
        : 'Subscription scheduled for cancellation at the end of the billing period',
      customer: updatedCustomer as unknown as CustomerDocument | null,
    };
  }
}

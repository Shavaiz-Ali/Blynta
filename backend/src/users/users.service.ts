import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserDocument,
  UserPlan,
  PLAN_CREDITS,
  AuthProvider,
} from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import {
  DuplicateEmailException,
  InsufficientCreditsException,
} from '../common/exceptions';
import {
  ReferralReward,
  ReferralRewardDocument,
} from './schemas/referral-reward.schema';
import { generateReferralCode } from './utils/generate-referral-code';
import { REFERRAL_CONFIG } from './referral.constants';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationCategory,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { ConfigService } from '@nestjs/config';
import { R2Service } from '../storage/r2.service';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ReferralReward.name)
    private referralRewardModel: Model<ReferralRewardDocument>,
    private mailService: MailService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
    private r2Service: R2Service,
    private activitiesService: ActivitiesService,
  ) {}

  private async generateUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      const existing = await this.userModel
        .findOne({ referralCode: code })
        .exec();
      if (!existing) return code;
    }
    throw new Error(
      'Failed to generate a unique referral code after 5 attempts',
    );
  }

  async create(
    dto: CreateUserDto,
    referredByCode?: string,
  ): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new DuplicateEmailException();
    }

    const referralCode = await this.generateUniqueReferralCode();

    let referredBy: Types.ObjectId | undefined;
    if (referredByCode) {
      const referrer = await this.userModel
        .findOne({ referralCode: referredByCode })
        .exec();
      // Silently ignore an invalid/unknown code — never block signup over a bad referral link,
      // and never let the person know their code didn't match anything (no useful info to leak).
      if (referrer && referrer.email !== dto.email) {
        referredBy = referrer._id;
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);

    const user = new this.userModel({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      plan: UserPlan.FREE,
      creditsBalance: PLAN_CREDITS[UserPlan.FREE],
      creditsResetAt: nextReset,
      linkedAccounts: [{ provider: AuthProvider.LOCAL, providerId: dto.email }],
      referralCode,
      referredBy,
    });
    return user.save();
  }

  async findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).select('+password').exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async validatePassword(plainPassword: string, hashedPassword: string) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async findByProviderId(provider: AuthProvider, providerId: string) {
    return this.userModel
      .findOne({
        linkedAccounts: { $elemMatch: { provider, providerId } },
      })
      .exec();
  }

  async findOrCreateFromSocialProvider(params: {
    provider: AuthProvider;
    providerId: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }) {
    const { provider, providerId, email, name, avatarUrl } = params;

    let user = await this.findByProviderId(provider, providerId);
    if (user) return user;

    user = await this.userModel.findOne({ email }).exec();
    if (user) {
      user.linkedAccounts.push({ provider, providerId, linkedAt: new Date() });
      if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
      return user.save();
    }

    const referralCode = await this.generateUniqueReferralCode();
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);

    const newUser = new this.userModel({
      email,
      name,
      avatarUrl,
      emailVerified: true,
      linkedAccounts: [{ provider, providerId, linkedAt: new Date() }],
      plan: UserPlan.FREE,
      creditsBalance: PLAN_CREDITS[UserPlan.FREE],
      creditsResetAt: nextReset,
      referralCode,
    });
    return newUser.save();
  }

  async deductCredit(userId: string): Promise<void> {
    const result = await this.userModel.updateOne(
      { _id: userId, creditsBalance: { $gt: 0 } },
      { $inc: { creditsBalance: -1, totalCreditsUsed: 1 } },
    );
    if (result.modifiedCount === 0) {
      throw new InsufficientCreditsException();
    }
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async setOtp(userId: string, otp: string): Promise<void> {
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.userModel.updateOne(
      { _id: userId },
      { otpCode: hashedOtp, otpExpiresAt: expiresAt },
    );
  }

  async verifyOtpCode(userId: string, otp: string): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('+otpCode')
      .exec();
    if (
      !user ||
      !user.otpCode ||
      !user.otpExpiresAt ||
      user.otpExpiresAt < new Date()
    ) {
      return false;
    }
    return bcrypt.compare(otp, user.otpCode);
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { emailVerified: true, otpCode: undefined, otpExpiresAt: undefined },
    );
  }

  async setPasswordResetToken(userId: string, token: string): Promise<void> {
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.userModel.updateOne(
      { _id: userId },
      { passwordResetToken: hashedToken, passwordResetExpiresAt: expiresAt },
    );
  }

  async findByValidResetToken(token: string) {
    const users = await this.userModel
      .find({ passwordResetExpiresAt: { $gt: new Date() } })
      .select('+passwordResetToken')
      .exec();

    for (const user of users) {
      if (
        user.passwordResetToken &&
        (await bcrypt.compare(token, user.passwordResetToken))
      ) {
        return user;
      }
    }
    return null;
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.updateOne(
      { _id: userId },
      {
        password: hashedPassword,
        passwordResetToken: undefined,
        passwordResetExpiresAt: undefined,
      },
    );
  }

  async updateAvatar(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{ avatarUrl: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const extension =
      mimeType === 'image/png'
        ? 'png'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'jpg';
    const objectKey = `avatars/${userId}-${Date.now()}.${extension}`;

    await this.r2Service.uploadBuffer(fileBuffer, objectKey, mimeType);
    const avatarUrl = await this.r2Service.getPublicOrSignedUrl(objectKey);

    await this.userModel.updateOne({ _id: userId }, { avatarUrl });
    this.logger.log(`Updated avatar for user ${userId}: ${avatarUrl}`);

    await this.activitiesService.queueCreate({
      userId,
      type: ActivityType.AUTH_AVATAR_UPDATE,
      category: ActivityCategory.ACCOUNT,
      title: 'Profile picture updated',
      description: 'Your profile picture was updated successfully.',
      activityUrl: '/profile',
      entityType: 'user',
      entityId: userId,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { avatarUrl };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user || !user.password) {
      throw new BadRequestException(
        'This account does not have a password set. Password change is only available for accounts created with email/password.',
      );
    }
    const isValid = await this.validatePassword(currentPassword, user.password);
    if (!isValid)
      throw new UnauthorizedException('Current password is incorrect');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userModel.updateOne(
      { _id: userId },
      { password: hashedPassword },
    );
    this.logger.log(`Changed password for user ${userId}`);

    await this.activitiesService.queueCreate({
      userId,
      type: ActivityType.AUTH_PASSWORD_CHANGE,
      category: ActivityCategory.ACCOUNT,
      title: 'Password changed',
      description: 'Your account password was updated.',
      activityUrl: '/profile',
      entityType: 'user',
      entityId: userId,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.SUCCESS,
    });

    return { message: 'Password changed successfully' };
  }

  async markWelcomed(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId, isWelcomed: false },
      { isWelcomed: true },
    );
  }

  // --- Referrals ---

  async handleFirstLoginReferralCheck(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).exec();
    if (!user || user.hasLoggedInOnce) return;

    await this.userModel.updateOne({ _id: userId }, { hasLoggedInOnce: true });

    if (!user.referredBy) return;

    await this.grantReferralReward(user.referredBy.toString(), userId);
  }

  private async grantReferralReward(
    referrerId: string,
    referredUserId: string,
  ): Promise<void> {
    const referrer = await this.userModel.findById(referrerId).exec();
    if (!referrer) return;

    if (
      referrer.successfulReferralCount >=
      REFERRAL_CONFIG.MAX_SUCCESSFUL_REFERRALS_PER_USER
    ) {
      this.logger.warn(
        `Referrer ${referrerId} hit the referral cap — no reward granted for ${referredUserId}`,
      );
      return;
    }

    try {
      await this.referralRewardModel.create({
        referrerId,
        referredUserId,
        referrerCreditsAwarded: REFERRAL_CONFIG.REFERRER_CREDITS,
        referredUserCreditsAwarded: REFERRAL_CONFIG.REFERRED_USER_BONUS_CREDITS,
      });
    } catch (err: any) {
      if (err.code === 11000) return; // duplicate key — already granted, safe no-op
      throw err;
    }

    const updatedReferrer = await this.userModel.findOneAndUpdate(
      { _id: referrerId },
      {
        $inc: {
          creditsBalance: REFERRAL_CONFIG.REFERRER_CREDITS,
          successfulReferralCount: 1,
        },
      },
      { new: true },
    );
    await this.userModel.updateOne(
      { _id: referredUserId },
      { $inc: { creditsBalance: REFERRAL_CONFIG.REFERRED_USER_BONUS_CREDITS } },
    );

    try {
      // In-app notification for referrer
      await this.notificationsService.queueCreateIfNotExists({
        userId: referrerId,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.REFERRAL,
        title: `+${REFERRAL_CONFIG.REFERRER_CREDITS} Referral bonus credits`,
        message:
          'A creator you invited just joined Blynta! Your bonus credits have been applied.',
        actionUrl: '/dashboard',
        actionLabel: 'View credits',
        dedupeKey: `referral:reward:${referrerId}:${referredUserId}`,
      });

      // In-app notification for referred user
      await this.notificationsService.queueCreateIfNotExists({
        userId: referredUserId,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.REFERRAL,
        title: `+${REFERRAL_CONFIG.REFERRED_USER_BONUS_CREDITS} Welcome bonus credits`,
        message:
          'Welcome bonus credits have been added to your account for joining via an invite.',
        actionUrl: '/dashboard',
        actionLabel: 'View credits',
        dedupeKey: `referral:welcome:${referredUserId}`,
      });

      // Email for referrer
      if (updatedReferrer?.email) {
        await this.mailService.queueReferralRewardEmail(
          updatedReferrer.email,
          REFERRAL_CONFIG.REFERRER_CREDITS,
          updatedReferrer.creditsBalance,
        );
      }
      // Activities for referral reward
      await this.activitiesService.queueCreateIfNotExists({
        userId: referrerId,
        type: ActivityType.REFERRAL_REWARD_EARNED,
        category: ActivityCategory.REFERRAL,
        title: `+${REFERRAL_CONFIG.REFERRER_CREDITS} Referral bonus credits`,
        description:
          'A creator you invited joined Blynta! Referral bonus credits were awarded.',
        activityUrl: '/profile',
        entityType: 'user',
        entityId: referrerId,
        actorType: ActivityActorType.SYSTEM,
        isSystem: true,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.SUCCESS,
        dedupeKey: `activity:referral:reward:${referrerId}:${referredUserId}`,
        metadata: {
          creditsAwarded: REFERRAL_CONFIG.REFERRER_CREDITS,
          referredUserId,
        },
      });

      await this.activitiesService.queueCreateIfNotExists({
        userId: referredUserId,
        type: ActivityType.CREDIT_BONUS,
        category: ActivityCategory.CREDIT,
        title: `+${REFERRAL_CONFIG.REFERRED_USER_BONUS_CREDITS} Welcome bonus credits`,
        description:
          'Welcome bonus credits were added to your account for joining via an invite link.',
        activityUrl: '/dashboard',
        entityType: 'user',
        entityId: referredUserId,
        actorType: ActivityActorType.SYSTEM,
        isSystem: true,
        status: ActivityStatus.SUCCESS,
        severity: ActivitySeverity.SUCCESS,
        dedupeKey: `activity:referral:welcome:${referredUserId}`,
        metadata: {
          creditsAwarded: REFERRAL_CONFIG.REFERRED_USER_BONUS_CREDITS,
          referrerId,
        },
      });
    } catch (notifErr) {
      this.logger.warn(
        `Failed to dispatch referral reward notification/email/activity: ${notifErr}`,
      );
    }
  }

  async getReferralStats(userId: string): Promise<{
    referralCode: string;
    successfulReferralCount: number;
    maxReferrals: number;
    totalCreditsEarned: number;
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const rewards = await this.referralRewardModel
      .find({ referrerId: userId })
      .exec();
    const totalCreditsEarned = rewards.reduce(
      (sum, r) => sum + r.referrerCreditsAwarded,
      0,
    );

    return {
      referralCode: user.referralCode,
      successfulReferralCount: user.successfulReferralCount,
      maxReferrals: REFERRAL_CONFIG.MAX_SUCCESSFUL_REFERRALS_PER_USER,
      totalCreditsEarned,
    };
  }

  async sendReferralInvite(
    userId: string,
    inviteeEmail: string,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    if (inviteeEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const alreadyExists = await this.userModel
      .findOne({ email: inviteeEmail })
      .exec();
    if (alreadyExists) {
      throw new ConflictException('This person already has a Blynta account');
    }

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000') ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    const referralLink = `${frontendUrl}/signup?ref=${user.referralCode}`;

    this.logger.log(
      `Queueing referral invite email from user ${userId} (${user.email}) to ${inviteeEmail}`,
    );

    await this.mailService.queueReferralInviteEmail(
      inviteeEmail,
      user.name || user.email,
      referralLink,
    );

    await this.activitiesService.queueCreate({
      userId,
      type: ActivityType.REFERRAL_INVITE_SENT,
      category: ActivityCategory.REFERRAL,
      title: 'Referral invite sent',
      description: `You sent a referral invite to ${inviteeEmail}.`,
      activityUrl: '/profile',
      entityType: 'user',
      entityId: userId,
      actorType: ActivityActorType.USER,
      actorId: userId,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
      metadata: { inviteeEmail },
    });

    return { message: 'Invite sent' };
  }
}

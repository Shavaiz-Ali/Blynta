import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserPlan, PLAN_CREDITS, AuthProvider } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import {
  DuplicateEmailException,
  InsufficientCreditsException,
} from '../common/exceptions';
import { ReferralReward, ReferralRewardDocument } from './schemas/referral-reward.schema';
import { generateReferralCode } from './utils/generate-referral-code';
import { REFERRAL_CONFIG } from './referral.constants';
import { ConfigService } from '@nestjs/config';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(ReferralReward.name) private referralRewardModel: Model<ReferralRewardDocument>,
    private mailService: MailService,
    private configService: ConfigService,
  ) { }

  private async generateUniqueReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      const existing = await this.userModel.findOne({ referralCode: code }).exec();
      if (!existing) return code;
    }
    throw new Error('Failed to generate a unique referral code after 5 attempts');
  }

  async create(dto: CreateUserDto, referredByCode?: string): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new DuplicateEmailException();
    }

    const referralCode = await this.generateUniqueReferralCode();

    let referredBy: Types.ObjectId | undefined;
    if (referredByCode) {
      const referrer = await this.userModel.findOne({ referralCode: referredByCode }).exec();
      // Silently ignore an invalid/unknown code — never block signup over a bad referral link,
      // and never let the person know their code didn't match anything (no useful info to leak).
      if (referrer && referrer.email !== dto.email) {
        referredBy = referrer._id as Types.ObjectId;
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
    return this.userModel.findOne({
      linkedAccounts: { $elemMatch: { provider, providerId } },
    }).exec();
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
    const user = await this.userModel.findById(userId).select('+otpCode').exec();
    if (!user || !user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
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
      if (user.passwordResetToken && (await bcrypt.compare(token, user.passwordResetToken))) {
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

  private async grantReferralReward(referrerId: string, referredUserId: string): Promise<void> {
    const referrer = await this.userModel.findById(referrerId).exec();
    if (!referrer) return;

    if (referrer.successfulReferralCount >= REFERRAL_CONFIG.MAX_SUCCESSFUL_REFERRALS_PER_USER) {
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

    await this.userModel.updateOne(
      { _id: referrerId },
      {
        $inc: {
          creditsBalance: REFERRAL_CONFIG.REFERRER_CREDITS,
          successfulReferralCount: 1,
        },
      },
    );
    await this.userModel.updateOne(
      { _id: referredUserId },
      { $inc: { creditsBalance: REFERRAL_CONFIG.REFERRED_USER_BONUS_CREDITS } },
    );
  }

  async getReferralStats(userId: string): Promise<{
    referralCode: string;
    successfulReferralCount: number;
    maxReferrals: number;
    totalCreditsEarned: number;
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const rewards = await this.referralRewardModel.find({ referrerId: userId }).exec();
    const totalCreditsEarned = rewards.reduce((sum, r) => sum + r.referrerCreditsAwarded, 0);

    return {
      referralCode: user.referralCode,
      successfulReferralCount: user.successfulReferralCount,
      maxReferrals: REFERRAL_CONFIG.MAX_SUCCESSFUL_REFERRALS_PER_USER,
      totalCreditsEarned,
    };
  }

  async sendReferralInvite(userId: string, inviteeEmail: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    if (inviteeEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const alreadyExists = await this.userModel.findOne({ email: inviteeEmail }).exec();
    if (alreadyExists) {
      throw new ConflictException('This person already has a Blynta account');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const referralLink = `${frontendUrl}/signup?ref=${user.referralCode}`;

    await this.mailService.queueReferralInviteEmail(
      inviteeEmail,
      user.name || user.email,
      referralLink,
    );

    return { message: 'Invite sent' };
  }
}
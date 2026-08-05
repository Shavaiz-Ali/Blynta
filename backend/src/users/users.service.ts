import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, UserPlan, PLAN_CREDITS, AuthProvider } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import {
  DuplicateEmailException,
  InsufficientCreditsException,
} from '../common/exceptions';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) { }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new DuplicateEmailException();
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
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userModel.updateOne(
      { _id: userId },
      { passwordResetToken: hashedToken, passwordResetExpiresAt: expiresAt },
    );
  }

  // Since the token is hashed, we can't query by it directly (like we do with email/googleId) —
  // we have to fetch candidate users with a non-expired token and compare each hash.
  // In practice, for a single-token-at-a-time-per-user flow, this is safe and fast at your scale.
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
}
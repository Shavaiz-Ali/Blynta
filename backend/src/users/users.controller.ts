import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SendReferralInviteDto } from './dto/send-referral-invite.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ActivitiesService } from '../activities/activities.service';
import {
  ActivityActorType,
  ActivityCategory,
  ActivitySeverity,
  ActivityStatus,
  ActivityType,
} from '../activities/schemas/activity.schema';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(
    private usersService: UsersService,
    private activitiesService: ActivitiesService,
  ) { }

  @Get('me')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      plan: user.plan,
      creditsBalance: user.creditsBalance,
      creditsResetAt: user.creditsResetAt,
      role: user.role,
      isWelcomed: user.isWelcomed,
      referralCode: user.referralCode,
      linkedAccounts: user.linkedAccounts || [],
      createdAt: (user as any).createdAt,
    };
  }

  @Patch('me')
  async updateProfile(@Request() req, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found');

    if (dto.name !== undefined) user.name = dto.name;
    await user.save();

    await this.activitiesService.queueCreate({
      userId: user._id,
      type: ActivityType.AUTH_PROFILE_UPDATE,
      category: ActivityCategory.ACCOUNT,
      title: 'Profile updated',
      description: 'Your profile information was updated.',
      activityUrl: '/profile',
      entityType: 'user',
      entityId: user._id,
      actorType: ActivityActorType.USER,
      actorId: user._id,
      status: ActivityStatus.SUCCESS,
      severity: ActivitySeverity.INFO,
    });

    return { id: user._id, name: user.name };
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname?: string; size?: number },
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Avatar must be a JPEG, PNG, or WebP image');
    }
    return this.usersService.updateAvatar(
      req.user.userId,
      file.buffer,
      file.mimetype,
    );
  }

  @Post('me/change-password')
  async changePassword(@Request() req, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Patch('me/welcomed')
  async markWelcomed(@Request() req) {
    await this.usersService.markWelcomed(req.user.userId);
    return { message: 'Welcome screen marked as seen' };
  }

  @Post(['referrals/invite', 'me/referrals/invite', 'me/referrals'])
  async sendReferralInvite(@Request() req, @Body() dto: SendReferralInviteDto) {
    return this.usersService.sendReferralInvite(req.user.userId, dto.email);
  }

  @Get(['referrals/stats', 'me/referrals'])
  async getReferralStats(@Request() req) {
    return this.usersService.getReferralStats(req.user.userId);
  }
}
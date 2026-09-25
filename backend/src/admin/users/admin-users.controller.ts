import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { AuthenticatedUser } from '../../auth/jwt.strategy';
import { AdminUsersService } from './admin-users.service';
import { ListUsersAdminDto } from '../dto/list-users-admin.dto';
import { UpdateUserAdminDto } from '../dto/update-user-admin.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async listUsers(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListUsersAdminDto,
  ) {
    return this.adminUsersService.listUsers(query);
  }

  @Get(':id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminUsersService.getUserDetail(id);
  }

  @Patch(':id')
  async updateUser(
    @Param('id') id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    dto: UpdateUserAdminDto,
    @CurrentAdmin() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateUser(id, dto, admin.userId);
  }
}

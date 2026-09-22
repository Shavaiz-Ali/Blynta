import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ListActivitiesDto } from './dto/list-activities.dto';
import { ActivitiesService } from './activities.service';

@Controller('activities')
@UseGuards(AuthGuard('jwt'))
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  list(@Request() req, @Query() query: ListActivitiesDto) {
    return this.activitiesService.listForUser(req.user.userId, {
      page: query.page,
      limit: query.limit,
      category: query.category,
      type: query.type,
      status: query.status,
      search: query.search,
    });
  }

  @Get('stats')
  stats(@Request() req) {
    return this.activitiesService.getStatsForUser(req.user.userId);
  }
}

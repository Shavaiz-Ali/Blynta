import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Types } from 'mongoose';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminNotificationsController } from './admin-notifications.controller';
import { User, UserPlan, UserRole } from '../../users/schemas/user.schema';
import {
  NOTIFICATIONS_QUEUE,
  NOTIFICATION_JOBS,
} from '../../notifications/notifications.constants';
import { NotificationType } from '../../notifications/schemas/notification.schema';
import { ActivityActorType } from '../../activities/schemas/activity.schema';
import { ActivitiesService } from '../../activities/activities.service';

describe('AdminNotifications Module', () => {
  let controller: AdminNotificationsController;
  let service: AdminNotificationsService;

  const mockAdminId = new Types.ObjectId().toString();
  const mockUser1 = { _id: new Types.ObjectId() };
  const mockUser2 = { _id: new Types.ObjectId() };

  const userModelMock = {
    find: jest.fn(),
  };

  const queueMock = {
    addBulk: jest.fn(),
  };

  const activitiesServiceMock = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminNotificationsController],
      providers: [
        AdminNotificationsService,
        {
          provide: getModelToken(User.name),
          useValue: userModelMock,
        },
        {
          provide: getQueueToken(NOTIFICATIONS_QUEUE),
          useValue: queueMock,
        },
        {
          provide: ActivitiesService,
          useValue: activitiesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminNotificationsController>(
      AdminNotificationsController,
    );
    service = module.get<AdminNotificationsService>(AdminNotificationsService);
  });

  describe('broadcast (mutating endpoint)', () => {
    it('queues notifications in BullMQ and creates an Activity audit entry with actorType ADMIN', async () => {
      userModelMock.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([mockUser1, mockUser2]),
          }),
        }),
      });

      queueMock.addBulk.mockResolvedValue([]);
      activitiesServiceMock.create.mockResolvedValue({});

      const broadcastDto = {
        title: 'Platform Maintenance Notice',
        message: 'System upgrade scheduled for 2 AM UTC',
        type: NotificationType.INFO,
        filter: { plan: UserPlan.PRO },
        reason: 'Monthly infrastructure upgrade',
      };

      const result = await controller.broadcast(
        broadcastDto,
        {
          userId: mockAdminId,
          email: 'admin@blynta.com',
          role: UserRole.ADMIN,
        },
      );

      // Verify recipient matching & queueing
      expect(result.queuedCount).toBe(2);
      expect(queueMock.addBulk).toHaveBeenCalledTimes(1);
      expect(queueMock.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: NOTIFICATION_JOBS.CREATE,
            data: expect.objectContaining({
              userId: mockUser1._id.toString(),
              title: 'Platform Maintenance Notice',
            }),
          }),
          expect.objectContaining({
            name: NOTIFICATION_JOBS.CREATE,
            data: expect.objectContaining({
              userId: mockUser2._id.toString(),
              title: 'Platform Maintenance Notice',
            }),
          }),
        ]),
      );

      // Verify audit log creation
      expect(activitiesServiceMock.create).toHaveBeenCalledTimes(1);
      expect(activitiesServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: ActivityActorType.ADMIN,
          actorId: expect.any(Types.ObjectId),
          description: expect.stringContaining('Monthly infrastructure upgrade'),
          metadata: expect.objectContaining({
            recipientCount: 2,
            reason: 'Monthly infrastructure upgrade',
          }),
        }),
      );
    });
  });
});

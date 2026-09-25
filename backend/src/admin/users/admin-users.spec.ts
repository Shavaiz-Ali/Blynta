import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { User, UserPlan, UserRole } from '../../users/schemas/user.schema';
import { Customer } from '../../billing/schemas/customer.schema';
import { Job } from '../../jobs/schemas/job.schema';
import { Activity, ActivityActorType } from '../../activities/schemas/activity.schema';
import { ActivitiesService } from '../../activities/activities.service';

describe('AdminUsers Module', () => {
  let controller: AdminUsersController;
  let service: AdminUsersService;

  const mockAdminId = new Types.ObjectId().toString();
  const mockTargetUserId = new Types.ObjectId().toString();

  const mockUserDoc = {
    _id: new Types.ObjectId(mockTargetUserId),
    email: 'test@blynta.com',
    name: 'Test User',
    role: UserRole.USER,
    plan: UserPlan.FREE,
    isActive: true,
    emailVerified: false,
    creditsBalance: 5,
  };

  const userModelMock = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const customerModelMock = {
    findOne: jest.fn(),
  };

  const jobModelMock = {
    countDocuments: jest.fn(),
  };

  const activityModelMock = {
    find: jest.fn(),
  };

  const activitiesServiceMock = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        AdminUsersService,
        {
          provide: getModelToken(User.name),
          useValue: userModelMock,
        },
        {
          provide: getModelToken(Customer.name),
          useValue: customerModelMock,
        },
        {
          provide: getModelToken(Job.name),
          useValue: jobModelMock,
        },
        {
          provide: getModelToken(Activity.name),
          useValue: activityModelMock,
        },
        {
          provide: ActivitiesService,
          useValue: activitiesServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    service = module.get<AdminUsersService>(AdminUsersService);
  });

  describe('listUsers', () => {
    it('returns paginated users with meta', async () => {
      userModelMock.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([mockUserDoc]),
                }),
              }),
            }),
          }),
        }),
      });
      userModelMock.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await controller.listUsers({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('getUserDetail', () => {
    it('assembles user + customer + recent activities + job count in one call', async () => {
      userModelMock.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockUserDoc),
          }),
        }),
      });

      customerModelMock.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            paddleCustomerId: 'ctm_123',
            paddleSubscriptionStatus: 'active',
          }),
        }),
      });

      activityModelMock.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([{ title: 'Logged in' }]),
            }),
          }),
        }),
      });

      jobModelMock.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(3),
      });

      const result = await controller.getUserDetail(mockTargetUserId);
      expect(result.user).toBeDefined();
      expect(result.customer).toBeDefined();
      expect(result.recentActivities).toHaveLength(1);
      expect(result.jobsCount).toBe(3);
    });
  });

  describe('updateUser (mutating endpoint)', () => {
    it('updates user fields AND writes an Activity audit entry with actorType ADMIN and actorId', async () => {
      userModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockUserDoc,
          role: UserRole.USER,
          isActive: true,
        }),
      });

      userModelMock.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({
              ...mockUserDoc,
              role: UserRole.ADMIN,
              isActive: true,
            }),
          }),
        }),
      });

      activitiesServiceMock.create.mockResolvedValue({});

      const updateDto = {
        role: UserRole.ADMIN,
        reason: 'Promoted to admin by superadmin support ticket #42',
      };

      const result = await controller.updateUser(
        mockTargetUserId,
        updateDto,
        {
          userId: mockAdminId,
          email: 'superadmin@blynta.com',
          role: UserRole.ADMIN,
        },
      );

      // Primary write check
      expect(result.role).toBe(UserRole.ADMIN);

      // Audit log side effect check
      expect(activitiesServiceMock.create).toHaveBeenCalledTimes(1);
      expect(activitiesServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          actorType: ActivityActorType.ADMIN,
          actorId: expect.any(Types.ObjectId),
          description: expect.stringContaining('Promoted to admin'),
          metadata: expect.objectContaining({
            reason: 'Promoted to admin by superadmin support ticket #42',
          }),
        }),
      );
    });
  });
});

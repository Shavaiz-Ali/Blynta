import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditController } from './admin-audit.controller';
import {
  Activity,
  ActivityActorType,
  ActivityCategory,
  ActivityType,
} from '../../activities/schemas/activity.schema';

describe('AdminAudit Module', () => {
  let controller: AdminAuditController;
  let service: AdminAuditService;

  const mockAdminId = new Types.ObjectId().toString();
  const mockUserId = new Types.ObjectId().toString();

  const mockAuditDoc = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(mockUserId),
    actorId: new Types.ObjectId(mockAdminId),
    actorType: ActivityActorType.ADMIN,
    category: ActivityCategory.CREDIT,
    type: ActivityType.CREDIT_BONUS,
    title: 'Admin adjusted credits (+50)',
    description: 'Reason: Support refund',
    createdAt: new Date(),
  };

  const activityModelMock = {
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        AdminAuditService,
        {
          provide: getModelToken(Activity.name),
          useValue: activityModelMock,
        },
      ],
    }).compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
    service = module.get<AdminAuditService>(AdminAuditService);
  });

  describe('listAdminAuditLogs', () => {
    it('returns only ADMIN actorType activities with pagination and populated actors', async () => {
      activityModelMock.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  lean: jest.fn().mockReturnValue({
                    exec: jest.fn().mockResolvedValue([mockAuditDoc]),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      activityModelMock.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await controller.listAdminAuditLogs({
        page: 1,
        limit: 10,
        actorId: mockAdminId,
      });

      expect(activityModelMock.find).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: ActivityActorType.ADMIN,
          actorId: expect.any(Types.ObjectId),
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].actorType).toBe(ActivityActorType.ADMIN);
    });
  });
});

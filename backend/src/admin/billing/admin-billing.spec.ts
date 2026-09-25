import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminBillingService } from './admin-billing.service';
import { AdminBillingController } from './admin-billing.controller';
import { Customer } from '../../billing/schemas/customer.schema';
import { SubscriptionEvent } from '../../billing/schemas/subscription-event.schema';
import { CreditAdjustment } from '../schemas/credit-adjustment.schema';
import { User, UserPlan, UserRole } from '../../users/schemas/user.schema';
import { Activity, ActivityActorType } from '../../activities/schemas/activity.schema';
import { ActivitiesService } from '../../activities/activities.service';
import { PaddleService } from '../../paddle/paddle.service';
import { BillingService } from '../../billing/billing.service';

describe('AdminBilling Module', () => {
  let controller: AdminBillingController;
  let service: AdminBillingService;

  const mockAdminId = new Types.ObjectId().toString();
  const mockTargetUserId = new Types.ObjectId().toString();

  const customerModelMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    updateOne: jest.fn(),
  };

  const subscriptionEventModelMock = {
    find: jest.fn(),
  };

  const creditAdjustmentModelMock = {
    create: jest.fn(),
    find: jest.fn(),
  };

  const userModelMock = {
    findById: jest.fn(),
    find: jest.fn(),
  };

  const activitiesServiceMock = {
    create: jest.fn(),
  };

  const paddleServiceMock = {
    paddle: {
      subscriptions: {
        cancel: jest.fn(),
      },
    },
  };

  const billingServiceMock = {
    revertSubscriptionToFree: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBillingController],
      providers: [
        AdminBillingService,
        {
          provide: getModelToken(Customer.name),
          useValue: customerModelMock,
        },
        {
          provide: getModelToken(SubscriptionEvent.name),
          useValue: subscriptionEventModelMock,
        },
        {
          provide: getModelToken(CreditAdjustment.name),
          useValue: creditAdjustmentModelMock,
        },
        {
          provide: getModelToken(User.name),
          useValue: userModelMock,
        },
        {
          provide: ActivitiesService,
          useValue: activitiesServiceMock,
        },
        {
          provide: PaddleService,
          useValue: paddleServiceMock,
        },
        {
          provide: BillingService,
          useValue: billingServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminBillingController>(AdminBillingController);
    service = module.get<AdminBillingService>(AdminBillingService);
  });

  describe('adjustCredits (mutating endpoint)', () => {
    it('updates user creditsBalance, creates a CreditAdjustment doc, AND writes an Activity audit entry with actorType ADMIN', async () => {
      const mockUser = {
        _id: new Types.ObjectId(mockTargetUserId),
        creditsBalance: 10,
        save: jest.fn().mockResolvedValue(true),
      };

      userModelMock.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      const mockAdjustmentDoc = {
        _id: new Types.ObjectId(),
        userId: mockUser._id,
        adminId: new Types.ObjectId(mockAdminId),
        amount: 50,
        previousBalance: 10,
        newBalance: 60,
        reason: 'Customer support compensation',
      };

      creditAdjustmentModelMock.create.mockResolvedValue(mockAdjustmentDoc);
      activitiesServiceMock.create.mockResolvedValue({});

      const result = await controller.adjustCredits(
        mockTargetUserId,
        {
          amount: 50,
          reason: 'Customer support compensation',
        },
        {
          userId: mockAdminId,
          email: 'admin@blynta.com',
          role: UserRole.ADMIN,
        },
      );

      // Primary write check
      expect(mockUser.creditsBalance).toBe(60);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(60);

      // CreditAdjustment record check
      expect(creditAdjustmentModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          adminId: expect.any(Types.ObjectId),
          amount: 50,
          previousBalance: 10,
          newBalance: 60,
          reason: 'Customer support compensation',
        }),
      );

      // Audit log side effect check
      expect(activitiesServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(Types.ObjectId),
          actorType: ActivityActorType.ADMIN,
          actorId: expect.any(Types.ObjectId),
          description: expect.stringContaining('Customer support compensation'),
          metadata: expect.objectContaining({
            amount: 50,
            previousBalance: 10,
            newBalance: 60,
            reason: 'Customer support compensation',
          }),
        }),
      );
    });
  });

  describe('cancelSubscription (mutating endpoint)', () => {
    it('calls Paddle cancel, reverts subscription, and writes an Activity audit entry with actorType ADMIN', async () => {
      const mockCustomer = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(mockTargetUserId),
        paddleSubscriptionId: 'sub_test_123',
        paddleCustomerId: 'ctm_test_123',
        paddleSubscriptionStatus: 'active',
        save: jest.fn().mockResolvedValue(true),
      };

      customerModelMock.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCustomer),
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockCustomer),
        }),
      });

      paddleServiceMock.paddle.subscriptions.cancel.mockResolvedValue({});
      billingServiceMock.revertSubscriptionToFree.mockResolvedValue({});
      activitiesServiceMock.create.mockResolvedValue({});

      const result = await controller.cancelSubscription(
        mockTargetUserId,
        {
          immediately: true,
          reason: 'User requested account closure via live chat',
        },
        {
          userId: mockAdminId,
          email: 'admin@blynta.com',
          role: UserRole.ADMIN,
        },
      );

      // Paddle SDK check
      expect(paddleServiceMock.paddle.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_test_123',
        { effectiveFrom: 'immediately' },
      );

      // Billing service check
      expect(billingServiceMock.revertSubscriptionToFree).toHaveBeenCalledWith(
        expect.objectContaining({
          paddleSubscriptionId: 'sub_test_123',
          paddleCustomerId: 'ctm_test_123',
          status: 'canceled',
        }),
      );

      // Audit log check
      expect(activitiesServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: ActivityActorType.ADMIN,
          actorId: expect.any(Types.ObjectId),
          description: expect.stringContaining(
            'User requested account closure via live chat',
          ),
        }),
      );

      expect(result.message).toContain('Subscription canceled immediately');
    });
  });
});

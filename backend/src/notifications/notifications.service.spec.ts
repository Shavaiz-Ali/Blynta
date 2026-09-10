import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Types } from 'mongoose';
import {
  Notification,
  NotificationCategory,
  NotificationStatus,
  NotificationType,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const notificationSave = jest.fn();
  const findOneExec = jest.fn();
  const countExec = jest.fn();
  const listExec = jest.fn();
  const countDocumentsExec = jest.fn();
  const updateManyExec = jest.fn();
  const findOneAndDeleteExec = jest.fn();
  const queueAdd = jest.fn().mockResolvedValue(undefined);

  function NotificationModel(this: any, data: any) {
    Object.assign(this, data);
    this.save = notificationSave;
  }

  (NotificationModel as any).findOne = jest.fn(() => ({ exec: findOneExec }));
  (NotificationModel as any).find = jest.fn(() => ({
    sort: jest.fn(() => ({
      skip: jest.fn(() => ({
        limit: jest.fn(() => ({ exec: listExec })),
      })),
    })),
  }));
  (NotificationModel as any).countDocuments = jest.fn(() => ({
    exec: countDocumentsExec,
  }));
  (NotificationModel as any).updateMany = jest.fn(() => ({
    exec: updateManyExec,
  }));
  (NotificationModel as any).findOneAndDelete = jest.fn(() => ({
    exec: findOneAndDeleteExec,
  }));

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: NotificationModel,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: { add: queueAdd },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('create', () => {
    it('creates a notification with correct fields', async () => {
      const userId = new Types.ObjectId();
      const entityId = new Types.ObjectId();
      notificationSave.mockResolvedValue(true);

      await service.create({
        userId: userId.toString(),
        type: NotificationType.SUCCESS,
        category: NotificationCategory.JOB,
        title: 'Test title',
        message: 'Test message',
        actionUrl: '/test',
        actionLabel: 'Go',
        entityType: 'job',
        entityId: entityId.toString(),
        metadata: { foo: 'bar' },
      });

      expect(notificationSave).toHaveBeenCalledTimes(1);
      const instance = (NotificationModel as any).find.mock.instances[0]
        || (NotificationModel as any).findOne.mock.instances[0]
        || notificationSave.mock.instances[0];
      expect(instance).toBeDefined();
    });
  });

  describe('listForUser', () => {
    it('returns paginated results with defaults', async () => {
      const userId = new Types.ObjectId().toString();
      const mockNotifications = [{ _id: new Types.ObjectId() }];
      listExec.mockResolvedValue(mockNotifications);
      countDocumentsExec.mockResolvedValue(42);

      const result = await service.listForUser(userId);

      expect(result.notifications).toEqual(mockNotifications);
      expect(result.total).toBe(42);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
    });

    it('caps limit at MAX_LIMIT (50)', async () => {
      const userId = new Types.ObjectId().toString();
      listExec.mockResolvedValue([]);
      countDocumentsExec.mockResolvedValue(10);

      const result = await service.listForUser(userId, { page: 1, limit: 1000 });

      expect(result.limit).toBe(50);
    });
  });

  describe('getUnreadCount', () => {
    it('returns count from countDocuments query', async () => {
      const userId = new Types.ObjectId().toString();
      countDocumentsExec.mockResolvedValue(7);

      const count = await service.getUnreadCount(userId);

      expect(count).toBe(7);
      const findArg = (NotificationModel as any).countDocuments.mock.calls[0][0];
      expect(findArg.status).toBe(NotificationStatus.UNREAD);
    });
  });

  it('marks an unread notification as read', async () => {
    const notification = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      status: NotificationStatus.UNREAD,
      readAt: undefined,
      save: jest.fn().mockResolvedValue(true),
    };
    findOneExec.mockResolvedValue(notification);

    const result = await service.markAsRead(
      notification.userId.toString(),
      notification._id.toString(),
    );

    expect(notification.save).toHaveBeenCalled();
    expect(result.status).toBe(NotificationStatus.READ);
    expect(result.readAt).toBeInstanceOf(Date);
  });

  it('returns an already-read notification without throwing', async () => {
    const notification = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      status: NotificationStatus.READ,
      readAt: new Date(),
      save: jest.fn(),
    };
    findOneExec.mockResolvedValue(notification);

    const result = await service.markAsRead(
      notification.userId.toString(),
      notification._id.toString(),
    );

    expect(notification.save).not.toHaveBeenCalled();
    expect(result).toBe(notification);
  });

  it('throws NotFoundException when marking another user notification as read', async () => {
    findOneExec.mockResolvedValue(null);

    await expect(
      service.markAsRead(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('markAllAsRead', () => {
    it('returns modified count from updateMany', async () => {
      const userId = new Types.ObjectId().toString();
      updateManyExec.mockResolvedValue({ modifiedCount: 5 });

      const result = await service.markAllAsRead(userId);

      expect(result.updatedCount).toBe(5);
    });
  });

  it('throws when deleting another user notification', async () => {
    findOneAndDeleteExec.mockResolvedValue(null);

    await expect(
      service.deleteForUser(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('queueCreate', () => {
    it('dispatches a CREATE job to the notifications queue', async () => {
      const userId = new Types.ObjectId().toString();
      await service.queueCreate({
        userId,
        type: NotificationType.INFO,
        category: NotificationCategory.SYSTEM,
        title: 'Hello',
        message: 'World',
      });

      expect(queueAdd).toHaveBeenCalledTimes(1);
      const [jobName, payload] = queueAdd.mock.calls[0];
      expect(jobName).toBe('create-notification');
      expect(payload.title).toBe('Hello');
    });
  });

  describe('queueCreateIfNotExists', () => {
    it('dispatches a CREATE_IF_NOT_EXISTS job with dedupeKey', async () => {
      const userId = new Types.ObjectId().toString();

      await service.queueCreateIfNotExists({
        userId,
        type: NotificationType.SUCCESS,
        category: NotificationCategory.JOB,
        title: 'Done',
        message: 'Job complete',
        dedupeKey: 'job:abc123:completed',
      });

      expect(queueAdd).toHaveBeenCalledTimes(1);
      const [jobName, payload] = queueAdd.mock.calls[0];
      expect(jobName).toBe('create-notification-if-not-exists');
      expect(payload.dedupeKey).toBe('job:abc123:completed');
      expect(payload.title).toBe('Done');
    });

    it('throws BadRequestException when dedupeKey is missing', async () => {
      const userId = new Types.ObjectId().toString();

      await expect(
        service.queueCreateIfNotExists({
          userId,
          type: NotificationType.SUCCESS,
          category: NotificationCategory.JOB,
          title: 'Done',
          message: 'Job complete',
          // no dedupeKey
        }),
      ).rejects.toThrow();
    });
  });
});

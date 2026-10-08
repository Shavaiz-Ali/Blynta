import { createConnection, Connection, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import {
  CreditEntrySchema,
  CreditOperationSchema,
  ProcessingUsageSchema,
} from './credit.schemas';
import { CreditsService } from './credits.service';

// Uses a new isolated database; never consumes MONGO_URI or an application database.
const uri = process.env.BILLING_TEST_MONGO_URI;
(uri ? describe : describe.skip)(
  'MongoDB replica-set credit integration',
  () => {
    let connection: Connection;
    let service: CreditsService;
    let userId: string;
    beforeAll(async () => {
      connection = await createConnection(uri!, {
        dbName: `blynta_billing_test_${randomUUID().replace(/-/g, '')}`,
      }).asPromise();
      const users = connection.model(User.name, UserSchema);
      const entries = connection.model('CreditEntry', CreditEntrySchema);
      const operations = connection.model(
        'CreditOperation',
        CreditOperationSchema,
      );
      const usage = connection.model('ProcessingUsage', ProcessingUsageSchema);
      const customers = connection.model(Customer.name, CustomerSchema);
      await Promise.all([
        users.init(),
        entries.init(),
        operations.init(),
        usage.init(),
        customers.init(),
      ]);
      service = new CreditsService(
        connection,
        users as any,
        entries,
        operations,
        usage,
        new ConfigService(),
        customers as any,
      );
      const user = await users.create({
        email: 'integration@example.invalid',
        creditsBalance: 20,
      });
      userId = String(user._id);
      await service.migrate(userId);
    }, 30000);
    afterAll(async () => {
      if (connection) {
        await connection.dropDatabase();
        await connection.close();
      }
    });
    test('concurrent AI Clips and Studio reservations serialize; duplicate settle charges once', async () => {
      const reserve = (id: string, product: 'ai-clips' | 'studio') =>
        service.reserve({
          userId,
          operationId: id,
          product,
          relatedId: new Types.ObjectId().toString(),
          sourceSeconds: 3600,
          maxOutputSeconds: 360,
          amount: 18,
          fingerprint: 'same',
        });
      const results = await Promise.allSettled([
        reserve('a', 'ai-clips'),
        reserve('b', 'studio'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const op = await service.operations.findOne({
        userId,
        status: 'reserved',
      });
      await Promise.all([
        service.settle(op!.operationId, 16),
        service.settle(op!.operationId, 16),
      ]);
      expect(await service.balance(userId)).toMatchObject({
        available: 4,
        reserved: 0,
      });
      expect(
        await service.entries.countDocuments({ userId, type: 'charge' }),
      ).toBe(1);
      expect((await service.audit(userId)).consistent).toBe(true);
    });
    test('duplicate billing cycles and upgrades preserve the non-subscription balance', async () => {
      await Promise.all([
        service.grantSubscriptionCycle(
          userId,
          50,
          'cycle-1',
          'payment-1',
          'pro',
        ),
        service.grantSubscriptionCycle(
          userId,
          50,
          'cycle-1',
          'payment-1',
          'pro',
        ),
      ]);
      await service.grantSubscriptionCycle(
        userId,
        200,
        'cycle-1',
        'payment-upgrade',
        'business',
      );
      await service.grantSubscriptionCycle(
        userId,
        50,
        'cycle-1',
        'payment-downgrade',
        'pro',
      );
      expect((await service.balance(userId)).available).toBe(204);
      expect((await service.audit(userId)).consistent).toBe(true);
    });
    test('ledger updates and deletes are rejected', async () => {
      await expect(
        service.entries.updateOne({ userId }, { $set: { amount: 999 } }),
      ).rejects.toThrow('append-only');
      await expect(service.entries.deleteOne({ userId })).rejects.toThrow(
        'append-only',
      );
    });
  },
);

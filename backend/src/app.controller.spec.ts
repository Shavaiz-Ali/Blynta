import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getConnectionToken } from '@nestjs/mongoose';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getConnectionToken(), useValue: { readyState: 1 } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status', () => {
      const health = appController.getHealth();
      expect(health).toMatchObject({
        status: 'ok',
        database: 'connected',
      });
      expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});

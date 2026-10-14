import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { readBuildInfo } from './common/build-info';

@Injectable()
export class AppService {
  // Capture the manifest at startup so a file replaced without a process restart
  // does not change the revision reported by this running instance.
  private readonly build = readBuildInfo();
  constructor(@InjectConnection() private mongoConnection: Connection) {}

  getHealth() {
    const dbState = this.mongoConnection.readyState;
    // Mongoose readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbStatus = Number(dbState) === 1 ? 'connected' : 'disconnected';

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(), // seconds since the process started
      database: dbStatus,
      build: this.build,
    };
  }
}

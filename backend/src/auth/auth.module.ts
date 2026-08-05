import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthProviderConfigService } from './auth-provider-config.service';
import { AuthProviderConfig, AuthProviderConfigSchema } from './schemas/auth-provider-config.schema';
import { UsersModule } from '../users/users.module';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    UsersModule,
    MailModule,
    MongooseModule.forFeature([
      { name: AuthProviderConfig.name, schema: AuthProviderConfigSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, AuthProviderConfigService],
  exports: [PassportModule],
})
export class AuthModule { }
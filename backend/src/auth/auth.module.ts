import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthProviderConfigService } from './auth-provider-config.service';
import { AuthProviderConfig, AuthProviderConfigSchema } from './schemas/auth-provider-config.schema';
import { UsersModule } from '../users/users.module';
import { MailModule } from 'src/mail/mail.module';

const DEFAULT_JWT_EXPIRES_IN = '7d';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    UsersModule,
    MailModule,
    MongooseModule.forFeature([
      { name: AuthProviderConfig.name, schema: AuthProviderConfigSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined in environment variables');
        }
        const expiresIn =
          configService.get<string>('JWT_EXPIRES_IN') ?? DEFAULT_JWT_EXPIRES_IN;
        return {
          secret,
          signOptions: { expiresIn: expiresIn as any },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, AuthProviderConfigService],
  exports: [PassportModule, JwtModule],
})
export class AuthModule { }
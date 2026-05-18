import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@app/auth/auth.module.js';
import { UsersModule } from '@app/users/users.module.js';
import { UserEntity } from '@app/users/user.entity.js';
import { RefreshTokenEntity } from '@app/auth/refresh-token.entity.js';
import { JwtAuthGuard } from '@app/auth/jwt-auth.guard.js';
import { AuthController } from './auth.controller.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.getOrThrow<string>('DB_NAME'),
        entities: [UserEntity, RefreshTokenEntity],
        synchronize: false,
        migrationsRun: true,
        migrations: [],
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    AuthModule,
    UsersModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

import { Module, UploadedFiles } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketGateway } from './socket.gateway';
import { BlockedEntity } from './users/entities/blocked.entity';
import { UserEntity } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { ChannelModule } from './channel/channel.module';
import { ChannelEntity } from './channel/entities/channel.entity';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthorizationStrategy } from './authorization/authorization.strategy';
import { ConfigModule } from '@nestjs/config';
import { config } from 'process';
import { MulterModule } from '@nestjs/platform-express';
import { GameModule } from './game/game.module';
import { GameEntity } from './game/entities/game.entity';
import { BannedEntity } from './channel/entities/banned.entity';

@Module({
  imports: [ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [UserEntity, BlockedEntity, ChannelEntity, GameEntity, BannedEntity],
      // synchronize: true => dev only
      synchronize: true,
    }),
    UsersModule,
    ChannelModule,
    AuthorizationModule,
    MulterModule.register({
      dest: './uploads',
    }),
    GameModule
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway, AuthorizationStrategy],
})
export class AppModule {
  constructor(private dataSource: DataSource) {
  }
}

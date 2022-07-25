import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketGateway } from './socket.gateway';
import { BlockedEntity } from './users/entities/blocked.entity';
import { FriendEntity } from './users/entities/friend.entity';
import { UserEntity } from './users/entities/user.entity';
import { UsersModule } from './users/users.module';
import { ChannelModule } from './channel/channel.module';
import { ChannelEntity } from './channel/entities/channel.entity';
import { AuthorizationModule } from './authorization/authorization.module';
import { AuthorizationStrategy } from './authorization/authorization.strategy';
import { ConfigModule } from '@nestjs/config';
import { config } from 'process';

@Module({
  imports: [ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'myrootpassword',
      database: 'user_db',
      entities: [UserEntity, FriendEntity, BlockedEntity, ChannelEntity],
      // synchronize: true => dev only
      synchronize: true,
    }),
    UsersModule,
    ChannelModule,
    AuthorizationModule,
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway, AuthorizationStrategy],
})
export class AppModule {
  constructor(private dataSource: DataSource) {
  }
}

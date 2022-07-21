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

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'root',
      password: 'myrootpassword',
      database: 'user_db',
      entities: [UserEntity, FriendEntity, BlockedEntity],
      // synchronize: true => dev only
      synchronize: true,
    }),
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService, SocketGateway],
})
export class AppModule {
  constructor(private dataSource: DataSource) {}
}

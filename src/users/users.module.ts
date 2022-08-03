import { Module } from '@nestjs/common';
import { UserEntity } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendEntity } from './entities/friend.entity';
import { BlockedEntity } from './entities/blocked.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, FriendEntity, BlockedEntity])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}

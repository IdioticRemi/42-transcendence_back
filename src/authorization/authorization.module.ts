import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedEntity } from 'src/users/entities/blocked.entity';
import { FriendEntity } from 'src/users/entities/friend.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationService } from './authorization.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, FriendEntity, BlockedEntity])],
  controllers: [AuthorizationController],
  providers: [AuthorizationService]
})
export class AuthorizationModule {}

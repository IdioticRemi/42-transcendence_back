import { Module } from '@nestjs/common';
import { UserEntity } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedEntity } from './entities/blocked.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, BlockedEntity])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}

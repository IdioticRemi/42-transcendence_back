import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedEntity } from 'src/users/entities/blocked.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { UsersModule } from 'src/users/users.module';
import { AuthorizationController } from './auth.controller';
import { AuthorizationService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, BlockedEntity]), UsersModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationService]
})
export class AuthorizationModule {}

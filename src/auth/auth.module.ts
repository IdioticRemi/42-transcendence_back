import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {UserEntity} from 'src/users/entities/user.entity';
import {UsersModule} from 'src/users/users.module';
import {AuthorizationController} from './auth.controller';
import {AuthorizationService} from './auth.service';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity]), UsersModule],
    controllers: [AuthorizationController],
    providers: [AuthorizationService]
})
export class AuthorizationModule {
}

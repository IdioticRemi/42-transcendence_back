import {Module} from '@nestjs/common';
import {UserEntity} from './entities/user.entity';
import {UsersController} from './users.controller';
import {UsersService} from './users.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelEntity} from "../channel/entities/channel.entity";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity, ChannelEntity])],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService]
})
export class UsersModule {
}

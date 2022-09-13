import {Module} from '@nestjs/common';
import {UserEntity} from './entities/user.entity';
import {UsersController} from './users.controller';
import {UsersService} from './users.service';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelEntity} from "../channel/entities/channel.entity";
import { GameModule } from 'src/game/game.module';
import { GameEntity } from 'src/game/entities/game.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity, ChannelEntity, GameEntity])],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService]
})
export class UsersModule {
}

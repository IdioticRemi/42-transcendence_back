import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelModule} from 'src/channel/channel.module';
import {ChannelEntity} from 'src/channel/entities/channel.entity';
import {MessageEntity} from 'src/channel/entities/message.entity';
import {UserEntity} from 'src/users/entities/user.entity';
import {UsersModule} from 'src/users/users.module';
import {SocketService} from './socket.service';
import {SocketGateway} from './socket.gateway';
import { GameEntity } from 'src/game/entities/game.entity';
import { GameModule } from 'src/game/game.module';
import { GameService } from 'src/game/game.service';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity, ChannelEntity, MessageEntity, GameEntity]), UsersModule, ChannelModule, GameModule],
    exports: [SocketService],
    providers: [SocketService, SocketGateway, GameService]
})
export class SocketModule {
}

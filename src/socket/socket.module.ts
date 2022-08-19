import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelModule} from 'src/channel/channel.module';
import {ChannelEntity} from 'src/channel/entities/channel.entity';
import {MessageEntity} from 'src/channel/entities/message.entity';
import {UserEntity} from 'src/users/entities/user.entity';
import {UsersModule} from 'src/users/users.module';
import {SocketService} from './socket.service';
import {SocketGateway} from './socket.gateway';

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity, ChannelEntity, MessageEntity]), UsersModule, ChannelModule],
    exports: [SocketService],
    providers: [SocketService, SocketGateway]
})
export class SocketModule {
}

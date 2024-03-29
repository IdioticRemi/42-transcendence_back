import {forwardRef, Module} from '@nestjs/common';
import {ChannelService} from './channel.service';
import {ChannelController} from './channel.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelEntity} from './entities/channel.entity';
import {MessageEntity} from './entities/message.entity';
import {UsersModule} from 'src/users/users.module';
import { SanctionEntity } from './entities/sanction.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ChannelEntity, MessageEntity, SanctionEntity]), UsersModule],
    providers: [ChannelService],
    controllers: [ChannelController],
    exports: [ChannelService]
})
export class ChannelModule {
}

import { Module } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ChannelController } from './channel.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelEntity } from './entities/channel.entity';
import { MessageEntity } from './entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelEntity, MessageEntity])],
  providers: [ChannelService],
  controllers: [ChannelController]
})
export class ChannelModule {}

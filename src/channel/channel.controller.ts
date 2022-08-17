import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Post } from '@nestjs/common';
import { MResponse } from 'src/MResponse';
import { ChannelService } from './channel.service';
import { ChannelDto } from './dto/channel.dto';
import { AddMessageEntityDto } from './dto/message.dto';
import { ChannelEntity } from './entities/channel.entity';
import { MessageEntity } from './entities/message.entity';

@Controller('channels')
export class ChannelController {
	constructor(
		private channelService: ChannelService
	) {}
	
	@Get()
	async getAllChannels() {
		return this.channelService.getAllChannels();
	}

	@Post()
	async createChannel(
		@Body('userId', ParseIntPipe) userId: number,
		@Body('channelName') channelName: string,
		@Body('password') password: string = "",
		@Body('isPrivate', ParseBoolPipe) isPrivate: boolean, 
	): Promise<MResponse<ChannelDto>> {
		return await this.channelService.createChannel(userId, channelName, password, isPrivate);
	}

	@Delete()
	async deleteChannel(
		@Body('channelId', ParseIntPipe) channelId: number
	): Promise<MResponse<ChannelDto>> {
		return await this.channelService.deleteChannel(channelId);
	}

	@Get(':id/messages')
	async getMessages(
		@Param('id', ParseIntPipe) channelId: number
	): Promise<MResponse<MessageEntity[]>> {
		return await this.channelService.getMessages(channelId);
	}

	@Post(':id/messages')
	async addMessage(
		@Param('id', ParseIntPipe) channelId: number,
		@Body('message') message: AddMessageEntityDto,
	): Promise<MResponse<MessageEntity>> {
		return await this.channelService.addMessage(channelId, message);
	}


}

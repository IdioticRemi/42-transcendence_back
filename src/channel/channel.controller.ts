import { Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { UserTokenGuard } from 'src/auth/auth.guard';
import { MResponse } from 'lib/MResponse';
import { ChannelService } from './channel.service';
import { ChannelDto } from './dto/channel.dto';
import { AddMessageEntityDto } from './dto/message.dto';
import { MessageEntity } from './entities/message.entity';
import { Request } from 'express';
import { SendUserDto } from 'src/users/dto/user.dto';

@UseGuards(UserTokenGuard)
@Controller('channels')
export class ChannelController {
	constructor(
		private channelService: ChannelService
	) {}
	
	@Get()
	async getAllChannels(): Promise<MResponse<ChannelDto[]>> {
		return await this.channelService.getAllChannels();
	}

	@Post()
	async createChannel(
		@Req() req: Request,
		@Body('channelName') channelName: string,
		@Body('password') password: string = "",
		@Body('isPrivate', ParseBoolPipe) isPrivate: boolean = false, 
	): Promise<MResponse<ChannelDto>> {
		console.debug(req.user);
		return await this.channelService.createChannel(req.user.id, channelName, password, isPrivate);
	}

	@Delete()
	async deleteChannel(
		@Req() req: Request,
		@Body('channelId', ParseIntPipe) channelId: number
	): Promise<MResponse<ChannelDto>> {
		return await this.channelService.deleteChannel(req, channelId);
	}

	@Get('users')
	async getUsers(
		@Body('channelId', ParseIntPipe) channelId: number
	): Promise<MResponse<SendUserDto[]>> {
		return this.channelService.getUsers(channelId);
	}

	@Post('users')
	async addUser(
		@Req() req: Request,
		@Body('channelId', ParseIntPipe) channelId: number
	): Promise<MResponse<ChannelDto>> {
		return this.channelService.addUser(req, channelId);
	}

	@Delete('users')
	async deleteUser(
		@Req() req: Request,
		@Body('channelId', ParseIntPipe) channelId: number,
		@Body('userId', ParseIntPipe) targetId: number,
	): Promise<MResponse<SendUserDto>> {
		return this.channelService.deleteUser(req, channelId, targetId);
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

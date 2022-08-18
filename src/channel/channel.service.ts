import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { failureMResponse, MResponse, successMResponse } from 'lib/MResponse';
import { Repository } from 'typeorm';
import { ChannelDto } from './dto/channel.dto';
import { AddMessageEntityDto } from './dto/message.dto';
import { ChannelEntity } from './entities/channel.entity';
import { MessageEntity } from './entities/message.entity';
import { Request } from 'express';

@Injectable()
export class ChannelService {
	constructor(
		@InjectRepository(ChannelEntity)
		private channelRepository: Repository<ChannelEntity>,
		@InjectRepository(MessageEntity)
		private messageRepository: Repository<MessageEntity>,
	) {}

	async getAllChannels(): Promise<MResponse<ChannelDto[]>> {
		return await this.channelRepository.find()
						.then((channels) => {
							return successMResponse(channels.map( (c) => plainToClass(ChannelDto, c, {excludeExtraneousValues: true})));
						})
						.catch( () => {
							return failureMResponse("database failure");
						})
	}

	async createChannel(
		userId: number,
		channelName: string,
		password: string,
		isPrivate: boolean
		): Promise<MResponse<ChannelDto>> {

		// checks if channel already exists
		const channel = await this.channelRepository.findOne({
			where: {
				name: channelName
			}
		});
		if (channel)
			return failureMResponse('a channel with that name already exists');
		
		// create channel in DB
		const newChannel = this.channelRepository.create({
			ownerId: userId,
			name: channelName,
			password: password,
			isPrivate: isPrivate
		});
		if (!newChannel) {
			return failureMResponse('impossible to create this channel');
		}
		console.debug(newChannel);
		return this.channelRepository.save(newChannel)
				.then((newChannel) => {
					return successMResponse(plainToClass(ChannelDto, newChannel, {excludeExtraneousValues: true}));
				}).catch(() => {
					return failureMResponse('impossible to register this channel');
				});
	}

	async deleteChannel(req: Request, channelId: number): Promise<MResponse<ChannelDto>> {

		//check if channel exists
		const channel = await this.channelRepository.findOne({
			where: {
				id: channelId
			},
			relations: ['admins']
		});
		if (!channel) {
			return failureMResponse("this channel does not exist");
		}

		// check if user is owner or channel admin
		if (channel.ownerId != req.user.id && !channel.admins.find((admin) => req.user.id === admin.id))
			return failureMResponse("user is not operator on this channel")


		// delete in DB
		return this.channelRepository.delete({
			id: channel.id
		})
		.then( () => {
			return successMResponse(plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
		})
		.catch( () => {
			return failureMResponse('cannot delete this channel');
		});
	}

	async getMessages(channelId: number): Promise<MResponse<MessageEntity[]>> {
		
		// check if channel exists and pull messages relation
		const channel = await this.channelRepository.findOne({
			where: {
				id: channelId
			},
			relations: ['messages'],
		});
		if (!channel) {
			return failureMResponse('this channel does not exist');
		}

		return successMResponse(channel.messages);

	}

	async addMessage(channelId: number, message: AddMessageEntityDto): Promise<MResponse<MessageEntity>> {

		// check if channel exists and pull messages relation
		const channel = await this.channelRepository.findOne({
			where: {
				id: channelId
			},
			relations: ['messages']
		})
		if (!channel) {
			return failureMResponse('this channel does not exist');
		}

		const newMessage = this.messageRepository.create(message)
		console.debug(newMessage);
		channel.messages.push(newMessage);
		this.channelRepository.save(channel);

		// TODO: returned messages not up to date
		return successMResponse(newMessage);
	}
}

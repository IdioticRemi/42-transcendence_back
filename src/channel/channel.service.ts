import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { MResponse } from 'src/MResponse';
import { Repository } from 'typeorm';
import { ChannelDto } from './dto/channel.dto';
import { AddMessageEntityDto } from './dto/message.dto';
import { ChannelEntity } from './entities/channel.entity';
import { MessageEntity } from './entities/message.entity';

@Injectable()
export class ChannelService {
	constructor(
		@InjectRepository(ChannelEntity)
		private channelRepository: Repository<ChannelEntity>,
		@InjectRepository(MessageEntity)
		private messageRepository: Repository<MessageEntity>,
	) {}

	async getAllChannels() {
		return await this.channelRepository.find();
	}

	async createChannel(
		userId: number,
		channelName: string,
		password: string,
		isPrivate: boolean
		): Promise<MResponse<ChannelDto>> {


		// check if user exists => TODO: Guard

		// checks if channel already exists
		const channel = await this.channelRepository.findOne({
			where: {
				name: channelName
			}
		});
		if (channel)
			return {
				status: 'error',
				message: 'a channel with that name already exists'
			}
		
		// create channel in DB
		const newChannel = this.channelRepository.create({
			ownerId: userId,
			name: channelName,
			password: password,
			isPrivate: isPrivate
		});
		if (!newChannel) {
			return {
				status: 'error',
				message: 'impossible to create this channel'
			}
		}
		console.debug(newChannel);
		return this.channelRepository.save(newChannel)
				.then((newChannel) => {
					return {
						status: 'success',
						payload: plainToClass(ChannelDto, newChannel, {excludeExtraneousValues: true}),
					} as MResponse<ChannelDto>;
				}).catch(() => {
					return {
						status: 'error',
						message: 'impossible to register this channel',
					};
				});
	}

	async deleteChannel(channelId: number): Promise<MResponse<ChannelDto>> {

		//check if channel exists
		const channel = await this.channelRepository.findOne({
			where: {
				id: channelId
			}
		});
		if (!channel) {
			return {
				status: "error",
				message: "this channel does not exist"
			}
		}

		// delete in DB
		return this.channelRepository.delete({
			id: channel.id
		})
		.then( () => {
			return {
				status: 'success',
				payload: plainToClass(ChannelDto, channel, {excludeExtraneousValues: true})
			} as MResponse<ChannelDto>;
		})
		.catch( () => {
			return {
				status: 'error',
				message: 'cannot delete this channel'
			}
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
			return {
				status: 'error',
				message: 'this channel does not exist'
			}
		}

		return {
			status: 'success',
			payload: channel.messages
		}

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
			return {
				status: 'error',
				message: 'this channel does not exist'
			}
		}

		const newMessage = this.messageRepository.create(message)
		console.debug(newMessage);
		channel.messages.push(newMessage);
		this.channelRepository.save(channel);

		// TODO: returned messages not up to date
		return {
			status: 'success',
			payload: newMessage
		}
	}

}

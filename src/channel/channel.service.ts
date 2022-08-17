import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import { MResponse } from 'src/MResponse';
import { Repository } from 'typeorm';
import { ChannelDto } from './dto/channel.dto';
import { ChannelEntity } from './entities/channel.entity';

@Injectable()
export class ChannelService {
	constructor(
		@InjectRepository(ChannelEntity)
		private channelRepository: Repository<ChannelEntity>,
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


		// check if user exists ?

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
			owner: userId,
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

}

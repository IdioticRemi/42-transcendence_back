import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ChannelService } from './channel.service';
import { ChannelEntity } from './entities/channel.entity';

@Controller('channels')
export class ChannelController {
	constructor(
		private channelService: ChannelService
	) {}
	
	@Get()
	async getAllChannels() {
		return this.channelService.getAllChannels();
	}


}

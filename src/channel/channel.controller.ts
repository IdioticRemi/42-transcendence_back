import {Controller, Get, Param, ParseIntPipe, UseGuards} from '@nestjs/common';
import {UserTokenGuard} from 'src/auth/auth.guard';
import {MResponse} from 'lib/MResponse';
import {ChannelService} from './channel.service';
import {ChannelDto} from './dto/channel.dto';

@UseGuards(UserTokenGuard)
@Controller('channels')
export class ChannelController {
    constructor(
        private channelService: ChannelService
    ) {
    }

    @Get()
    async getAllChannels(): Promise<MResponse<ChannelDto[]>> {
        return await this.channelService.getAllChannels();
    }

    @Get(':id')
    async getChannelById(
        @Param('id', ParseIntPipe) channelId: number
    ) {
        return this.channelService.getChannelById(channelId);
    }
}

import {Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Req, UseGuards} from '@nestjs/common';
import {UserTokenGuard} from 'src/auth/auth.guard';
import {failureMResponse, MResponse, successMResponse} from 'lib/MResponse';
import {ChannelService} from './channel.service';
import {ChannelDto} from './dto/channel.dto';
import {AddMessageEntityDto} from './dto/message.dto';
import {MessageEntity} from './entities/message.entity';
import {Request} from 'express';
import {SendUserDto} from 'src/users/dto/user.dto';

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

    @Post()
    async createChannel(
        @Req() req: Request,
        @Body('channelName') channelName: string,
        @Body('password') password = "",
        @Body('isPrivate', ParseBoolPipe) isPrivate= false,
    ): Promise<MResponse<ChannelDto>> {
        const r = await this.channelService.createChannel(req.user.id, channelName, password, isPrivate);

        if (!r)
            return failureMResponse("could not create channel");
        return successMResponse(r);
    }

    @Delete()
    async deleteChannel(
        @Req() req: Request,
        @Body('channelId', ParseIntPipe) channelId: number
    ): Promise<MResponse<ChannelDto>> {
        return await this.channelService.deleteChannel(req.user.id, channelId);
    }

    @Get('users')
    async getUsers(
        @Body('channelId', ParseIntPipe) channelId: number
    ): Promise<MResponse<SendUserDto[]>> {
        return this.channelService.getUsers(channelId);
    }

    @Post('users')
    async addUserToChannel(
        @Req() req: Request,
        @Body('channelId', ParseIntPipe) channelId: number
    ): Promise<MResponse<ChannelDto>> {
        return this.channelService.addUserToChannel(req.user.id, channelId);
    }

    @Delete('users')
    async deleteUserFromChannel(
        @Req() req: Request,
        @Body('channelId', ParseIntPipe) channelId: number,
        @Body('userId', ParseIntPipe) targetId: number,
    ): Promise<MResponse<SendUserDto>> {
        return this.channelService.deleteUserFromChannel(req.user, channelId, targetId);
    }

    @Get('admins')
    async getAdmins() {
        //TODO
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
        const msg = await this.channelService.addMessage(channelId, message);

        if (!msg)
            return failureMResponse("Error while sending message");
        return successMResponse(msg);
    }


}

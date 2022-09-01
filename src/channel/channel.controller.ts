import {Body, Controller, Delete, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Req, UseGuards} from '@nestjs/common';
import {UserTokenGuard} from 'src/auth/auth.guard';
import {failureMResponse, MResponse, successMResponse} from 'lib/MResponse';
import {ChannelService} from './channel.service';
import {ChannelDto} from './dto/channel.dto';
import {AddMessageEntityDto} from './dto/message.dto';
import {MessageEntity} from './entities/message.entity';
import {Request} from 'express';
import {SendUserDto} from 'src/users/dto/user.dto';
import { BannedEntity } from './entities/banned.entity';

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

    @Delete(':id')
    async deleteChannel(
        @Req() req: Request,
        @Param('id', ParseIntPipe) channelId: number
    ): Promise<MResponse<ChannelDto>> {
        return await this.channelService.deleteChannel(req.user.id, channelId);
    }

    @Get(':id/users')
    async getUsers(
        @Param('id', ParseIntPipe) channelId: number
    ): Promise<MResponse<SendUserDto[]>> {
        return this.channelService.getUsers(channelId);
    }

    @Post(':id/users')
    async addUserToChannel(
        @Req() req: Request,
        @Param('id', ParseIntPipe) channelId: number
    ): Promise<MResponse<ChannelDto>> {
        return this.channelService.addUserToChannel(req.user.id, channelId);
    }

    @Delete(':id/users')
    async deleteUserFromChannel(
        @Req() req: Request,
        @Param('id', ParseIntPipe) channelId: number,
        @Body('userId', ParseIntPipe) targetId: number,
    ): Promise<MResponse<boolean>> {
        return this.channelService.deleteUserFromChannel(req.user, channelId, targetId);
    }

    @Get(':id/admins')
    async getAdmins(
        @Param('id', ParseIntPipe) channelId: number
    ): Promise<SendUserDto[]> {
        return await this.channelService.getChannelAdmins(channelId);
    }

    @Post(':id/admins')
    async addChannelAdmin(
        @Req() req: Request,
        @Param('id', ParseIntPipe) channelId: number,
        @Body('targetId', ParseIntPipe) targetId: number
    ): Promise<boolean> {
        return await this.channelService.addChannelAdmin(channelId, targetId);
    }

    @Delete(':id/admins')
    async removeChannelAdmin(
        @Req() req: Request,
        @Param('id', ParseIntPipe) channelId: number,
        @Body('targetId', ParseIntPipe) targetId: number
    ): Promise<boolean> {
        return this.channelService.removeChannelAdmin(channelId, targetId);
    }

    //
    @Get(':id/banned')
    async getBanned(
        @Param('id', ParseIntPipe) channelId: number
    ): Promise<BannedEntity[]> {
        return await this.channelService.getChannelBanned(channelId);
    }

    @Post(':id/banned')
    async addChannelBanned(
        @Param('id', ParseIntPipe) channelId: number,
        @Body('targetId', ParseIntPipe) targetId: number,
        @Body('duration', ParseIntPipe) time: number
    ): Promise<boolean> {
        return await this.channelService.addChannelBan(channelId, targetId, time);
    }

    @Delete(':id/banned')
    async removeChannelBanned(
        @Param('id', ParseIntPipe) channelId: number,
        @Body('targetId', ParseIntPipe) targetId: number
    ): Promise<boolean> {
        return this.channelService.removeChannelBan(channelId, targetId);
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

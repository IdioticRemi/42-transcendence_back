import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToClass } from 'class-transformer';
import { failureMResponse, MResponse, successMResponse } from 'lib/MResponse';
import { Server, Socket } from 'socket.io';
import { Client } from 'socket.io/dist/client';
import { UserTokenGuard } from 'src/auth/auth.guard';
import { ChannelService } from 'src/channel/channel.service';
import { AddMessageEntityDto } from 'src/channel/dto/message.dto';
import { SendUserDto } from 'src/users/dto/user.dto';
import { UsersService } from 'src/users/users.service';
import { SocketService } from './socket.service';

@WebSocketGateway({ cors: true })
export class SocketGateway {
  constructor(
    private channelService: ChannelService,
    private userService: UsersService,
    private socketService: SocketService,
  ) {}

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('channel_join')
  async joinChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.socketService.getUserFromSocket(client);

    if (!user || !data.channelId)
      return;

    // TODO: Add user to channel

    const channel = await this.channelService.getChannelById(data.channelId, ['admins', 'users']);

    if (!channel)
      return;

    client.join(`channel_${channel.id}`);
    client.emit('channel_join', { channelId: channel.id });
    this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
  }

  @SubscribeMessage('channel_leave')
  async leaveChannel(
    @MessageBody() data: { channelId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.socketService.getUserFromSocket(client);

    if (!user || !data.channelId)
      return;

    // TODO: Remove user from channel

    const channel = await this.channelService.getChannelById(data.channelId, ['admins', 'users']);

    if (!channel)
      return;

    client.leave(`channel_${channel.id}`);
    client.emit('channel_leave', { channelId: channel.id });
    this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
  }

  @SubscribeMessage('channel_message')
  async handleNewMessage(
    @MessageBody() data: { channelId: number, content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = await this.socketService.getUserFromSocket(client);

    if (!user || !data.channelId)
      return;
  
    const channel = await this.channelService.getChannelById(data.channelId, ['users']);

    if (!channel)
      return;

    const res = await this.channelService.addMessage(channel.id, plainToClass(AddMessageEntityDto, {
      channelId: channel.id,
      content: data.content,
      userId: user.id,
    }));

    if (res.status === 'error')
      return;
    
    this.server.to(`channel_${channel.id}`).emit('channel_message', { channelId: channel.id, user, content: res.payload.content });
  }
}

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {plainToClass} from 'class-transformer';
import {Server, Socket} from 'socket.io';
import {ChannelService} from 'src/channel/channel.service';
import {AddMessageEntityDto} from 'src/channel/dto/message.dto';
import {UsersService} from 'src/users/users.service';
import {SocketService} from './socket.service';

@WebSocketGateway({cors: true})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        private channelService: ChannelService,
        private userService: UsersService,
        private socketService: SocketService,
    ) {
    }

    async handleConnection(client: Socket) {
        console.debug("SOCKET: verifying user connection")
        // console.debug("SOCKET: ", client.handshake.headers);
        if (!client.handshake.headers.authorization) {
            client.disconnect();
            return;
        }

        const user = await this.userService.getUserByToken(
            client.handshake.headers.authorization,
        );

        const connectedUser = this.socketService.getConnectedUserById(user.id);

        console.debug("SOCKET: user already online? ", !!connectedUser);

        if (user && !connectedUser)
            this.socketService.connectUser(client.id, user);
        else
            client.disconnect();
        console.debug(this.socketService.getConnectedUser(client.id));
    }

    async handleDisconnect(client: Socket) {
        console.debug("SOCKET: User was disconnected (missing auth or already connected)")
        this.socketService.disconnectUser(client.id);
    }

    @SubscribeMessage('channel_join')
    async joinChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        await this.channelService.addUserToChannel(user, data.channelId);

        const channel = await this.channelService.getChannelById(data.channelId, [
            'admins',
            'users',
        ]);

        if (!channel) return;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
    }

    @SubscribeMessage('channel_leave')
    async leaveChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        // TODO: Remove user from channel

        const channel = await this.channelService.getChannelById(data.channelId, [
            'admins',
            'users',
        ]);

        if (!channel) return;

        client.leave(`channel_${channel.id}`);
        client.emit('channel_leave', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
    }

    @SubscribeMessage('channel_message')
    async handleNewMessage(
        @MessageBody() data: { channelId: number; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        const channel = await this.channelService.getChannelById(data.channelId, [
            'users',
        ]);

        if (!channel) return;

        const message = await this.channelService.addMessage(
            channel.id,
            plainToClass(AddMessageEntityDto, {
                channelId: channel.id,
                content: data.content,
                userId: user.id,
            }),
        );

        if (!message) return;

        this.server.to(`channel_${channel.id}`).emit('channel_message', {
            channelId: message.channel.id,
            user,
            content: message.content,
        });
    }
}

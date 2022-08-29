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
            client.handshake.headers.authorization, ['friends', 'blocked']
        );

        // const connectedUser = this.socketService.getConnectedUserById(user.id);

        // console.debug("SOCKET: user already online? ", !!connectedUser);

        if (!user /*&& !connectedUser*/) {
            client.disconnect();
            return;
        }
        this.socketService.connectUser(client.id, user);
        client.join(`prv_${user.id}`);

        user.friends.forEach(f => {
            const friend = this.socketService.getConnectedUserById(f.id);

            if (friend) {
                this.server.to(`prv_${friend.id}`).emit("friend_status", { id: user.id, status: 'online' });
            }
        });

        console.debug(this.socketService.getConnectedUser(client.id));
    }

    async handleDisconnect(client: Socket) {
        const user = this.socketService.getConnectedUser(client.id);

        if (user) {
            user.friends.forEach(f => {
                const friend = this.socketService.getConnectedUserById(f.id);

                if (friend) {
                    this.server.to(`prv_${friend.id}`).emit("friend_status", { id: user.id, status: 'offline' });
                }
            });
        }

        // console.debug("SOCKET: User was disconnected (missing auth or already connected)")
        this.socketService.disconnectUser(client.id);
    }

    @SubscribeMessage('channel_list')
    async getChannelList(
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user) return;

        const userChannels = await this.userService.getSubscribedChannels(user.id, ['messages', 'users', 'admins']);

        if (!userChannels) return;

        userChannels.forEach((c) => {
            client.join(`channel_${c.id}`);
            client.emit('channel_info', c);
        });
    }

    @SubscribeMessage('friend_list')
    async getFriendList(
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user) return;

        const userFriends = await this.userService.getFriends(user.id);
        const userPendingFriends = await this.userService.getPendingFriends(user.id);

        if (!userFriends || !userPendingFriends) return;

        userFriends.forEach((c) => {
            const isConnected = !!this.socketService.getConnectedUserById(c.id);
            const [small, big] = [user.id, c.id].sort((a, b) => a - b);

            client.join(`friend_${small}_${big}`);
            client.emit('friend_info', { id: c.id, nickname: c.nickname, status: isConnected ? 'online' : 'offline', messages: this.socketService.getMessages(user.id, c.id) });
        });

        userPendingFriends.forEach((p) => {
            const [small, big] = [user.id, p.id].sort((a, b) => a - b);

            client.join(`friend_${small}_${big}`);
            client.emit('friend_info', { id: p.id, nickname: p.nickname, status: 'pending', messages: [] });
        })
        // TODO: Send la liste des amis PENDING
    }

    @SubscribeMessage('channel_info')
    async getChannelInfo(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        const userChannels = await this.userService.getSubscribedChannels(user.id, [
            'admins',
            'users',
            'messages'
        ]);

        if (!userChannels) return;

        const channel = userChannels.find(c => c.id === data.channelId);

        if (!channel) return;

        client.emit('channel_info', channel);
    }

    @SubscribeMessage('channel_subscribe')
    async subscribeToChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        const channel = await this.channelService.getChannelById(data.channelId, [
            'users',
        ]);

        if (!channel || !channel.users.find(u => u.id)) return;

        console.log(data.channelId);

        client.join(`channel_${channel.id}`);
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
    }

    @SubscribeMessage('channel_unsubscribe')
    async unsubscribeFromChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        client.leave(`channel_${data.channelId}`);
    }

    @SubscribeMessage('channel_create')
    async createChannel(
        @MessageBody() data: { name: string, private: boolean, password?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('private' in data) || !data.name) return;

        const ret = await this.channelService.createChannel(user.id, data.name, data.password || "", data.private);
        // await this.channelService.addUserToChannel(user.id, data.channelId);

        console.log(ret);

        const id = ret.id;

        const channel = await this.channelService.getChannelById(id, [
            'admins',
            'users',
            'messages'
        ]);

        if (!channel) return;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
    }

    @SubscribeMessage('friend_add')
    async addFriend(
        @MessageBody() data: { userNick: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.userNick) return;

        const friend = await this.userService.getUserByNickname(data.userNick, ['friends']);

        if (!friend) return;

        await this.userService.addFriend(user.id, friend.id);

        if (friend.friends.find(f => f.id === user.id)) {
            const isConnected = !!this.socketService.getConnectedUserById(friend.id);
            const [small, big] = [user.id, friend.id].sort((a, b) => a - b);

            client.join(`friend_${small}_${big}`);
            client.emit('friend_info', { id: friend.id, nickname: friend.nickname, status: isConnected ? 'online' : 'offline', messages: this.socketService.getMessages(user.id, friend.id) });
        }
        else {
            client.emit('friend_info', { id: friend.id, nickname: friend.nickname, status: 'pending', messages: [] });
        }
    }

    @SubscribeMessage('channel_join')
    async joinChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        await this.channelService.addUserToChannel(user.id, data.channelId);

        const channel = await this.channelService.getChannelById(data.channelId, [
            'admins',
            'users',
            'messages'
        ]);

        if (!channel) return;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
    }

    @SubscribeMessage('channel_delete')
    async deleteChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        console.log("Attempt to delete a channel: ", data.channelId);

        if (!user || !data.channelId) return;

        const channel = await this.channelService.getChannelById(data.channelId, [
            'admins'
        ]);

        if (!channel || (channel.ownerId != user.id && !channel.admins.find(u => u.id === user.id))) return;

        await this.channelService.deleteChannel(user.id, channel.id);

        this.server.to(`channel_${channel.id}`).emit('channel_leave', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).socketsLeave(`channel_${channel.id}`);
    }

    @SubscribeMessage('channel_leave')
    async leaveChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelId) return;

        await this.channelService.deleteUserFromChannel(user, data.channelId, user.id);

        console.log("leave channel");
        const channel = await this.channelService.getChannelById(data.channelId, [
            'admins',
            'users',
            'messages'
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

        if (!user || !data.channelId || !data.content || /^\s*$/.test(data.content)) return;

        const channel = await this.channelService.getChannelById(data.channelId, [
            'users',
        ]);

        if (!channel) return;

        const message = await this.channelService.addMessage(
            channel.id,
            plainToClass(AddMessageEntityDto, {
                channelId: channel.id,
                content: data.content,
                userNick: user.nickname,
                userId: user.id,
            }),
        );

        if (!message) return;

        this.server.to(`channel_${channel.id}`).emit('channel_message', {
            channelId: channel.id,
            userId: user.id,
            userNick: user.nickname,
            content: message.content,
        });
    }

    @SubscribeMessage('friend_message')
    async handleFriendMessage(
        @MessageBody() data: { friendId: number; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.friendId || !data.content || /^\s*$/.test(data.content)) return;

        const friend = await this.userService.getUserById(data.friendId, [
            'friends',
        ]);

        if (!friend || !friend.friends.find(u => u.id === user.id)) return;

        this.socketService.sendMessage(client.id, friend.id, data.content);

        // if (!message) return;

        const [small, big] = [user.id, friend.id].sort((a, b) => a - b);
        this.server.to(`friend_${small}_${big}`).emit('friend_message', {
            friendId: friend.id,
            userId: user.id,
            userNick: user.nickname,
            content: data.content,
        });
    }
}

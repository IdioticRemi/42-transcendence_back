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
        if (!client.handshake.headers.authorization) {
            client.disconnect();
            return;
        }

        const user = await this.userService.getUserByToken(
            client.handshake.headers.authorization, ['friends', 'blocked']
        );

        if (!user) {
            client.disconnect();
            return;
        }
        this.socketService.connectUser(client.id, user);
        client.join(`prv_${user.id}`);

        user.friends.forEach(f => {
            const friend = this.socketService.getUserKVByUserId(f.id);

            if (friend) {
                this.server.to(friend[0]).emit("friend_status", { id: user.id, status: 'online' });
            }
        });

        user.blocked.forEach(b => {
            client.emit('user_block', { userId: b.id, userNick: b.nickname })
        });
    }

    async handleDisconnect(client: Socket) {
        const user = this.socketService.getConnectedUser(client.id);

        if (user) {
            user.friends.forEach(f => {
                const friend = this.socketService.getUserKVByUserId(f.id);

                if (friend) {
                    this.server.to(friend[0]).emit("friend_status", { id: user.id, status: 'offline' });
                }
            });
        }

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

        const msg = {
            friendId: friend.id,
            userId: user.id,
            userNick: user.nickname,
            content: data.content,
        };

        const friendSocket = this.socketService.getUserKVByUserId(friend.id);

        if (friendSocket)
            this.server.to(friendSocket[0]).emit('friend_message', msg);
        client.emit('friend_message', msg);
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

            client.emit('friend_info', { id: c.id, nickname: c.nickname, status: isConnected ? 'online' : 'offline', messages: this.socketService.getMessages(user.id, c.id) });
        });

        userPendingFriends.forEach((p) => {
            client.emit('friend_info', { id: p.id, nickname: p.nickname, status: 'pending', messages: [] });
        });
    }

    @SubscribeMessage('friend_add')
    async addFriend(
        @MessageBody() data: { userNick: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.userNick) return;

        const friend = await this.userService.getUserByNickname(data.userNick, ['friends']);

        if (!friend || friend.id === user.id) return;

        const r = await this.userService.addFriend(user.id, friend.id);

        if (r.status !== "success")
            return;

        if (friend.friends.find(f => f.id === user.id)) {
            const friendSocket = this.socketService.getUserKVByUserId(friend.id);
            const isFriendConnected = !!friendSocket;

            if (isFriendConnected)
                this.server.to(friendSocket[0]).emit('friend_info', { id: user.id, nickname: user.nickname, status: 'online', messages: [] });

            client.emit('friend_info', { id: friend.id, nickname: friend.nickname, status: isFriendConnected ? 'online' : 'offline', messages: [] });
        }
        else {
            client.emit('friend_info', { id: friend.id, nickname: friend.nickname, status: 'pending', messages: [] });
        }
    }

    @SubscribeMessage('friend_remove')
    async removeFriend(
        @MessageBody() data: { friendId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.friendId) return;

        const friend = await this.userService.getUserById(data.friendId, ['friends']);

        if (!friend) return;

        const r = await this.userService.deleteFriend(user.id, friend.id);

        if (r.status !== "success")
            return;

        const friendSocket = this.socketService.getUserKVByUserId(friend.id);
        const friendIsConnected = !!friendSocket;

        if (friendIsConnected)
            this.server.to(friendSocket[0]).emit('friend_remove', { friendId: user.id });

        client.emit('friend_remove', { friendId: friend.id });
        this.socketService.clearMessages(friend.id, user.id);
    }

    @SubscribeMessage('user_block')
    async blockFriend(
        @MessageBody() data: { userId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);
        const userData = await this.userService.getUserById(user.id, ['friends']);

        if (!user || !userData || !data.userId) return;

        const target = await this.userService.getUserById(data.userId, ['friends']);

        if (!target || target.id === user.id) return;

        const r = await this.userService.addBlocked(user.id, target.id);

        if (r.status !== "success")
            return;

        const friendSocket = this.socketService.getUserKVByUserId(target.id);
        const friendIsConnected = !!friendSocket;

        if (friendIsConnected && target.friends.find(f => f.id === user.id))
            this.server.to(friendSocket[0]).emit('friend_remove', { friendId: user.id });
        if (userData.friends.find(f => f.id === target.id))
            client.emit('friend_remove', { friendId: target.id });
        this.socketService.clearMessages(target.id, user.id);
        client.emit('user_block', { userId: target.id, userNick: target.nickname });
    }

    @SubscribeMessage('user_unblock')
    async unblockFriend(
        @MessageBody() data: { userId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);
        const userData = await this.userService.getUserById(user.id);

        if (!user || !userData || !data.userId) return;

        const target = await this.userService.getUserById(data.userId);

        if (!target || target.id === user.id) return;

        const r = await this.userService.deleteBlocked(user.id, target.id);

        if (r.status !== "success")
            return;

        client.emit('user_unblock', { userId: target.id });
    }

    @SubscribeMessage('user_nick')
    async changeNickname(
        @MessageBody() data: { newNick: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.newNick || /^\s*$/.test(data.newNick)) return;
        if (data.newNick.length > 16 || data.newNick.length < 4) return;

        const success = await this.userService.setNickname(user.id, data.newNick);

        if (!success)
            return;

        client.emit('user_nick', { newNick: data.newNick });
    }
}

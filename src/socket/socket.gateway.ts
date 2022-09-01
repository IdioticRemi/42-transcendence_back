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
import * as argon2 from "argon2";
import {SanctionType} from "../channel/entities/sanction.entity";

@WebSocketGateway({cors: true})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        private channelService: ChannelService,
        private userService: UsersService,
        private socketService: SocketService,
    ) {
        setInterval(async () => {
            await this.channelService.refreshSanctions();
        }, 10 * 1e3);
    }

    async handleConnection(client: Socket) {
        console.debug("SOCKET: verifying user connection")
        if (!client.handshake.headers.authorization) {
            client.disconnect();
            return;
        }

        const user = await this.userService.getUserByToken(
            client.handshake.headers.authorization, ['friends', 'blocked', 'channels']
        );

        if (!user) {
            client.disconnect();
            return;
        }

        this.socketService.connectUser(client.id, user);

        user.friends.forEach(f => {
            const friend = this.socketService.getUserKVByUserId(f.id);

            if (friend) {
                this.server.to(friend[0]).emit("friend_status", { id: user.id, status: 'online' });
            }
        });

        user.blocked.forEach(b => {
            client.emit('user_block', { userId: b.id, userNick: b.nickname })
        });

        user.channels.forEach(c => {
            client.join(`channel_${c.id}`);
        })
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

        if (!user) {
            client.emit('error', 'Invalid user');
            return;
        }

        const userChannels = await this.userService.getSubscribedChannels(user.id, ['messages']);

        if (!userChannels) {
            client.emit('error', 'database error');
            return;
        }

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

        if (!user || !('channelId' in data)) {
            client.emit('error', 'Invalid data');
            return;
        }

        const userChannels = await this.userService.getSubscribedChannels(user.id, [
            'messages'
        ]);

        if (!userChannels) {
            client.emit('error', 'database error');
            return;
        }

        const channel = userChannels.find(c => c.id === data.channelId);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }

        client.emit('channel_info', channel);
    }

    @SubscribeMessage('channel_create')
    async createChannel(
        @MessageBody() data: { name: string, private: boolean, password?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('private' in data) || !data.name) {
            client.emit('error', 'cannot create this channel');
            return;
        }

        if ('password' in data)
            data.private = true;

        const ret = await this.channelService.createChannel(user.id, data.name, data.password || "", data.private);
        // await this.channelService.addUserToChannel(user.id, data.channelId);

        if (!ret) {
            client.emit('error', 'Could not create channel');
            return;
        }

        const id = ret.id;

        const channel = await this.channelService.getChannelById(id, [
            'messages'
        ]);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }

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

        if (!user || !('channelId' in data)) {
            client.emit('error', 'Invalid data');
            return;
        }

        await this.channelService.addUserToChannel(user.id, data.channelId);

        const channel = await this.channelService.getChannelById(data.channelId, [
            'messages',
            'admins',
            'users'
        ]);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }

        const users = [];
        const owner = channel.users.find(u => u.id === channel.ownerId);

        users.push({ id: owner.id, nickname: owner.nickname, perm: 2 });

        channel.users.forEach((u) => {
            const userObj = { id: u.id, nickname: u.nickname, perm: 0 };

            if (channel.admins.find(a => a.id === u.id))
                userObj.perm = 1;

            if (u.id !== owner.id)
                users.push(userObj);
        });

        delete channel.users;
        delete channel.admins;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: data.channelId, users });
    }

    @SubscribeMessage('channel_joinprv')
    async joinPrivateChannel(
        @MessageBody() data: { channelName: string, password?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.channelName) return;

        const channel = await this.channelService.getChannelByName(data.channelName, [
            'messages',
            'admins',
            'users'
        ]);

        if (!channel) {
            client.emit('error', `No channel found with this name`);
            return;
        }

        if (channel.password !== "") {
            if (!('password' in data)) {
                client.emit('error', `Invalid password`);
                return;
            }
            try {
                if (!(await argon2.verify(channel.password, data.password))) {
                    client.emit('error', `Invalid password`);
                    return;
                }
            } catch {
                client.emit('error', `Failed to verify password`);
                return;
            }
        }

        const r = await this.channelService.addUserToChannel(user.id, channel.id);

        if (r.status === "error") {
            client.emit('error', r.message);
            return;
        }

        const users = [];
        const owner = channel.users.find(u => u.id === channel.ownerId);

        users.push({ id: owner.id, nickname: owner.nickname, perm: 2 });
        users.push({ id: user.id, nickname: user.nickname, perm: 0 });

        channel.users.forEach((u) => {
            const userObj = { id: u.id, nickname: u.nickname, perm: 0 };

            if (channel.admins.find(a => a.id === u.id))
                userObj.perm = 1;

            if (u.id !== owner.id)
                users.push(userObj);
        });

        delete channel.users;
        delete channel.admins;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage('channel_delete')
    async deleteChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data)) {
            client.emit('error', 'Invalid data');
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, [
            'admins'
        ]);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }

        if (channel.ownerId != user.id && !channel.admins.find(u => u.id === user.id)) {
            client.emit('error', 'You must be admin to perform this action');
            return;
        }

        const r = await this.channelService.deleteChannel(user.id, channel.id);

        if (r.status === "error") {
            client.emit('error', r.message);
            return;
        }

        this.server.to(`channel_${channel.id}`).emit('channel_leave', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).socketsLeave(`channel_${channel.id}`);
    }

    @SubscribeMessage('channel_leave')
    async leaveChannel(
        @MessageBody() data: { channelId: number, userId?: number },
        @ConnectedSocket() client: Socket | null,
    ) {
        let user = null;
        if (!client) {
            const tmp = this.socketService.getUserKVByUserId(data.userId);
            if (!tmp)
                return;
            client = this.server.sockets.sockets.get(tmp[0]);
            if (!client)
                return;
            user = tmp[1];
        } else {
            user = await this.socketService.getConnectedUser(client.id);
        }

        if (!user || !('channelId' in data)) {
            client.emit('error', 'Invalid data');
            return;
        }

        const r = await this.channelService.deleteUserFromChannel(user, data.channelId, user.id);

        if (r.status === "error") {
            client.emit(r.message);
            return;
        }
        if (r.status === "success" && r.payload === true) {
            client.leave(`channel_${data.channelId}`);
            client.emit('channel_leave', {channelId: data.channelId});
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, [
            'messages',
            'admins',
            'users'
        ]);

        if (!channel) {
            client.emit('error', 'failed to fetch channel information');
            return;
        }

        const users = [];
        const owner = channel.users.find(u => u.id === channel.ownerId);

        users.push({ id: owner.id, nickname: owner.nickname, perm: 2 });

        channel.users.forEach((u) => {
            const userObj = { id: u.id, nickname: u.nickname, perm: 0 };

            if (channel.admins.find(a => a.id === u.id))
                userObj.perm = 1;

            if (u.id !== owner.id)
                users.push(userObj);
        });

        delete channel.users;
        delete channel.admins;

        client.leave(`channel_${channel.id}`);
        client.emit('channel_leave', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', channel);
        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage('channel_message')
    async handleNewMessage(
        @MessageBody() data: { channelId: number; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = await this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data) || !data.content || /^\s*$/.test(data.content)) {
            client.emit('error', `Invalid data or empty message`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, [
            'users',
        ]);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }
        const message = await this.channelService.addMessage(
            channel.id,
            plainToClass(AddMessageEntityDto, {
                channelId: channel.id,
                content: data.content,
                userNick: user.nickname,
                userId: user.id,
            }),
        );

        if (!message) {
            client.emit('error', 'Message could not be sent to channel');
            return;
        }
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

        if (!user || !data.friendId || !data.content || /^\s*$/.test(data.content))  {
            client.emit('error', `Invalid data`);
            return;
        }

        const friend = await this.userService.getUserById(data.friendId, [
            'friends',
        ]);

        if (!friend || !friend.friends.find(u => u.id === user.id)) {
            client.emit('error', `This person is not your friend`);
            return;
        }

        this.socketService.sendMessage(client.id, friend.id, data.content);

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

        if (!user) {
            client.emit('error', `??? What the heck ???`);
            return;
        }

        const userFriends = await this.userService.getFriends(user.id);
        const userPendingFriends = await this.userService.getPendingFriends(user.id);

        if (!userFriends || !userPendingFriends) {
            client.emit('error', `Data error`);
            return;
        }

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

        if (!user || !data.userNick) {
            client.emit('error', `Invalid data`);
            return;
        }

        const friend = await this.userService.getUserByNickname(data.userNick, ['friends']);

        if (!friend || friend.id === user.id) {
            client.emit('error', `Could not add user as friend`);
            return;
        }

        const r = await this.userService.addFriend(user.id, friend.id);

        if (r.status !== "success") {
            client.emit('error', `Could not add user as friend`);
            return;
        }

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

        if (!user || !data.friendId) {
            client.emit('error', `Invalid data`);
            return;
        }

        const friend = await this.userService.getUserById(data.friendId, ['friends']);

        if (!friend) {
            client.emit('error', `Failed to remove friend`);
            return;
        }

        const r = await this.userService.deleteFriend(user.id, friend.id);

        if (r.status !== "success") {
            client.emit('error', `Failed to remove friend`);
            return;
        }

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

        if (!user || !userData || !('userId' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        const target = await this.userService.getUserById(data.userId, ['friends']);

        if (!target || target.id === user.id) {
            client.emit('error', `Failed to block user ${user.nickname}`);
            return;
        }

        const r = await this.userService.addBlocked(user.id, target.id);

        if (r.status !== "success") {
            client.emit('error', `Failed to block user ${user.nickname}`);
            return;
        }

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

        if (!user || !userData || !('userId' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        const target = await this.userService.getUserById(data.userId);

        if (!target || target.id === user.id) {
            client.emit('error', `Failed to unblock user ${user.nickname}`);
            return;
        }

        const r = await this.userService.deleteBlocked(user.id, target.id);

        if (r.status !== "success") {
            client.emit('error', `Failed to unblock user ${user.nickname}`);
            return;
        }

        client.emit('user_unblock', { userId: target.id });
    }

    @SubscribeMessage('user_nick')
    async changeNickname(
        @MessageBody() data: { newNick: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !data.newNick || /^\s*$/.test(data.newNick)) {
            client.emit('error', `Invalid data`);
            return;
        }

        if (data.newNick.length > 16 || data.newNick.length < 4) {
            client.emit('error', `Nickname must include 4 to 16 characters`);
            return;
        }

        const success = await this.userService.setNickname(user.id, data.newNick);

        if (!success) {
            client.emit('error', `Nickname ${data.newNick} is already taken`);
            return;
        }

        this.socketService.updateUserNickname(user.id, data.newNick);

        client.emit('user_nick', { newNick: data.newNick });
    }

    @SubscribeMessage('channel_users')
    async getChannelUserList(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, ['users', 'admins']);

        if (!channel) {
            client.emit('error', `Invalid channelId`);
            return;
        }

        if (!channel.users.find(u => u.id === user.id)) {
            client.emit('error', `You are not a member of this channel`);
            return;
        }

        const users = [];
        const owner = channel.users.find(u => u.id === channel.ownerId);

        users.push({ id: owner.id, nickname: owner.nickname, perm: 2 });

        channel.users.forEach((u) => {
            const userObj = { id: u.id, nickname: u.nickname, perm: 0 };

            if (channel.admins.find(a => a.id === u.id))
                userObj.perm = 1;

            if (u.id !== owner.id)
                users.push(userObj);
        });

        client.emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage('channel_add_admin')
    async addChannelAdmin(
        @MessageBody() data: { userId: number, channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data) || !('userId' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, ['users', 'admins']);

        if (!channel) {
            client.emit('error', `Invalid channelId`);
            return;
        }

        if (!channel.users.find(u => u.id === user.id)) {
            client.emit('error', `You are not a member of this channel`);
            return;
        }

        const users = [];
        const owner = channel.users.find(u => u.id === channel.ownerId);

        users.push({ id: owner.id, nickname: owner.nickname, perm: 2 });

        channel.users.forEach((u) => {
            const userObj = { id: u.id, nickname: u.nickname, perm: 0 };

            if (channel.admins.find(a => a.id === u.id))
                userObj.perm = 1;

            if (u.id !== owner.id)
                users.push(userObj);
        });
5
        if (users.find(u => u.id === user.id)?.perm < users.find(u => u.id === data.userId)) {
            client.emit('error', `Insufficient permissions`);
            return;
        }

        const success = await this.channelService.addChannelAdmin(channel.id, data.userId);

        if (!success) {
            client.emit('error', `Failed to add channel admin`);
            return;
        }

        users.find(u => u.id === data.userId).perm = 1;

        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage('channel_del_admin')
    async delChannelAdmin(
        @MessageBody() data: { userId: number, channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data) || !('userId' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, ['users', 'admins']);

        if (!channel) {
            client.emit('error', `Invalid channelId`);
            return;
        }

        if (!channel.users.find(u => u.id === user.id)) {
            client.emit('error', `You are not a member of this channel`);
            return;
        }

        const users = [];
        const owner = channel.users.find(u => u.id === channel.ownerId);

        users.push({ id: owner.id, nickname: owner.nickname, perm: 2 });

        channel.users.forEach((u) => {
            const userObj = { id: u.id, nickname: u.nickname, perm: 0 };

            if (channel.admins.find(a => a.id === u.id))
                userObj.perm = 1;

            if (u.id !== owner.id)
                users.push(userObj);
        });
        5
        if (users.find(u => u.id === user.id)?.perm > users.find(u => u.id === data.userId)) {
            client.emit('error', `Insufficient permissions`);
            return;
        }

        const success = await this.channelService.removeChannelAdmin(channel.id, data.userId);

        if (!success) {
            client.emit('error', `Failed to remove channel admin`);
            return;
        }

        users.find(u => u.id === data.userId).perm = 0;

        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage("channel_sanctions")
    async getChannelSanctions(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, ['users']);

        if (!channel) {
            client.emit('error', `Invalid channelId`);
            return;
        }

        if (!channel.users.find(u => u.id === user.id)) {
            client.emit('error', `You are not a member of this channel`);
            return;
        }

        const users: { muted: boolean, banned: boolean, id: number, nickname: string }[] = [];

        const sanctions = await this.channelService.getChannelSanctions(channel.id);

        for (const s of sanctions) {
            const sanctionUser = await this.userService.getUserById(s.userId);
            const usr = users.find(u => u.id === s.userId);

            if (!usr) {
                users.push({ muted: s.type === SanctionType.MUTE, banned: s.type === SanctionType.BAN, id: sanctionUser.id, nickname: sanctionUser.nickname });
            } else {
                usr.banned = true;
                usr.muted = true;
            }
        }

        client.emit("channel_sanctions", { channelId: channel.id, users });
    }

    @SubscribeMessage("channel_add_sanction")
    async addChannelSanction(
        @MessageBody() data: { userId: number, channelId: number, sanction: SanctionType, duration: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        console.log(data);
        if (!user || !('channelId' in data) || !('userId' in data) || !data.sanction || !data.duration) {
            client.emit('error', `Invalid data`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, ['users']);

        if (!channel) {
            client.emit('error', `Invalid channelId`);
            return;
        }

        if (!channel.users.find(u => u.id === user.id)) {
            client.emit('error', `You are not a member of this channel`);
            return;
        }

        if (!channel.users.find(u => u.id === data.userId)) {
            client.emit('error', `You are not a member of this channel`);
            return;
        }

        const r = await this.channelService.addChannelSanction(channel.id, user.id, data.userId, data.sanction, data.duration);
        if (r.status === "error") {
            client.emit("error", r.message);
            return;
        }

        const users: { muted: boolean, banned: boolean, id: number, nickname: string }[] = [];

        const sanctions = await this.channelService.getChannelSanctions(channel.id);

        for (const s of sanctions) {
            const sanctionUser = await this.userService.getUserById(s.userId);
            const usr = users.find(u => u.id === s.userId);

            if (!usr) {
                users.push({ muted: s.type === SanctionType.MUTE, banned: s.type === SanctionType.BAN, id: sanctionUser.id, nickname: sanctionUser.nickname });
            } else {
                usr.banned = true;
                usr.muted = true;
            }
        }

        this.server.to(`channel_${channel.id}`).emit("channel_sanctions", { channelId: channel.id, users });
        if (data.sanction === SanctionType.BAN)
            await this.leaveChannel({ channelId: channel.id, userId: data.userId }, null);
    }
}

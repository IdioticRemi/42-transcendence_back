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
import {Invite, SocketService} from './socket.service';
import * as argon2 from "argon2";
import {SanctionType} from "../channel/entities/sanction.entity";
import {Repository} from "typeorm";
import {ChannelEntity} from "../channel/entities/channel.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {ChannelDto} from 'src/channel/dto/channel.dto';
import { failureMResponse } from 'lib/MResponse';
import { GameType } from 'src/game/entities/game.entity';
import { UserEntity } from 'src/users/entities/user.entity';
import { MsgMaxSize } from 'lib';

export class UserPermission {
    id: number;
    nickname: string;
    perm: number;
}

export class SocketMessage {
    event: string;
    payload: any;
}

@WebSocketGateway({cors: true})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        private channelService: ChannelService,
        private userService: UsersService,
        private socketService: SocketService,
        @InjectRepository(ChannelEntity)
        private channelRepository: Repository<ChannelEntity>
    ) {
        setInterval(async () => {
            const deleted = await this.channelService.refreshSanctions();
            const channels = [];

            deleted.forEach((s) => {
                if (!channels.includes(s.channel.id))
                    channels.push(s.channel.id);
            });

            for (const chanId of channels) {
                const sanctions = await this.channelService.getChannelSanctionsFormatted(chanId);

                this.server.to(`channel_${chanId}`).emit("channel_sanctions", { channelId: chanId, users: sanctions });
            }

            for (const s of deleted) {
                this.sendSocketMsgByUserId(
                    s.userId,'warning', 
                    `You are no longer ${s.type}${s.type === 'mute' ? 'd' : 'ned'} ${s.type === 'mute' ? 'in' : 'from'} #${s.channel.name}`
                    );
            }
        }, 10 * 1e3);
    }

    async handleConnection(client: Socket) {
        console.debug("SOCKET: verifying user connection")
        if (!client.handshake.headers.authorization) {
            client.disconnect();
            return;
        }

        const user = await this.userService.getUserByToken(
            client.handshake.headers.authorization, ['friends', 'blocked', 'channels', 'channels.messages']
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
            client.emit('channel_info', plainToClass(ChannelDto, c, {excludeExtraneousValues: true}));
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
            client.emit('error', 'Invalid user CHAN_LIST');
            return;
        }

        const userChannels = await this.userService.getSubscribedChannels(user.id, ['messages']);

        if (!userChannels) {
            client.emit('error', 'database error');
            return;
        }

        userChannels.forEach((c) => {
            client.join(`channel_${c.id}`);
            client.emit('channel_info', plainToClass(ChannelDto, c, {excludeExtraneousValues: true}));
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

        client.emit('channel_info', plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
    }

    @SubscribeMessage('channel_create')
    async createChannel(
        @MessageBody() data: { name: string, private: boolean, password?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('private' in data) || !('name' in data) || /^\s*$/.test(data.name)) {
            client.emit('error', 'cannot create this channel');
            return;
        }

        if ('password' in data)
            data.private = true;

        const ret = await this.channelService.createChannel(user.id, data.name, data.password || "", data.private);

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
        this.server.to(`channel_${channel.id}`).emit('channel_info', plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
    }

    @SubscribeMessage('channel_update')
    async updateChannel(
        @MessageBody() data: { name: string, isPrivate: boolean, channelId: number, password: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('isPrivate' in data) || !('name' in data) || !('password' in data) || /^\s*$/.test(data.name)) {
            client.emit('error', 'Invalid data');
            return;
        }

        data.name = data.name.trim();

        if (data.password !== '')
            data.isPrivate = true;

        const channel = await this.channelService.getChannelById(data.channelId, ['messages', 'admins']);

        if (!channel) {
            client.emit('error', 'No such channel');
            return;
        }

        if (!channel.admins.find(a => a.id === user.id) && channel.ownerId !== user.id) {
            client.emit('error', 'Insufficient permissions');
            return;
        }

        channel.isPrivate = data.isPrivate;
        try {
            if (channel.password !== "")
                channel.password = await argon2.hash(data.password);
        } catch {
            client.emit('error', 'Password hashing failed');
            return;
        }
        channel.name = data.name;

        this.channelRepository.save(channel).then(() => {
            client.emit('success', 'Successfully updated channel');
            this.server.to(`channel_${channel.id}`).emit('channel_info', plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
        }).catch(() => {
            client.emit('error', 'Channel name is taken');
            return;
        });
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

        const r = await this.channelService.addUserToChannel(user.id, data.channelId);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, [
            'messages',
            'admins',
            'users'
        ]);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }

        const users = this.getChannelPermissionList(channel);

        delete channel.users;
        delete channel.admins;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: data.channelId, users });
    }

    @SubscribeMessage('channel_joinprv')
    async joinPrivateChannel(
        @MessageBody() data: { channelName: string, password?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelName' in data)) return;

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

        const users = this.getChannelPermissionList(channel);

        users.push({id: user.id, nickname: user.nickname, perm: 0});

        delete channel.users;
        delete channel.admins;

        client.join(`channel_${channel.id}`);
        client.emit('channel_join', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage('channel_delete')
    async deleteChannel(
        @MessageBody() data: { channelId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

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
            user = this.socketService.getConnectedUser(client.id);
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

        const users = this.getChannelPermissionList(channel);

        delete channel.users;
        delete channel.admins;

        client.leave(`channel_${channel.id}`);
        client.emit('channel_leave', {channelId: channel.id});
        this.server.to(`channel_${channel.id}`).emit('channel_info', plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
        this.server.to(`channel_${channel.id}`).emit("channel_users", { channelId: channel.id, users });
    }

    @SubscribeMessage('channel_message')
    async handleNewMessage(
        @MessageBody() data: { channelId: number; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data) || !('content' in data) || /^\s*$/.test(data.content)) {
            client.emit('error', `Invalid data or empty message`);
            return;
        }

        if (data.content.length > MsgMaxSize) {
            client.emit("error", `You cannot send more than ${MsgMaxSize} characters`);
            return;
        }

        const channel = await this.channelService.getChannelById(data.channelId, [
            'users',
            'sanctions'
        ]);

        if (!channel) {
            client.emit('error', 'Invalid channel');
            return;
        }

        if (!channel.users.find(u => u.id === user.id)) {
            client.emit('error', 'You are not a member of this channel');
            return;
        }

        if (channel.sanctions.find(s => s.userId === user.id)) {
            client.emit('error', 'You are not allowed to send messages');
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
            createdAt: message.createdAt
        });
    }

    @SubscribeMessage('friend_message')
    async handleFriendMessage(
        @MessageBody() data: { friendId: number; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('friendId' in data) || !('content' in data) || /^\s*$/.test(data.content))  {
            client.emit('error', `Invalid data`);
            return;
        }

        const friend = await this.userService.getUserById(data.friendId, [
            'friends',
        ]);

        if (!friend  || !friend.friends.find(u => u.id === user.id)) {
            client.emit('error', `This person is not your friend`);
            return;
        }

        const userData = await this.userService.getUserById(user.id, [
            'friends',
        ]);

        if (!userData  || !userData.friends.find(u => u.id === friend.id)) {
            client.emit('error', `You are not friend with this person`);
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
        @MessageBody() data: { user: string | number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('user' in data)) {
            client.emit('error', `Invalid data`);
            return;
        }

        let friend = undefined;
        if (typeof data.user === 'string') {
            friend = await this.userService.getUserByNickname(data.user, ['friends']);
        } else {
            friend = await this.userService.getUserById(data.user, ['friends']);
        }

        if (!friend || friend.id === user.id) {
            client.emit('error', `Could not add user as friend`);
            return;
        }

        const r = await this.userService.addFriend(user.id, friend.id);

        if (r.status !== "success") {
            client.emit('error', r.message);
            return;
        }

        if (friend.friends.find(f => f.id === user.id)) {
            const friendSocket = this.socketService.getUserKVByUserId(friend.id);
            const isFriendConnected = !!friendSocket;

            if (isFriendConnected) {
                this.server.to(friendSocket[0]).emit('friend_info', { id: user.id, nickname: user.nickname, status: 'online', messages: [] });
                this.server.to(friendSocket[0]).emit('success', `You are now ${user.nickname}'s friend!`);
            }

            client.emit('success', `You are now ${friend.nickname}'s friend!`);
            client.emit('friend_info', { id: friend.id, nickname: friend.nickname, status: isFriendConnected ? 'online' : 'offline', messages: [] });
        }
        else {
            this.sendSocketMsgByUserId(friend.id, 'warning', `${user.nickname} added you as a friend`);

            client.emit('success', `Sent friend request to ${user.nickname}`);
            client.emit('friend_info', { id: friend.id, nickname: friend.nickname, status: 'pending', messages: [] });
        }
    }

    @SubscribeMessage('friend_remove')
    async removeFriend(
        @MessageBody() data: { friendId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('friendId' in data)) {
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

        this.socketService.clearMessages(friend.id, user.id);

        const friendSocket = this.socketService.getUserKVByUserId(friend.id);
        const friendIsConnected = !!friendSocket;

        if (friendIsConnected) {
            this.server.to(friendSocket[0]).emit('warning', `You are no longer ${user.nickname}'s friend`);
            this.server.to(friendSocket[0]).emit('friend_remove', { friendId: user.id });
        }

        client.emit('success', `You are no longer ${user.nickname}'s friend`);
        client.emit('friend_remove', { friendId: friend.id });
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

        this.socketService.clearMessages(target.id, user.id);

        const friendSocket = this.socketService.getUserKVByUserId(target.id);
        const friendIsConnected = !!friendSocket;

        if (friendIsConnected && target.friends.find(f => f.id === user.id)) {
            this.server.to(friendSocket[0]).emit('warning', `You have been blocked by ${user.nickname}`);
            this.server.to(friendSocket[0]).emit('friend_remove', { friendId: user.id });
        }
        if (userData.friends.find(f => f.id === target.id))
            client.emit('friend_remove', { friendId: target.id });
        client.emit('success', `You have blocked ${target.nickname}`);
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

        client.emit('success', `You have unblocked ${target.nickname}`);
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

        client.emit('success', `You changed your nickname to ${data.newNick}`);
        client.emit('user_nick', { newNick: data.newNick });
    }

    @SubscribeMessage('channel_users')
    async getChannelUsers(
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

        const users = this.getChannelPermissionList(channel);

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

        const users = this.getChannelPermissionList(channel);

        if (users.find(u => u.id === user.id)?.perm < users.find(u => u.id === data.userId)?.perm) {
            client.emit('error', `Insufficient permissions`);
            return;
        }

        const success = await this.channelService.addChannelAdmin(channel.id, data.userId);

        if (!success) {
            client.emit('error', `Failed to add channel admin`);
            return;
        }

        users.find(u => u.id === data.userId).perm = 1;

        this.sendSocketMsgByUserId(data.userId, 'success', `You are now a channel admin in #${channel.name}`);

        client.emit('success', `${users.find(u => u.id === data.userId)?.nickname} is now a channel admin`);
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

        const users = this.getChannelPermissionList(channel);
        
        if (users.find(u => u.id === user.id)?.perm < users.find(u => u.id === data.userId).perm) {
            client.emit('error', `Insufficient permissions`);
            return;
        }

        const success = await this.channelService.removeChannelAdmin(channel.id, data.userId);

        if (!success) {
            client.emit('error', `Failed to remove channel admin`);
            return;
        }

        users.find(u => u.id === data.userId).perm = 0;

        this.sendSocketMsgByUserId(data.userId, 'warning', `You are no longer a channel admin in #${channel.name}`);

        client.emit('success', `${users.find(u => u.id === data.userId)?.nickname} is no longer a channel admin`);

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

        const sanctions = await this.channelService.getChannelSanctionsFormatted(channel.id);

        client.emit("channel_sanctions", { channelId: channel.id, users: sanctions });
    }

    @SubscribeMessage("channel_add_sanction")
    async addChannelSanction(
        @MessageBody() data: { userId: number, channelId: number, sanction: SanctionType, duration: number },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data) || !('userId' in data) || !('sanction' in data) || !data.duration) {
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

        const target = channel.users.find(u => u.id === data.userId);
        if (!target) {
            client.emit('error', `Target is not a member of this channel`);
            return;
        }

        const r = await this.channelService.addChannelSanction(channel.id, user.id, data.userId, data.sanction, data.duration);
        if (r.status === "error") {
            client.emit("error", r.message);
            return;
        }

        client.emit('success', `You successfully ${data.sanction === 'ban' ? 'banned' : 'muted' } ${target.nickname}`);
        this.sendSocketMsgByUserId(target.id, 'error', `You have been ${data.sanction === 'ban' ? 'banned' : 'muted' } from #${channel.name} by ${user.nickname}`);
        const sanctions = await this.channelService.getChannelSanctionsFormatted(channel.id);

        this.server.to(`channel_${channel.id}`).emit("channel_sanctions", { channelId: channel.id, users: sanctions });
        if (data.sanction === SanctionType.BAN)
            await this.leaveChannel({ channelId: channel.id, userId: data.userId }, null);
    }

    @SubscribeMessage("channel_del_sanction")
    async delChannelSanction(
        @MessageBody() data: { userId: number, channelId: number, sanction: SanctionType },
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user || !('channelId' in data) || !('userId' in data) || !('sanction' in data)) {
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

        if (!channel.users.find(u => u.id === data.userId) && data.sanction === SanctionType.MUTE) {
            client.emit('error', `Target is not a member of this channel`);
            return;
        }

        const r = await this.channelService.removeSanction(channel.id, user.id, data.userId, data.sanction);
        if (r.status === "error") {
            client.emit("error", r.message);
            return;
        }

        const sanctions = await this.channelService.getChannelSanctionsFormatted(channel.id);

        this.sendSocketMsgByUserId(data.userId,
            'warning',
            `You are no longer ${data.sanction}${data.sanction === 'mute' ? 'd' : 'ned'} ${data.sanction === 'mute' ? 'in' : 'from'} #${channel.name}`
            );

        client.emit('success', `Target is no longer ${data.sanction === 'mute' ? 'muted' : 'banned'}`);
        this.server.to(`channel_${channel.id}`).emit("channel_sanctions", { channelId: channel.id, users: sanctions });
    }

    sendSocketMsgByUserId(userId: number, event: string, payload: any = null) {
        const client = this.socketService.getUserKVByUserId(userId);
        const isClientOnline = !!client;

        if (isClientOnline) {
            this.server.to(client[0]).emit(event, payload);
        }
    }

    getChannelPermissionList(channel: ChannelEntity): UserPermission[] {

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

        return users;
    }

    @SubscribeMessage('game_add_queue')
    async requestMatch(
        @MessageBody() data: { type: GameType },
        @ConnectedSocket() client: Socket,
    ) {
        if (!client || !("type" in data)) {
            client.emit('error', "Invalid data");
            return ;
        }
        const user = this.socketService.getConnectedUser(client.id)
        if (!user) {
            client.emit('error', 'Invalid user GAME_ADD_QUEUE');
            return ;
        }
        console.debug(`game requested for ${user.nickname}`);
        const r = this.socketService.addUserToMatchmaking(user.id, data.type);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        client.emit('game_queued', { type: data.type });

        const r2 = await this.socketService.checkMatch();

        if (r2.status !== 'success') {
            if (r2.message)
                client.emit('error', r2.message);
            return;
        }

        const [socket1, socket2] = r2.payload.map(g => this.getSocketFromUserId(g.player.id));

        if (!socket1 || !socket2) {
            console.log("What? Someone is offline??");
        }

        const gameId = [r2.payload[0].player.id, r2.payload[1].player.id].sort().join('_');

        socket1.join(`game_${gameId}`);
        socket2.join(`game_${gameId}`);
 
        this.server.to(`game_${gameId}`).emit('success', `Found opponent! Started game with ID: ${gameId}`);
        this.server.to(`game_${gameId}`).emit('game_found');
    }

    getSocketFromUserId(userId: number) {
        const user = this.socketService.getUserKVByUserId(userId);

        if (!user)
            return null;
        return this.getSocketFromSocketId(user[0]);
    }

    getSocketFromSocketId(socketId: string) {
        return this.server.sockets.sockets.get(socketId);
    }

    @SubscribeMessage('game_del_queue')
    async cancelMatch(
        @ConnectedSocket() client: Socket,
    ) {
        const user = this.socketService.getConnectedUser(client.id);

        if (!user) {
            client.emit('error', 'Invalid user GAME_DEL_QUEUE');
            return;
        }
        
        const r = this.socketService.cancelMatchmakingFor(user.id);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        client.emit('game_unqueued');
    }

    @SubscribeMessage('game_invite')
    async inviteUser(
        @MessageBody() data: { nickname: string, type: GameType },
        @ConnectedSocket() client: Socket,

    ) {
        const user = this.socketService.getConnectedUser(client.id);
        if (!user || !('nickname' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        const target = this.socketService.getConnectedUserByNick(data.nickname);
        
        const r = this.socketService.inviteUser(user.id, target?.id, data.type);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        const invite = this.socketService.getInvites(target.id).find(i => i.id === user.id);

        client.emit('game_invite_sent', { ...invite, nickname: target.nickname });
        this.sendSocketMsgByUserId(target.id, 'game_invite', { ...invite, nickname: user.nickname });
    }

    @SubscribeMessage('game_uninvite')
    async uninviteUser(
        @MessageBody() data: { nickname: string, type: GameType },
        @ConnectedSocket() client: Socket,

    ) {
        const user = this.socketService.getConnectedUser(client.id);
        if (!user || !('nickname' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        const target = this.socketService.getConnectedUserByNick(data.nickname);
        
        const r = this.socketService.uninviteUser(user.id, target?.id);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        client.emit('game_invite_cancel', { ...r.payload, nickname: target.nickname });
        this.sendSocketMsgByUserId(target.id, 'game_invite_del', { ...r.payload, nickname: user.nickname });
        this.sendSocketMsgByUserId(target.id, 'warning', `${user.nickname} cancelled their invitation`);
    }

    @SubscribeMessage('game_invite_accept')
    async acceptInvite(
        @MessageBody() data: Invite,
        @ConnectedSocket() client: Socket,

    ) {
        const user = this.socketService.getConnectedUser(client.id);
        if (!user || !('id' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        const target = this.socketService.getConnectedUserById(data.id);
        
        const r = this.socketService.deleteInvite(user.id, target?.id);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        const r2 = await this.socketService.createGame(user, target, data.type);

        if (r2.status !== 'success') {
            client.emit('error', r2.message);
            return;
        }

        const gameId = [r2.payload[0].player.id, r2.payload[1].player.id].sort().join('_');

        client.join(`game_${gameId}`);
        this.getSocketFromUserId(target.id)?.join(`game_${gameId}`);

        // Notify and remove invite from store
        client.emit('success', `You accepted ${target.nickname}'s invite`);
        client.emit('game_invite_del', { ...r.payload, nickname: user.nickname });
        this.sendSocketMsgByUserId(target.id, 'success', `${user.nickname} accepted your invite`);
        this.sendSocketMsgByUserId(target.id, 'game_invite_accepted', { ...r.payload, nickname: user.nickname });

        // Stop queue animation and send to game page??
        this.server.to(`game_${gameId}`).emit('success', 'CREATED GAME WITH ID: ' + gameId);
        this.server.to(`game_${gameId}`).emit('game_found');
    }

    @SubscribeMessage('game_invite_refuse')
    async refuseInvite(
        @MessageBody() data: Invite,
        @ConnectedSocket() client: Socket,

    ) {
        const user = this.socketService.getConnectedUser(client.id);
        if (!user || !('id' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        const target = this.socketService.getConnectedUserById(data.id);
        
        const r = this.socketService.deleteInvite(user.id, target?.id);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        // Notify and remove invite from store
        client.emit('success', `You refused ${target.nickname}'s invite`);
        client.emit('game_invite_del', { ...r.payload, nickname: user.nickname });
        this.sendSocketMsgByUserId(target.id, 'warning', `${user.nickname} refused your invite`);
        this.sendSocketMsgByUserId(target.id, 'game_invite_refused', { ...r.payload, nickname: user.nickname });
    }
}

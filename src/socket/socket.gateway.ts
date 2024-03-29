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
import { PadMove } from 'src/game/lib/game';
import { UserEntity } from 'src/users/entities/user.entity';
import { channelNameMaxSize, msgMaxSize, nicknameMaxSize, nicknameMinSize, passwordMaxSize } from 'lib';
import { GameService } from 'src/game/game.service';
import { forwardRef, Inject } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';

export class UserPermission {
    id: number;
    nickname: string;
    perm: number;
}

export class SocketMessage {
    event: string;
    payload: any;
}

function isObject(o: any) {
    return (!!o) && (o.constructor === Object);
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
        private channelRepository: Repository<ChannelEntity>,
        private gameService: GameService,
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

        try {
            const r = jwt.verify(client.handshake.headers.authorization, process.env.JWT_SECRET) as unknown as {userId: number, exp: number, iot: number};

            client.emit('success', `Your token will expire ${moment(r.exp * 1000).fromNow()}`);
        } catch (e)  {
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
        
        const alreadyConnected = this.socketService.isUserOnline(user.id);
        if (alreadyConnected) {
            client.emit('logout_user');
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

            // SEND MESSAGES TO RECIPIENTS
            // Is inviting someone?
            if (this.socketService.isInviting(user.id)) {
                const target = [...this.socketService.invites.entries()].find(([id, invite]) => invite.find((i) => i.id === user.id));
                this.socketService.invites.set(target[0], target[1].filter(i => i.id !== user.id));
            }
            // Is invited by people?
            if (this.socketService.invites.has(user.id)) {
                const invites = this.socketService.invites.get(user.id);
                invites.forEach((invite) => {
                    this.refuseInvite(invite, client);
                });
                this.socketService.invites.delete(user.id);
            }
            // NO MESSAGE
            // Is spectating a game?
            if (this.socketService.isSpectating(user.id)) {
                const game = [...this.socketService.games.values()].find(g => g.spectators.find(s => s === user.id));
                game.spectators = game.spectators.filter(s => s !== user.id);
            }
            if (this.socketService.matchmakingClassic.includes(user.id)) {
                this.socketService.matchmakingClassic = this.socketService.matchmakingClassic.filter(u => u !== user.id);
            }
            if (this.socketService.matchmakingCustom.includes(user.id)) {
                this.socketService.matchmakingCustom = this.socketService.matchmakingCustom.filter(u => u !== user.id);
            }
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

        if (!user || !isObject(data) || !('channelId' in data)) {
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

        if (!user || !isObject(data) || !('private' in data) || !('name' in data)) {
            client.emit('error', 'cannot create this channel');
            return;
        }

        if (!data.name || /^\s*$/.test(data.name) || data.name.length > channelNameMaxSize) {
            client.emit('error', 'Channel name invalid');
            return;
        }

        if ('password' in data)
            data.private = true;

        if (data.private == true && 'password' in data) {
            if (data.password && (data.password.length == 0 || data.password.length > passwordMaxSize || /^\s*$/.test(data.password))) {
                client.emit('error', 'Channel password invalid');
                return;
            }
        }

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

        if (!user || !isObject(data) || !('isPrivate' in data) || !('name' in data) || !('password' in data)) {
            client.emit('error', 'Invalid data');
            return;
        }

        
        if (!data.name || /^\s*$/.test(data.name) || data.name.length > channelNameMaxSize) {
            client.emit('error', 'Channel name invalid');
            return;
        }
        
        
        data.name = data.name.trim();
        
        if (!data.password)
            data.password = '';
        if (data.password !== '')
        data.isPrivate = true;
        
        if (data.isPrivate == true && data.password.length > 0 && (data.password.length > passwordMaxSize || /^\s*$/.test(data.password))) {
            client.emit('error', 'Channel password invalid');
            return;
        }

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
            if (data.password !== "")
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

        if (!user || !isObject(data) || !('channelId' in data)) {
            client.emit('error', 'Invalid data');
            return;
        }

        const c = await this.channelService.getChannelById(data.channelId);
        if (c.isPrivate) {
            client.emit('error', "This channel is private");
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

        if (!user || !isObject(data) || !('channelName' in data)) return;

        if (!data.channelName || data.channelName.length > channelNameMaxSize) {
            client.emit('error', "Invalid channel name");
            return;
        }

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
            if (!('password' in data) || !data.password || data.password.length > passwordMaxSize) {
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

        if (!user || !isObject(data) || !('channelId' in data)) {
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
        this.server.socketsLeave(`channel_${channel.id}`);
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

        if (!user || !isObject(data) || !('channelId' in data)) {
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

        if (!user || !isObject(data) || !('channelId' in data) || !('content' in data) || /^\s*$/.test(data.content)) {
            client.emit('error', `Invalid data or empty message`);
            return;
        }

        if (!data.content || data.content.length > msgMaxSize) {
            client.emit("error", `You cannot send more than ${msgMaxSize} characters`);
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

        if (!user || !isObject(data) || !('friendId' in data) || !('content' in data) || /^\s*$/.test(data.content))  {
            client.emit('error', `Invalid data`);
            return;
        }


        if (!data.content || data.content.length > msgMaxSize) {
            client.emit("error", `You cannot send more than ${msgMaxSize} characters`);
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

        const msg = this.socketService.sendMessage(client.id, friend.id, data.content);

        if (!msg)
            return;

        this.sendSocketMsgByUserId(friend.id, 'friend_message', msg);
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

        if (!user || !isObject(data) || !('user' in data) || !data.user) {
            client.emit('error', `Invalid data`);
            return;
        }

        
        let friend = undefined;
        if (typeof data.user === 'string') {            
            if (data.user.length > nicknameMaxSize) {
                client.emit("error", `Nickname length is ${msgMaxSize} characters max`);
                return;
            }
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

        if (!user || !isObject(data) || !('friendId' in data)) {
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

        if (!user || !isObject(data) || !userData || !('userId' in data)) {
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

        if (!user || !isObject(data) || !userData || !('userId' in data)) {
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

        if (!user || !isObject(data) || !data.newNick || /^\s*$/.test(data.newNick)) {
            client.emit('error', `Invalid data`);
            return;
        }

        if (!data.newNick || data.newNick.length > nicknameMaxSize || data.newNick.trim().length < nicknameMinSize) {
            client.emit('error', `Nickname must include ${nicknameMinSize} to ${nicknameMaxSize} characters`);
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

        if (!user || !isObject(data) || !('channelId' in data)) {
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

        if (!user || !isObject(data) || !('channelId' in data) || !('userId' in data)) {
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

        if (!user || !isObject(data) || !('channelId' in data) || !('userId' in data)) {
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

        if (!user || !isObject(data) || !('channelId' in data)) {
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

        if (!user || !isObject(data) || !('channelId' in data) || !('userId' in data) || !('sanction' in data) || !data.duration) {
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

        if (!user || !isObject(data) || !('channelId' in data) || !('userId' in data) || !('sanction' in data)) {
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
        if (!client || !isObject(data) || !("type" in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        if (data.type !== GameType.CLASSIC && data.type !== GameType.CUSTOM) {
            client.emit('error', "Invalid game type");
            return;
        }

        const user = this.socketService.getConnectedUser(client.id)
        if (!user) {
            client.emit('error', 'Invalid user GAME_ADD_QUEUE');
            return;
        }

        if (this.socketService.isInviting(user.id)) {
            client.emit('error', 'You cannot queue while inviting');
            return;
        }

        if (this.socketService.isInGame(user.id)) {
            client.emit('error', 'You cannot queue while in game');
            return;
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

        const [socket1, socket2] = r2.payload.map(u => this.getSocketFromUserId(u.id));

        if (!socket1 || !socket2)
            return;

        const gameId = [r2.payload[0].id, r2.payload[1].id].sort().join('_');

        socket1.join(`game_${gameId}`);
        socket2.join(`game_${gameId}`);

        const r3 = await this.socketService.createGame(this.server, r2.payload[0], r2.payload[1], data.type);
        if (r3.status !== 'success') {
            if (r3.message)
                client.emit('error', r3.message);

            socket1.leave(`game_${gameId}`);
            socket2.leave(`game_${gameId}`);
            return;
        }

        // Cancel all invites from other players on both sides
        if (this.socketService.invites.has(r2.payload[0].id)) {
            const invites = this.socketService.invites.get(r2.payload[0].id);
            invites.forEach((invite) => {
                this.refuseInvite(invite, this.getSocketFromUserId(r2.payload[0].id));
            });
        }
        if (this.socketService.invites.has(r2.payload[1].id)) {
            const invites = this.socketService.invites.get(r2.payload[1].id);
            invites.forEach((invite) => {
                this.refuseInvite(invite, this.getSocketFromUserId(r2.payload[1].id));
            });
        }
 
        this.server.to(`game_${gameId}`).emit('success', `Found opponent! Starting game...`);
        this.server.to(`game_${gameId}`).emit('game_info', { p1: r2.payload[0].id, p2: r2.payload[1].id, p1Nick: r2.payload[0].nickname, p2Nick: r2.payload[1].nickname });
        this.server.to(`game_${gameId}`).emit('game_found');

        this.gameService.startGame(this.socketService.getGameByGameId(gameId));
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
        if (!user || !isObject(data) || !('nickname' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        if (!data.nickname || data.nickname.length < 4 || data.nickname.length > 16 || /^\s*$/.test(data.nickname)) {
            client.emit('error', 'Nickname length is 4 to 16 characters');
            return;
        }

        if (this.socketService.isInGame(user.id)) {
            client.emit('error', 'You cannot invite while in game');
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
        if (!user || !isObject(data) || !('nickname' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }

        if (!data.nickname || data.nickname.length < 4 || data.nickname.length > 16 || /^\s*$/.test(data.nickname)) {
            client.emit('error', 'Nickname length is 4 to 16 characters');
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
        if (!user || !isObject(data) || !('id' in data) || !('type' in data)) {
            client.emit('error', "Invalid data");
            return;
        }
    
        const target = this.socketService.getConnectedUserById(data.id);
        
        const r = this.socketService.deleteInvite(user.id, target?.id);

        if (r.status !== 'success') {
            client.emit('error', r.message);
            return;
        }

        const r2 = await this.socketService.createGame(this.server, user, target, data.type);

        if (r2.status !== 'success') {
            client.emit('error', r2.message);
            return;
        }

        // Cancel all invites from other players on both sides
        if (this.socketService.invites.has(r2.payload[0].player.id)) {
            const invites = this.socketService.invites.get(r2.payload[0].player.id);
            invites.forEach((invite) => {
                this.refuseInvite(invite, this.getSocketFromUserId(r2.payload[0].player.id));
            });
        }
        if (this.socketService.invites.has(r2.payload[1].player.id)) {
            const invites = this.socketService.invites.get(r2.payload[1].player.id);
            invites.forEach((invite) => {
                this.refuseInvite(invite, this.getSocketFromUserId(r2.payload[1].player.id));
            });
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
        this.server.to(`game_${gameId}`).emit('game_info', { p1: user.id, p2: target.id, p1Nick: user.nickname, p2Nick: target.nickname });
        this.server.to(`game_${gameId}`).emit('game_found');

        this.gameService.startGame(this.socketService.getGameByGameId(gameId));
    }

    @SubscribeMessage('game_invite_refuse')
    async refuseInvite(
        @MessageBody() data: Invite,
        @ConnectedSocket() client: Socket,

    ) {
        const user = this.socketService.getConnectedUser(client.id);
        if (!user || !isObject(data) || !isObject(data) || !('id' in data) || !('type' in data)) {
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

    @SubscribeMessage('game_move')
    async gameKeyPress(
        @MessageBody() data: string,
        @ConnectedSocket() client: Socket,
    ) {
        if (!client || !['ArrowUp', 'ArrowDown', 'Stop'].includes(data)) {
            client.emit('error', "Invalid data");
            return ;
        }
        const user = this.socketService.getConnectedUser(client.id);
        if (!user) {
            client.emit('error', 'Invalid user');
            return ;
        }

        let move = PadMove.STATIC;
        if (data === 'ArrowUp') move = PadMove.UP;
        if (data === 'ArrowDown') move = PadMove.DOWN;

        const r = this.socketService.movePlayer(user.id, move);
        if (r.status !== 'success') {
            return;
        }

    }

    @SubscribeMessage('game_list')
    async getGameList(
        @ConnectedSocket() client: Socket,
    ) {

        const user = this.socketService.getConnectedUser(client.id);
        if (!user) {
            client.emit('error', 'Invalid user')
            return;
        }

        const gameList = await this.socketService.getGames();

        client.emit('game_list', gameList);

    }

    @SubscribeMessage('game_spectate')
    async spectateGame(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: string,
    ) {
        const user = this.socketService.getConnectedUser(client.id);
        if (!user) {
            client.emit('error', 'Invalid user')
            return;
        }

        if (this.socketService.isInGame(user.id) || this.socketService.isInviting(user.id) || this.socketService.isInQueue(user.id) || this.socketService.isSpectating(user.id)) {
            client.emit('error', "You are already playing, queuing or spectating");
            return;
        }

        
        const gameId = data;
        const game = this.socketService.getGameByGameId(gameId);
        if (!game) {
            client.emit('error', 'Invalid game');
            return;
        }

        const p1 = await this.userService.getUserById(game.p1); 
        const p2 = await this.userService.getUserById(game.p2);
        
        if (!p1 || !p2) {
            client.emit('error', 'Invalid game data');
            return;

        }


        game.spectators.push(user.id);
        client.join(`game_${game.id}`);
        client.emit('game_found');
        client.emit('game_info', {p1: game.p1, p2: game.p2, p1Nick: p1.nickname, p2Nick: p2.nickname});

    }


}

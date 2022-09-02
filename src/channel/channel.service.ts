import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {plainToClass} from 'class-transformer';
import {failureMResponse, MResponse, successMResponse} from 'lib/MResponse';
import {Repository} from 'typeorm';
import {ChannelDto} from './dto/channel.dto';
import {AddMessageEntityDto} from './dto/message.dto';
import {ChannelEntity} from './entities/channel.entity';
import {MessageEntity} from './entities/message.entity';
import {SendUserDto} from 'src/users/dto/user.dto';
import {UsersService} from 'src/users/users.service';
import {UserEntity} from "../users/entities/user.entity";
import * as argon2 from "argon2";
import {SanctionEntity, SanctionType} from './entities/sanction.entity';

@Injectable()
export class ChannelService {
    constructor(
        @InjectRepository(ChannelEntity)
        private channelRepository: Repository<ChannelEntity>,
        @InjectRepository(MessageEntity)
        private messageRepository: Repository<MessageEntity>,
        @InjectRepository(SanctionEntity)
        private sanctionRepository: Repository<SanctionEntity>,
        private userService: UsersService
    ) {
    }

    async getAllChannels(): Promise<MResponse<ChannelDto[]>> {
        return await this.channelRepository.find({
            where: {
                isPrivate: false
            }
        })
            .then((channels) => {
                return successMResponse(channels.map((c) => plainToClass(ChannelDto, c, {excludeExtraneousValues: true})));
            })
            .catch(() => {
                return failureMResponse("database failure");
            })
    }

    async getChannelById(channelId: number, relations: string[] = []): Promise<ChannelEntity | undefined> {
        return await this.channelRepository.findOne({
            where: {
                id: channelId,
            },
            relations
        });
    }

    async getChannelByName(channelName: string, relations: string[] = []): Promise<ChannelEntity | undefined> {
        return await this.channelRepository.findOne({
            where: {
                name: channelName,
            },
            relations
        });
    }

    async createChannel(
        userId: number,
        channelName: string,
        password: string,
        isPrivate: boolean
    ): Promise<ChannelDto> | undefined {

        const user = await this.userService.getUserById(userId);
        if (!user)
            return undefined;

        // checks if channel already exists
        const channel = await this.channelRepository.findOne({
            where: {
                name: channelName
            }
        });
        if (channel)
            return undefined;

        if (password != "" && isPrivate) {
            try {
                password = await argon2.hash(password);
            } catch (e) {
                console.warn(e);
                return undefined;
            }
        }

        // create channel in DB
        const newChannel = await this.channelRepository.create({
            ownerId: userId,
            name: channelName,
            password: password,
            isPrivate: isPrivate
        });
        if (!newChannel)
            return undefined;

        newChannel.users = [user];
        newChannel.admins = [user];

        return this.channelRepository.save(newChannel)
            .then((newChannel) => {
                return plainToClass(ChannelDto, newChannel, {excludeExtraneousValues: true});
            }).catch(() => {
                return undefined;
            });
    }

    async deleteChannel(userId: number, channelId: number): Promise<MResponse<ChannelDto>> {

        //check if channel exists
        const channel = await this.channelRepository.findOne({
            where: {
                id: channelId
            },
            relations: ['admins']
        });
        if (!channel) {
            return failureMResponse("this channel does not exist");
        }

        // check if user is owner or channel admin
        if (channel.ownerId != userId && !channel.admins.find((admin) => userId === admin.id))
            return failureMResponse("user is not operator on this channel")

        // delete in DB
        return this.channelRepository.delete({
            id: channel.id
        })
            .then(() => {
                return successMResponse(plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
            })
            .catch(() => {
                return failureMResponse('cannot delete this channel');
            });
    }

    async getUsers(channelId: number): Promise<MResponse<SendUserDto[]>> {

        const channel = await this.channelRepository.findOne({
            where: {
                id: channelId
            },
            relations: ['users']
        });

        if (!channel)
            return failureMResponse("this channel does not exist");

        return successMResponse(channel.users.map((c) => plainToClass(SendUserDto, c, {excludeExtraneousValues: true})));
    }

    async addUserToChannel(userId: number, channelId: number): Promise<MResponse<ChannelDto>> {
        const channel = await this.channelRepository.findOne({
            where: {
                id: channelId
            },
            relations: ['users']
        })
        if (!channel)
            return failureMResponse("this channel does not exist");

        if (channel.users.find(u => u.id === userId))
            return failureMResponse("user already on channel");

        const user = await this.userService.getUserById(userId);

        if (!user)
            return failureMResponse("user not found");

        channel.users.push(user);
        return this.channelRepository.save(channel)
            .then(() => {
                return successMResponse(plainToClass(ChannelDto, channel, {excludeExtraneousValues: true}));
            })
            .catch((e) => {
                console.error(e);
                return failureMResponse("cannot register change in database");
            });
    }

    async deleteUserFromChannel(user: UserEntity, channelId: number, targetId: number): Promise<MResponse<boolean>> {

        const target = await this.userService.getUserById(targetId);
        if (!target)
            return failureMResponse("this user does not exist");

        const channel = await this.channelRepository.findOne({
            where: {
                id: channelId
            },
            relations: ['users', 'admins']
        })
        if (!channel)
            return failureMResponse("this channel does not exist");

        if (target.id !== user.id && !channel.admins.find((u) => u.id === user.id))
            return failureMResponse("missing privilleges to ban this user");
        if (target.id !== user.id && channel.ownerId === target.id)
            return failureMResponse("missing privilleges to ban this user");

        // inherit ownership and delete channel if empty
        if (channel.users.length === 1) {
            await this.deleteChannel(channel.ownerId, channel.id);
            return successMResponse(true);
        }

        channel.users = channel.users.filter(u => u.id !== target.id);
        channel.admins = channel.admins.filter(u => u.id !== target.id);

        if (target.id === channel.ownerId) {
            if (channel.admins.length > 1) {
                channel.ownerId = channel.admins[0].id;
            } else {
                const newOwner = channel.users[0];
                channel.ownerId = newOwner.id;
                channel.admins.push(newOwner);
            }
        }

        return await this.channelRepository.save(channel)
            .then(() => {
                return successMResponse(false);
            })
            .catch(() => {
                return failureMResponse("database error");
            });
    }

    async getMessages(channelId: number): Promise<MResponse<MessageEntity[]>> {

        // check if channel exists and pull messages relation
        const channel = await this.channelRepository.findOne({
            where: {
                id: channelId
            },
            relations: ['messages'],
        });
        if (!channel) {
            return failureMResponse('this channel does not exist');
        }

        return successMResponse(channel.messages);

    }

    async addMessage(channelId: number, message: AddMessageEntityDto): Promise<MessageEntity> {
        // check if channel exists and pull messages relation
        const channel = await this.channelRepository.findOne({
            where: {
                id: channelId
            },
            relations: ['messages']
        })
        if (!channel) {
            return null;
        }

        const newMessage = this.messageRepository.create(message)
        channel.messages.push(newMessage);
        await this.channelRepository.save(channel);

        return newMessage;
    }

    async getChannelAdmins(channelId: number): Promise<SendUserDto[] | undefined> {
        const channel = await this.getChannelById(channelId, ['admins']);
        if (!channel)
            return undefined;

        return channel.admins.map((admin) => plainToClass(SendUserDto, admin, {excludeExtraneousValues: true}));
    }

    async addChannelAdmin(channelId: number, userId: number): Promise<boolean> {

        const channel = await this.getChannelById(channelId, ['admins']);
        if (!channel)
            return false;

        const user = await this.userService.getUserById(userId);
        if (!user)
            return false;

        channel.admins.push(user);
        return this.channelRepository.save(channel)
            .then(() => { return true })
            .catch(() => { return false })
    }

    async removeChannelAdmin(channelId: number, userId: number): Promise<boolean> {

        const channel = await this.getChannelById(channelId, ['admins']);
        if (!channel)
            return false;

        const user = await this.userService.getUserById(userId);
        if (!user)
            return false;

        if (!channel.admins.find((a) => a.id === user.id))
            return false;

        channel.admins = channel.admins.filter((a) => a.id !== user.id);
        return this.channelRepository.save(channel)
            .then(() => { return true })
            .catch(() => { return false })

    }

    async getChannelSanctions(channelId: number): Promise<SanctionEntity[] | undefined> {
        const channel = await this.getChannelById(channelId, ['sanctions']);
        if (!channel)
            return undefined;
        return channel.sanctions;
    }

    async addChannelSanction(channelId: number, userId: number, targetId: number, sanction: SanctionType, minutes: number): Promise<MResponse<boolean>> {

        const channel = await this.getChannelById(channelId, ['admins', 'sanctions']);
        if (!channel)
            return failureMResponse("invalid channel");

        const user = await this.userService.getUserById(userId);
        if (!user)
            return failureMResponse("invalid user");

        const target = await this.userService.getUserById(targetId);
        if (!target)
            return failureMResponse("invalid target");

        if (!channel.admins.find(a => a.id === user.id))
            return failureMResponse("insufficient permissions");

        if (target.id === channel.ownerId)
            return failureMResponse("insufficient permissions");

        if (channel.admins.find(a => a.id === target.id) && !(channel.ownerId === userId))
            return failureMResponse("insufficient permissions");



        // TODO: addition ban time
        const previousSanction = channel.sanctions.find(s => s.userId === target.id && s.type === sanction);
        const endSanction = new Date(Date.now() + minutes * 60 * 1000);

        if (previousSanction) {
            if (endSanction.getTime() > previousSanction.end.getTime()) {
                channel.sanctions = channel.sanctions.filter(s => s.id !== previousSanction.id);
            } else return successMResponse(true);
        }

        const newSanction = this.sanctionRepository.create({userId: target.id, type: sanction, channel: channel, end: endSanction});
        if (!newSanction) {
            return failureMResponse("database error");
        }
        console.debug(`user ${sanction}-ed until ${endSanction}`);

        channel.sanctions.push(newSanction);
        
        return this.channelRepository.save(channel)
            .then(() => { return successMResponse(true) })
            .catch(() => { return failureMResponse("database error"); })
    }

    //TODO: MResponse ?
    async removeChannelBan(channelId: number, userId: number): Promise<boolean> {

        const channel = await this.getChannelById(channelId, ['sanctions']);
        if (!channel)
            return false;

        const user = await this.userService.getUserById(userId);
        if (!user)
            return false;

        if (!channel.sanctions.find((b) => b.userId === user.id))
            return false;

        channel.sanctions = channel.sanctions.filter((b) => b.userId !== user.id);
        
        return this.channelRepository.save(channel)
            .then(() => { return true })
            .catch(() => { return false })

    }

    async refreshSanctions() {
        const allSanctions = await this.sanctionRepository.find();
        const currentTime = new Date();
        const toDelete: SanctionEntity[] = [];

        allSanctions.forEach((sanction) => {
            if (currentTime.getTime() >= sanction.end.getTime())
                toDelete.push(sanction);
        });

        if (toDelete.length)
            await this.sanctionRepository.delete(toDelete.map(s => s.id));
    }

    async getChannelSanctionsFormatted(channelId: number) {
        const users: { muted: boolean, banned: boolean, id: number, nickname: string }[] = [];

        const sanctions = await this.getChannelSanctions(channelId);

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

        return users;
    }
}

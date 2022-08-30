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

@Injectable()
export class ChannelService {
    constructor(
        @InjectRepository(ChannelEntity)
        private channelRepository: Repository<ChannelEntity>,
        @InjectRepository(MessageEntity)
        private messageRepository: Repository<MessageEntity>,
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

    async getChannelById(channelId: number, relations: string[] = []): Promise<ChannelDto | undefined> {
        return this.channelRepository.findOne({
            where: {
                id: channelId,
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

    async deleteUserFromChannel(user: UserEntity, channelId: number, targetId: number): Promise<MResponse<SendUserDto>> {

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

        if (target.id != user.id && channel.ownerId != user.id && !channel.admins.find((u) => u.id === user.id))
            return failureMResponse("user has not enough privilege to delete target");

        channel.users = channel.users.filter(u => u.id != target.id);
        return await this.channelRepository.save(channel)
            .then(() => {
                return successMResponse(plainToClass(SendUserDto, target, {excludeExtraneousValues: true}));
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

    async getChannelByName(channelName: string, relations: string[] = []) {
        return this.channelRepository.findOne({
            where: {
                name: channelName,
            },
            relations
        });
    }
}

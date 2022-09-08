import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {failureMResponse, MResponse, successMResponse} from 'lib/MResponse';
import {Repository} from 'typeorm';
import {AddUserDto, SendUserDto} from './dto/user.dto';
import {UserEntity} from './entities/user.entity';
import * as fs from 'fs';
import {defaultAvatar} from 'lib';
import {ChannelEntity} from 'src/channel/entities/channel.entity';
import {plainToClass} from 'class-transformer';
import { GameEntity } from 'src/game/entities/game.entity';
import { identity } from 'rxjs';
import { GameEntityDto } from 'src/game/dto/game.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UserEntity)
        private usersRepository: Repository<UserEntity>,
        @InjectRepository(GameEntity)
        private gameRepository: Repository<GameEntity>
    ) {
    }

    async getAllUsers(): Promise<UserEntity[]> {
        return this.usersRepository.find();
    }

    async getUserById(id: number, relations: string[] = []): Promise<UserEntity | null> {
        return await this.usersRepository.findOne({
            where: {"id": id},
            relations: relations

        }).catch(() =>  null);
    }

    async getUserByUsername(user: string): Promise<UserEntity | null> {
        return await this.usersRepository.findOne({
            where: {"username": user},
        }).catch(() => null);
    }

    async getUserByToken(token: string, relations: string[] = []): Promise<UserEntity | null> {
        return await this.usersRepository.findOne({
            where: {token},
            relations,
        }).catch(() => null);
    }

    async addUser(newUser: AddUserDto): Promise<MResponse<SendUserDto>> {
        return this.usersRepository.save(newUser)
            .then((user) => {
                return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
            }).catch(() => {
                return failureMResponse("username already registered");
            });
    }

    async softRemoveUser(id: number): Promise<MResponse<SendUserDto>> {
        const toRemove = await this.getUserById(id);
        if (!toRemove)
            return failureMResponse("user does not exist")
        return await this.usersRepository.softRemove(toRemove)
            .then(() => {
                return successMResponse(plainToClass(SendUserDto, toRemove, {excludeExtraneousValues: true}));
            })
            .catch(() => {
                return failureMResponse("failed to remove user in database");
            });
    }

    async updateAvatar(user: string, path: string): Promise<MResponse<boolean>> {
        // checks if previous uploaded avatar and filename is different
        const userResult = await this.getUserByUsername(user);
        if (!userResult) {
            return failureMResponse("Invalid user");
        }

        const newPath = path.replace('.tmp', '');
        try {
            if (newPath.split('.').reverse()[0] !== userResult.img_path.split('.').reverse()[0])
                fs.unlinkSync(userResult.img_path);
            fs.renameSync(path, newPath);
        } catch {}
        
        // register new avatar's path in DB
        return await this.usersRepository.update({username: user}, {img_path: newPath}).then(() => {
            return successMResponse(true);
        }).catch((e) => {
            return failureMResponse("failed to save to database");
        });
    }

    async getFriends(userid: number): Promise<SendUserDto[]> {
        const user = await this.usersRepository.findOne({
            where: {id: userid},
            relations: ['friends']
        });
        if (!user)
            return null;

        const friends = [] as UserEntity[];
        for (const f of user.friends) {
            const friend = await this.getUserById(f.id, ['friends']);

            if (friend.friends.find(fr => fr.id === user.id)) {
                delete friend.friends;
                friends.push(friend);
            }
        }

        return friends.map((f) => plainToClass(SendUserDto, f, {excludeExtraneousValues: true}));
    }

    async getPendingFriends(userid: number): Promise<SendUserDto[]> {
        const user = await this.usersRepository.findOne({
            where: {id: userid},
            relations: ['friends']
        });
        if (!user)
            return null;

        const pending = [] as UserEntity[];
        for (const f of user.friends) {
            const friend = await this.getUserById(f.id, ['friends']);

            if (!friend.friends.find(fr => fr.id === user.id)) {
                delete friend.friends;
                pending.push(friend);
            }
        }

        return pending.map((f) => plainToClass(SendUserDto, f, {excludeExtraneousValues: true}));
    }

    async getSubscribedChannels(userid: number, relations: string[] = []): Promise<ChannelEntity[]> {
        const user = await this.usersRepository.findOne({
            where: {id: userid},
            relations: ['channels', ...relations.map(r => "channels." + r)]
        });
        if (!user)
            return undefined;
        return user.channels;
    }

    async addFriend(userId: number, friendId: number): Promise<MResponse<SendUserDto>> {
        const user = await this.getUserById(userId, ['friends', 'blocked']);
        const friend = await this.getUserById(friendId, ['friends', 'blocked']);

        if (!user || !friend) {
            return failureMResponse("target or user does not exist")
        }

        //check if already friends
        if (user.friends.find((f) => friend.id === f.id)) {
            return failureMResponse("target is already the user's friend");
        }

        // check if friend has blocked the user
        if (friend.blocked.find((f) => user.id === f.id)) {
            return failureMResponse("user is blocked by target");
        }

        // check if user has blocked the target
        if (user.blocked.find((f) => friend.id === f.id)) {
            return failureMResponse("target is blocked by user");
        }

        // save copies
        const user_cpy = Object.assign({}, user) as UserEntity;
        const friend_cpy = Object.assign({}, friend) as UserEntity;

        // remove circular references
        delete user_cpy.friends;
        delete friend_cpy.friends;
        delete user_cpy.blocked;
        delete friend_cpy.blocked;

        // save to database
        user.friends.push(friend_cpy);

        await this.usersRepository.save(user).catch(() => {
            return failureMResponse("unable to register change in the database")
        });

        return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
    }

    async deleteFriend(userId: number, friendId: number): Promise<MResponse<SendUserDto>> {
        const user = await this.getUserById(userId, ['friends']);
        const friend = await this.getUserById(friendId, ['friends']);

        // check if user and friend are in the database
        if (!user || !friend) {
            return failureMResponse("target or user does not exist");
        }

        const target = user.friends.find((f) => friend.id === f.id);
        //check if really friends
        if (!target) {
            return failureMResponse("target is not the user's friend");
        }

        // user side friend removal
        user.friends = user.friends.filter(f => f.id != friend.id);
        await this.usersRepository.save(user).catch(() => {
            return failureMResponse("unable to register change in the database")
        });

        // friend side friend removal
        friend.friends = friend.friends.filter(f => f.id != user.id);
        await this.usersRepository.save(friend).catch(() => {
            return failureMResponse("unable to register change in the database")
        });

        return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
    }

    async getBlocked(userid: number): Promise<MResponse<SendUserDto[]>> {
        const user = await this.usersRepository.findOne({
            where: {id: userid},
            relations: ['blocked']
        });
        if (!user)
            return failureMResponse("this user does not exist");
        return successMResponse(user.blocked.map((b) => plainToClass(SendUserDto, b, {excludeExtraneousValues: true})));
    }

    async addBlocked(userId: number, blockedId: number): Promise<MResponse<SendUserDto>> {
        const user = await this.getUserById(userId, ['friends', 'blocked']);
        const toBlock = await this.getUserById(blockedId);

        if (!user || !toBlock) {
            return failureMResponse("target or user does not exist");
        }

        //check if already blocked
        if (user.blocked.find((b) => toBlock.id === b.id)) {
            return failureMResponse("target is already blocked by user");
        }

        // check if user is friend with the target and remove friendship if necessary
        if (user.friends.find((f) => toBlock.id === f.id)) {
            await this.deleteFriend(user.id, toBlock.id);
            delete user.friends;
        }

        // save to database
        user.blocked.push(toBlock);

        return await this.usersRepository.save(user)
            .then(() => {
                return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
            })
            .catch(() => {
                return failureMResponse("cannot register change in the database");
            });
    }

    async deleteBlocked(userId: number, blockedId: number): Promise<MResponse<SendUserDto>> {

        // check if user is in the database and retrieve blocked relation
        const user = await this.getUserById(userId, ['blocked']);
        if (!user) {
            return failureMResponse("this user does not exist");
        }

        //check if really blocked
        const target = user.blocked.find((b) => blockedId === b.id);
        if (!target) {
            return failureMResponse("target is not blocked by the user");
        }

        // remove block and register change in database
        user.blocked = user.blocked.filter(b => b.id != target.id);
        return this.usersRepository.save(user)
            .then(() => {
                return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
            })
            .catch(() => {
                return failureMResponse("cannot register change in the database");
            });
    }

    async getUserByNickname(nickname: string, relations: string[] = []): Promise<UserEntity> {
        return await this.usersRepository.findOne({
            where: {nickname},
            relations,
        });
    }

    async setNickname(userId: number, newNick: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.usersRepository.update({
                id: userId,
            }, { nickname: newNick }).catch(() => {resolve(false);}).then(() => resolve(true));
        });
    }

    async getUserGames(userId: number): Promise<MResponse<GameEntityDto[]>> {
        const user = await this.getUserById(userId, ['games', 'games.player', 'games.opponent']);

        if (!user) {
            return failureMResponse("Invalid user");
        }

        return successMResponse(user.games.map((game) => plainToClass(GameEntityDto, {
                id: game.id,
                type: game.type,
                playerId: game.player.id,
                opponentId: game.opponent.id,
                opponentNick: game.opponent.nickname,
                opponentScore: game.opponentScore,
                playerScore: game.playerScore,
                endedAt: game.endedAt,
            }
        )));
    }

}
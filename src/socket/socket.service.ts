import {Injectable} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameEntity, GameType } from 'src/game/entities/game.entity';
import {UserEntity} from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {UsersService} from 'src/users/users.service';
import { failureMResponse, MResponse, successMResponse } from 'lib/MResponse';
import { Game } from 'src/game/lib/game';

export interface Invite {
    id: number;
    type: GameType;
}

@Injectable()
export class SocketService {

    private users: Map<string, UserEntity>;
    private messages: Map<string, {friendId: number, userId: number, userNick: string, content: string}[]>;
    private matchmakingClassic: number[];
    private matchmakingCustom: number[];
    private invites: Map<number, Invite[]>; // Map.get(userID) returns every userID that invited him
    private games: Map<string, Game>;

    constructor(
        private userService: UsersService,
        @InjectRepository(GameEntity)
        private gameRepository: Repository<GameEntity>
    ) {
        this.users = new Map();
        this.messages = new Map();
        this.invites = new Map();
        this.games = new Map();
        this.matchmakingClassic = [];
        this.matchmakingCustom = [];
    }

    sendMessage(from: string, to: number, content: string) {
        const user = this.users.get(from);

        if (user) {
            const target = [user.id, to].sort().join('');

            if (!this.messages.has(target)) {
                this.messages.set(target, []);
            }

            this.messages.get(target).push({ friendId: to, userId: user.id, userNick: user.nickname, content })
        }
    }

    updateUserNickname(userId: number, newNick: string) {
        this.getConnectedUserById(userId).nickname = newNick;
    }

    getMessages(user1: number, user2: number): any[] {
        return this.messages.get([user1, user2].sort().join('')) || [];
    }

    clearMessages(user1: number, user2: number): boolean {
        return this.messages.delete([user1, user2].sort().join(''));
    }

    getConnectedUserById(userId: number) {
        return [...this.users.values()].find((u) => u.id === userId);
    }

    getUserKVByUserId(userId: number) {
        return [...this.users.entries()].find((u) => u[1].id === userId);
    }

    getUserKVById(socketId: string) {
        return [...this.users.entries()].find((u) => u[0] === socketId);
    }

    connectUser(socketId: string, user: UserEntity) {
        this.users.set(socketId, user);
        this.invites.set(user.id, []);
    }

    getConnectedUser(socketId: string) {
        return this.users.get(socketId);
    }

    getConnectedUserByNick(nick: string) {
        return [...this.users.values()].find((u) => u.nickname === nick);
    }

    cancelMatchmakingFor(userId: number) {
        const user = this.getConnectedUserById(userId);

        if (user) {
            if (this.matchmakingClassic.includes(user.id)) {
                this.matchmakingClassic = this.matchmakingClassic.filter(p => p !== user.id);
                return successMResponse(true);
            }
            if (this.matchmakingCustom.includes(user.id)) {
                this.matchmakingCustom = this.matchmakingCustom.filter(p => p !== user.id);
                return successMResponse(true);
            }
            return failureMResponse("User is not queued up");
        }

        return failureMResponse("User is not connected????");
    }

    disconnectUser(socketId: string) {
        this.cancelMatchmakingFor(this.getConnectedUser(socketId)?.id);
        
        this.invites.delete(this.getConnectedUser(socketId)?.id);
        this.users.delete(socketId);
    }

    addUserToMatchmaking(userId: number, type: GameType) {
        // check if user already queued for a game
        if (this.matchmakingClassic.includes(userId) || this.matchmakingCustom.includes(userId)) {
            return failureMResponse("You are already queued up");
        }
        
        if (type === GameType.CLASSIC) {
            this.matchmakingClassic.push(userId);
            return successMResponse(true);
        }
        if (type === GameType.CUSTOM) {
            this.matchmakingCustom.push(userId);
            return successMResponse(true);
        }
        return failureMResponse("Unknown game type");
    }

    async checkMatch(): Promise<MResponse<GameEntity[]>> {
        if (this.matchmakingClassic.length > 1) {
            return await this.matchmake(GameType.CLASSIC);
        }
        else if (this.matchmakingCustom.length > 1) {
            return await this.matchmake(GameType.CUSTOM);
        }
        return failureMResponse("");
    }

    async matchmake(type: GameType): Promise<MResponse<GameEntity[]>> {
        
        const queue = type === GameType.CLASSIC ? this.matchmakingClassic : this.matchmakingCustom;
        
        const [p1, p2] = queue.splice(0, 2).map(p => this.getConnectedUserById(p));

        if (!p1 || !p2)
            return failureMResponse("a user is not online");
        
        return await this.createGame(p1, p2, type);
    }

    async createGame(p1: UserEntity, p2: UserEntity, type: GameType): Promise<MResponse<GameEntity[]>> {
        if (![GameType.CLASSIC, GameType.CUSTOM].includes(type))
            return failureMResponse("Invalid game type");

        const gameId = [p1.id, p2.id].sort().join('_');

        if (this.games.has(gameId))
            return failureMResponse("A game with the same players is already running");
        
        let gameP1 = this.gameRepository.create({
            player: p1,
            opponent: p2,
            type
        });
        let gameP2 = this.gameRepository.create({
            player: p2,
            opponent: p1,
            type
        });
        
        if (!gameP1 || !gameP2) {
            return failureMResponse("could not create database objects");
        }

        gameP1 = await this.gameRepository.save(gameP1)
            .catch((e) => {console.debug(e); return null});

        try {
            gameP2 = await this.gameRepository.save(gameP2);
            this.games.set(gameId, null);
        } catch (e) {
            console.debug(e);
            await this.gameRepository.delete(gameP1.id);
            return failureMResponse("could not save to database");
        }

        return (successMResponse([gameP1, gameP2]));
    }

    isUserOnline(userId: number): boolean {
        return (!!this.getConnectedUserById(userId));
    }

    getInvites(userId: number) {
        return this.invites.get(userId);
    }

    inviteUser(myUserId: number, targetUserId: number, type: GameType): MResponse<boolean> {
        if (!this.isUserOnline(targetUserId))
            return failureMResponse("Target is offline");
        
        const targetInvites = this.invites.get(targetUserId);

        if (targetInvites.find(i => i.id === myUserId))
            return failureMResponse("You already invited this user");

        targetInvites.push({ id: myUserId, type });

        return successMResponse(true);
    }

    uninviteUser(myUserId: number, targetUserId: number): MResponse<Invite> {
        if (!this.isUserOnline(targetUserId))
            return failureMResponse("Target is offline");
        
        const targetInvites = this.invites.get(targetUserId);

        if (!targetInvites.find(i => i.id === myUserId))
            return failureMResponse("You haven't invited this user");

        const deleted = targetInvites.find(i => i.id === myUserId);

        this.invites.set(targetUserId, targetInvites.filter(i => i.id !== myUserId));

        return successMResponse(deleted);
    }

    deleteInvite(myUserId: number, targetUserId: number): MResponse<Invite> {
        if (!this.isUserOnline(targetUserId))
            return failureMResponse("Target is offline");
        
        const myInvites = this.invites.get(myUserId);

        if (!myInvites.find(i => i.id === targetUserId))
            return failureMResponse("This user didn't invite you");

        const deleted = myInvites.find(i => i.id === targetUserId);

        this.invites.set(myUserId, myInvites.filter(i => i.id !== targetUserId));

        return successMResponse(deleted);
    }

    movePlayer(userId: number): MResponse<boolean> {
        
        const game  = [...this.games.values()].find((g) => g.p1 == userId || g.p2 == userId);
        if (!game) {
            return failureMResponse("no game found for this user");
        }
    }
}

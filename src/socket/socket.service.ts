import {Injectable} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameEntity, GameType } from 'src/game/entities/game.entity';
import {UserEntity} from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {UsersService} from 'src/users/users.service';
import { failureMResponse, MResponse, successMResponse } from 'lib/MResponse';
import { Game, PadMove } from 'src/game/lib/game';
import e from 'express';
import { Server } from 'socket.io';

export interface Invite {
    id: number;
    type: GameType;
}

@Injectable()
export class SocketService {

    private users: Map<string, UserEntity>;
    private messages: Map<string, {friendId: number, userId: number, userNick: string, content: string, createdAt: Date}[]>;
    public matchmakingClassic: number[];
    public matchmakingCustom: number[];
    public invites: Map<number, Invite[]>; // Map.get(userID) returns every userID that invited him
    public games: Map<string, Game>;

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

            const message = {
                friendId: to,
                userId: user.id,
                userNick: user.nickname,
                content,
                createdAt: new Date((Date.now()) + (new Date().getTimezoneOffset() * 60e3))
            };
            this.messages.get(target).push(message);
            return message;
        }

        return null;
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

    async checkMatch(): Promise<MResponse<UserEntity[]>> {
        if (this.matchmakingClassic.length > 1) {
            return await this.matchmake(GameType.CLASSIC);
        }
        else if (this.matchmakingCustom.length > 1) {
            return await this.matchmake(GameType.CUSTOM);
        }
        return failureMResponse("");
    }

    async matchmake(type: GameType): Promise<MResponse<UserEntity[]>> {
        
        const queue = type === GameType.CLASSIC ? this.matchmakingClassic : this.matchmakingCustom;
        
        const [p1, p2] = queue.splice(0, 2).map(p => this.getConnectedUserById(p));

        if (!p1 || !p2)
            return failureMResponse("a user is not online");
        
        return successMResponse([p1, p2]);
    }

    async createGame(server: Server, p1: UserEntity, p2: UserEntity, type: GameType): Promise<MResponse<GameEntity[]>> {
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

        try {
            gameP1 = await this.gameRepository.save(gameP1);
        } catch {
            return failureMResponse("could not save to database");
        }

        try {
            gameP2 = await this.gameRepository.save(gameP2);
            this.games.set(gameId, new Game(server, p1.id, p2.id, gameP1.id, gameP2.id, type));
        } catch {
            await this.gameRepository.delete(gameP1.id);
            return failureMResponse("could not save to database");
        }

        return (successMResponse([gameP1, gameP2]));
    }

    getGameByGameId(gameId: string) {
        return this.games.get(gameId);
    }

    getGameByPlayerId(userId: number) {
        return [...this.games.values()].find(g => [g.p1, g.p2].includes(userId));
    }

    isUserOnline(userId: number): boolean {
        return (!!this.getConnectedUserById(userId));
    }

    getInvites(userId: number) {
        return this.invites.get(userId);
    }

    inviteUser(myUserId: number, targetUserId: number, type: GameType): MResponse<boolean> {

        if (this.isInQueue(myUserId)) {
            return failureMResponse("You are already in queue for a game");
        }
        
        if (!this.isUserOnline(targetUserId))
            return failureMResponse("Target is offline");

        if (targetUserId === myUserId) {
            return failureMResponse("You cannot invite yourself");
        }
        
        const targetInvites = this.invites.get(targetUserId);

        if (targetInvites.find(i => i.id === myUserId))
            return failureMResponse("You already invited this user");

        if (this.isInQueue(targetUserId)) {
            return failureMResponse("Target is already queued for a game");
        }

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

    movePlayer(userId: number, key: PadMove): MResponse<boolean> {
        
        const game  = this.getGameByPlayerId(userId);
        if (!game) {
            return failureMResponse("no game found for this user");
        }

        const userPad = game[game.p1 === userId ? 'padLeft' : 'padRight'];
        // Make it so user cannot go in another direction until they have "unpressed" the previous key
        // if (key !== PadMove.STATIC)
            userPad.move = key;
        // Reset to static on key release or disconnected??
        // else if (userPad.move !== PadMove.STATIC && key === PadMove.STATIC)
            // userPad.move = key;

        return successMResponse(true);
    }

    isInQueue(userId: number) {
        return (this.matchmakingClassic.includes(userId) || this.matchmakingCustom.includes(userId))
    }

    isInGame(userId: number) {
        return [...this.games.values()].find(g => g.p1 === userId || g.p2 === userId)
    }

    isInviting(userId: number) {
        return [...this.invites.values()].find(invites => !!invites.find(i => i.id === userId));
    }

    isSpectating(userId: number) {
        return [...this.games.values()].find(game => game.spectactors.includes(userId));
    }

    endGame(gameId: string) {
        // final store to DB ??

        const { server } = this.games.get(gameId);
        
        server.socketsLeave(`game_${gameId}`);
        
        this.games.delete(gameId);
        
        console.debug(gameId, "game deleted");
    }

    async getGames() {
        return Promise.all([...this.games.values()].map(async (game) => {
            const p1 = await this.userService.getUserById(game.p1); 
            const p2 = await this.userService.getUserById(game.p2);
            
            if (!p1 || !p2)
                return null;

            return {
                id: game.id,
                p1: game.p1,
                p2: game.p2,
                p1Nick: p1.nickname,
                p2Nick: p2.nickname,
                p1Score: game.p1Score,
                p2Score: game.p2Score,
                type: game.type,
            }
        }).filter(g => g !== null));
    }



}

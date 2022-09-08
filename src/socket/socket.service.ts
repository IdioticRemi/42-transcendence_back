import {Injectable} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameEntity, GameType } from 'src/game/entities/game.entity';
import {UserEntity} from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {UsersService} from 'src/users/users.service';
import { failureMResponse, MResponse, successMResponse } from 'lib/MResponse';


export interface Point {
    x: number;
    y: number;
}

export interface Game {
    user1: number;
    user2: number;
    type: GameType;
    ballPos: Point;
    pad1: Point;
    pad2: Point;
    p1Score: number;
    p2Score: number;
    spectators: number[];
}

@Injectable()
export class SocketService {

    private users: Map<string, UserEntity>;
    private messages: Map<string, {friendId: number, userId: number, userNick: string, content: string}[]>;
    private matchmakingClassic: number[];
    private matchmakingCustom: number[];
    private games: [];

    constructor(
        private userService: UsersService,
        @InjectRepository(GameEntity)
        private gameRepository: Repository<GameEntity>
    ) {
        this.users = new Map();
        this.messages = new Map();
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
    }

    getConnectedUser(socketId: string) {
        return this.users.get(socketId);
    }

    disconnectUser(socketId: string) {
        const user = this.getConnectedUser(socketId);

        if (user) {
            if (this.matchmakingClassic.includes(user.id))
                this.matchmakingClassic = this.matchmakingClassic.filter(p => p !== user.id);
            if (this.matchmakingCustom.includes(user.id))
                this.matchmakingCustom = this.matchmakingCustom.filter(p => p !== user.id);
        }

        this.users.delete(socketId);
    }

    addUserToMatchmaking(userId: number, type: GameType) {
        // check if user already queued for a game
        if (this.matchmakingClassic.includes(userId) || this.matchmakingCustom.includes(userId)) {
            return failureMResponse("You are already queued up");
        }
        
        if (type === GameType.CLASSIC) {
            this.matchmakingClassic.push(userId);
            return successMResponse("Queued for a classic game");
        }
        if (type === GameType.CUSTOM) {
            this.matchmakingCustom.push(userId);
            return successMResponse("Queued for a custom game");
        }
        return failureMResponse("Unknown game type");
    }

    async checkMatch() {
        if (this.matchmakingClassic.length > 1) {
            return await this.matchmake(GameType.CLASSIC);
        }
        else if (this.matchmakingCustom.length > 1) {
            return await this.matchmake(GameType.CUSTOM);
        }
        return failureMResponse("");
    }

    async matchmake(type: GameType): Promise<MResponse<[GameEntity, GameEntity]>> {
        
        const queue = type === GameType.CLASSIC ? this.matchmakingClassic : this.matchmakingCustom;
        
        const [p1, p2] = queue.splice(0, 2).map(p => this.getConnectedUserById(p));

        if (!p1 || !p2)
            return failureMResponse("a user is not online");
        
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
        gameP1 = await this.gameRepository.save(gameP1).catch((e) => {console.debug(e); return null})
        try {
            gameP2 = await this.gameRepository.save(gameP2);
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

    movePlayer(userId: number): MResponse<boolean> {
        
        const game  = this.games.find((g) => g.p1 == userId || g.p2 == userId);
        if (!game) {
            return failureMResponse("no game found for this user");
        }
    }
}

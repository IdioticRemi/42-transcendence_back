import {Injectable} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameEntity, GameType } from 'src/game/entities/game.entity';
import {UserEntity} from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import {UsersService} from 'src/users/users.service';


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
        this.users.delete(socketId);
    }

    addUserToMatchmaking(userId: number, type: GameType) {
        if (type === GameType.CLASSIC)
            this.matchmakingClassic.push(userId);
        else
            this.matchmakingCustom.push(userId);
        // matchmake();
    }

    async matchmake(): Promise<GameEntity | undefined> {
        if (this.matchmakingClassic.length > 1) {
            const p1Id = this.matchmakingClassic[0];    
            const p2Id = this.matchmakingClassic[1];
            const P1 = this.user
            const gameP1 = this.gameRepository.create({
                player: p1,
                opponent: p2,
                type: GameType.CLASSIC
            })   
            if (!game) {
                console.debug("impossible to create game")
            }
            else {
                return this.gameRepository.save(game)
                    .then((g) => {return g})
                    .catch((e) => {console.debug(e); return undefined})
            }
        }

    }

    isUserOnline(userId: number): boolean {
        return (!!this.getConnectedUserById(userId));
    }
}

import {Injectable} from '@nestjs/common';
import {UserEntity} from 'src/users/entities/user.entity';

@Injectable()
export class SocketService {
    private users: Map<string, UserEntity>;
    private messages: Map<string, {friendId: number, userId: number, userNick: string, content: string}[]>

    constructor() {
        this.users = new Map();
        this.messages = new Map();
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
}

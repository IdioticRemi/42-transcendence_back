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
            const target = [user.id, to].sort((a, b) => a - b).join('');

            if (!this.messages.has(target)) {
                this.messages.set(target, []);
            }

            this.messages.get(target).push({ friendId: to, userId: user.id, userNick: user.nickname, content })
        }
    }

    getMessages(user1: number, user2: number): any[] {
        return this.messages.get([user1, user2].sort((a, b) => a - b).join('')) || [];
    }

    getConnectedUserById(userId: number) {
        return [...this.users.values()].find((u) => u.id === userId);
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

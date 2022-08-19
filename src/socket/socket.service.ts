import {Injectable} from '@nestjs/common';
import {UserEntity} from 'src/users/entities/user.entity';

@Injectable()
export class SocketService {
    private users: Map<string, UserEntity>;

    constructor() {
		this.users = new Map();
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

import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { UserEntity } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class SocketService {
	constructor(
		private userService: UsersService
	) {}

	async getUserFromSocket(client: Socket): Promise<UserEntity | undefined> {
		const auth_header = client.handshake?.headers?.authorization;

	  	if (!auth_header || !auth_header.startsWith("Bearer ") || auth_header.split(" ").length != 2) {
	  		return undefined;
	  	}

	  	const token = auth_header.split(" ")[1];
	  	console.debug(`WS GET USER: Token: ${token}`);

	  	const res_intra = await fetch("https://api.intra.42.fr/oauth/token/info", {
	  		headers: { Authorization: auth_header }
	  	});

	  	if (!res_intra.ok)
	  		return undefined;

	  	const body = await res_intra.json();

	  	try {
      	return await this.userService.getUserById(body.resource_owner_id);
	  	} catch (e) {}

    	return undefined;
	}
}

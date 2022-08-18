import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import fetch from "node-fetch";
import { UsersService } from 'src/users/users.service';

@Injectable()
export class UserInfoMiddleware implements NestMiddleware {
	constructor(
		private userService: UsersService
	) {}

  async use(req: Request, _: Response, next: NextFunction) {
    const auth_header = req.headers.authorization;
	if (!auth_header || !auth_header.startsWith("Bearer ") || auth_header.split(" ").length != 2) {
		next();
		return;
	}

	const token = auth_header.split(" ")[1];
	console.debug(`MIDDLEWARE: Token: ${token}`);

	const res_intra = await fetch("https://api.intra.42.fr/oauth/token/info", {
		headers: { Authorization: auth_header }
	});

	if (!res_intra.ok) {
		next();
		return;
	}

	const body = await res_intra.json();

	try {
		req.user = await this.userService.getUserById(body.resource_owner_id);
	} catch (e) {}
	
    next();
  }
}

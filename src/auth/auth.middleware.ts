import {Injectable, NestMiddleware} from '@nestjs/common';
import {NextFunction, Request, Response} from 'express';
import {UsersService} from 'src/users/users.service';


@Injectable()
export class UserInfoMiddleware implements NestMiddleware {
    constructor(
        private userService: UsersService
    ) {
    }

    async use(req: Request, _: Response, next: NextFunction) {
        const auth_header = req.headers.authorization;
        if (!auth_header || !auth_header.startsWith("Bearer ") || auth_header.split(" ").length != 2) {
            next();
            return;
        }
        const token = auth_header.split(" ")[1];
        console.debug(`MIDDLEWARE: Token: ${token}`);
        
        try {
            req.user = await this.userService.getUserByToken(token);
        } catch (e) {
            console.debug(e);
        }

        next();
    }
}

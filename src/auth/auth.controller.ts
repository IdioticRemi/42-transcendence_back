import {Controller, Get, Query, Res,} from '@nestjs/common';
import {AuthorizationService} from './auth.service';
import {UsersService} from "../users/users.service";

@Controller('auth')
export class AuthorizationController {
    constructor(
        private authorizationService: AuthorizationService,
        private usersService: UsersService
    ) {
    }

    @Get()
    AuthRequest(@Res() res) {
        res.redirect(
            `https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&scope=public&response_type=code`,
        );
    }

    @Get('check')
    async CheckRequest(@Query('token') token: string) {
        const user = await this.usersService.getUserByToken(token);
        if (user) {
            delete user.token;
            return {
                message: 'Token is valid',
                content: user,
                error: false,
            };
        } else {
            return {
                message: 'Token is invalid',
                content: null,
                error: true,
            };
        }
    }

    @Get('42Auth/callback')
    async AuthRedirect(@Query('code') code, @Res() res) {
        const user = await this.authorizationService.authenticate(code, res);
        if (user)
            res.redirect(`http://localhost:8081/login?token=${user.token}`);
        else res.redirect('http://localhost:8081/login?token=null');
    }
}

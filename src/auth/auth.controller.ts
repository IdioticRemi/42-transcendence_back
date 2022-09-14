import {Body, Controller, Get, Post, Query, Req, Res, UseGuards,} from '@nestjs/common';
import {AuthorizationService} from './auth.service';
import {UsersService} from "../users/users.service";
import { UserTokenGuard } from './auth.guard';
import { Request, Response } from 'express';
import { failureMResponse, successMResponse } from 'lib/MResponse';
import { toDataURL, toFileStream } from 'qrcode';

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

    @UseGuards(UserTokenGuard)
    @Post('generate')
    async generate(
        @Req() req: Request,
    ) {
        const r = await this.authorizationService.generate2faSecret(req.user);
        if (r.status === 'success') {
            try {
                return successMResponse(await toDataURL(r.payload.keyuri));
            } catch {
                return failureMResponse("failed to generate qrcode")
            }
        }
        return r;
    }

    @UseGuards(UserTokenGuard)
    @Post('enable-2fa')
    async enable2fa(
        @Req() req: Request,
        @Body('2fa_code') code: string
    ) {
        console.debug("code", code);
        const isCodeValid = this.authorizationService.verify2faToken(req.user, code);
        if (!isCodeValid)
            return failureMResponse("invalid 2fa code");
        return await this.authorizationService.enable2fa(req.user);
    }

    @UseGuards(UserTokenGuard)
    @Post('disable-2fa')
    async disable2fa(
        @Req() req: Request
    ) {
        return await this.authorizationService.disable2fa(req.user);
    }
}

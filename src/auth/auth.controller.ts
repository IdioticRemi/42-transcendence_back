import {Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards,} from '@nestjs/common';
import {AuthorizationService} from './auth.service';
import {UsersService} from "../users/users.service";
import { UserTokenGuard } from './auth.guard';
import { Request, Response } from 'express';
import { failureMResponse, successMResponse } from 'lib/MResponse';
import { toDataURL, toFileStream } from 'qrcode';
import { plainToClass } from 'class-transformer';
import { SendUserDto } from 'src/users/dto/user.dto';
import * as jwt from 'jsonwebtoken';

@Controller('auth')
export class AuthorizationController {
    constructor(
        private authorizationService: AuthorizationService,
        private usersService: UsersService
    ) {
    }


    //TODO rework with MResponse
    @Get()
    AuthRequest(@Res() res) {
        res.redirect(
            `https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&scope=public&response_type=code`,
        );
    }

    @Get('check')
    async CheckRequest(@Query('token') token: string) {
        const user = await this.usersService.getUserByToken(token);
        try {
            if (!user)
                throw new Error("Invalid user");
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            return failureMResponse('Token is invalid');
        }
        return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
    }

    @Get('42Auth/callback')
    async AuthRedirect(@Query('code') code, @Res() res) {
        const user = await this.authorizationService.authenticate(code, res);
        if (user) {
            if (!user.otp_enabled)
                res.redirect(`https://${process.env.BACKEND_IP}:8081/login?token=${user.token}`);
            else {
                res.redirect(`https://${process.env.BACKEND_IP}:8081/2fa?userId=${user.id}`);
            }
        }
        else res.redirect(`https://${process.env.BACKEND_IP}:8081/login?token=null`);
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

    @Post('verify-2fa')
    async verify2fa(
        @Body('userId', ParseIntPipe) userId: number,
        @Body('2fa_code') code: string,
    ) {
        console.debug("2FA: VERIFY CODE");
        let user = await this.usersService.getUserById(userId);
        if (!user) {
            return failureMResponse("Invalid user");
        }
        const isValid = this.authorizationService.verify2faToken(user, code);
        if (isValid) {
            console.debug("2FA: CODE VALID");
            return this.authorizationService.update2faToken(user);
        }
        console.debug("2FA: CODE INVALID");
        return failureMResponse("Invalid code");
    }
}

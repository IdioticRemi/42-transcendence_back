import { Controller, Get, HttpException, Param, Post, Query, Req, Res } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';

@Controller('auth')
export class AuthorizationController {
  constructor(
    private authorizationService: AuthorizationService
  ) {}

  @Get()
  AuthRequest(@Res() res) {
    res.redirect(
      `https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&scope=public&response_type=code`,
    );
  }

  @Get('check')
  async CheckRequest(
    @Query('token') token: string
  ) {
    console.debug(token);
    const user = await this.authorizationService.getUser(token);
    if (user) {
      return user;
    } else {
      return new HttpException("Forbidden access (Invalid Token)", 403)
    }
  }


  @Get('42Auth/callback')
  async AuthRedirect(@Query('code') code, @Res() res) {
    console.log('Callback from 42 API', 'code retrieved:', code);
    const user = await this.authorizationService.authenticate(code, res);
    console.log(user);
    if (user !== undefined)
      res.redirect(`http://localhost:8081/?token=${user.token}`);
    else res.redirect('http://localhost:8081?token=null');
  }
}

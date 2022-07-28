import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async authenticate(@Req() req) {
    console.log('authentification');
  }

  // @Get('login')
  // // @UseGuards(AuthGuard('42Auth'))
  // async authenticateLogin(@Req() req) {
  //   console.log("authentification");
  // }

  @Get('auth')
  AuthRequest(@Req() req: Request, @Res() res) {
    res.redirect(
      `https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&scope=public&response_type=code`,
    );
  }

  @Get('auth/42Auth/callback')
  async AuthRedirect(@Query('code') code, @Res() res) {
    console.log('Callback from 42 API', 'code retrieved:', code);
    const user = await this.appService.authenticate(code, res);
    console.log(user);
    if (user !== undefined)
      res.redirect(`http://localhost:8081/register?token=${user.token}`);
    else res.redirect('http://localhost:8081/');
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}

import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  // @UseGuards(AuthGuard('42Auth'))
  async authenticate(@Req() req) {
    console.log("authentification");
  }

  @Get('login')
  // @UseGuards(AuthGuard('42Auth'))
  async authenticateLogin(@Req() req) {
    console.log("authentification");
  }

  @Get('auth')
  AuthRequest(
    @Req() req,
    @Res() res
  ) {
    res.redirect(`https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&response_type=code`);
  }


  @Get('auth/42Auth/callback')
  // @UseGuards(AuthGuard('42Auth'))
  AuthRedirect(
    @Query('code') code,
    @Res() res
  ) {
    console.log("Callback from 42 API", code);
    const body = {
      client_id: process.env.UID,
      client_secret: process.env.SECRET,
      code
    }
    const options = { headers: { accept: 'application/json' } };
    
    // return this.appService.authLogin(req)
  }

  @Get('hello')
  // @UseGuards(AuthGuard('42Auth'))
  getHello(): string {
    return this.appService.getHello();
  }
}

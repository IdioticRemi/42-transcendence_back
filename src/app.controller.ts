import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';
// import * as axios from '@nestjs/axios';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async authenticate(@Req() req) {
    console.log("authentification");
  }

  // @Get('login')
  // // @UseGuards(AuthGuard('42Auth'))
  // async authenticateLogin(@Req() req) {
  //   console.log("authentification");
  // }

  @Get('auth')
  AuthRequest(
    @Req() req : Request,
    @Res() res
  ) {
    res.redirect(`https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&scope=public&response_type=code`);
  }


  @Get('auth/42Auth/callback')
  async AuthRedirect(
    @Query('code') code,
    @Res() res
  ) {
    console.log("Callback from 42 API", "code retrieved:", code);
    const cond: boolean = await this.appService.authenticate(code, res);
    console.log(cond);
    if (cond)
      res.redirect('http://localhost:8081/register');
    else
      res.redirect('http://localhost:8081/?login=false');  
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}

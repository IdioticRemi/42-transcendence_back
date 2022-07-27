import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';
import * as axios from '@nestjs/axios';
import { Token } from 'client-oauth2';


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
    res.redirect(`https://api.intra.42.fr/oauth/authorize?client_id=${process.env.UID}&redirect_uri=${process.env.CALLBACK_URI}&response_type=code`);
  }


  @Get('auth/42Auth/callback')
  AuthRedirect(
    @Query('code') code,
    @Res() res
  ) {
    console.log("Callback from 42 API", code);
    if (this.appService.authenticate(code, res))
      res.redirect('http://localhost:8081/register');
    else
      res.redirect('http://localhost:8081/');
    // get exchange code for token
    

    // make a request with token
  
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}

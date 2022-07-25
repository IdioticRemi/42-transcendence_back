import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @UseGuards(AuthGuard('42Auth'))
  async authenticate(@Req() req) {
  }

  @Get('auth/42Auth/callback')
  @UseGuards(AuthGuard('42Auth'))
  AuthRedirect(@Req() req) {
    return this.appService.authLogin(req)
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}

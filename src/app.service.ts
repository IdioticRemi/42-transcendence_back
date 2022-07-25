import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  authLogin(req) {
    if (!req.user) {
      return 'No user from 42'
    }
    return {
      message: 'User Info from 42',
      user: req.user
    }
  }
}

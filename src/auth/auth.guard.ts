import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Request } from 'express';
import fetch from "node-fetch";

@Injectable()
export class UserTokenGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest() as Request;

	  if (!req.user)
      return false;
    return true;
  }
}
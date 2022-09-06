import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {Request} from 'express';

@Injectable()
export class UserTokenGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest() as Request;

        if (!req.user)
            return false;

        return true;
    }
}
import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {Request} from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class UserTokenGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest() as Request;

        if (!req.user)
            return false;
        
        try {
            const jwtoken = jwt.verify(req.user.token, process.env.JWT_SECRET);
            console.debug("GUARD: JWT :", jwtoken);
        } catch (e)  {
            console.log("GUARD: JWT VERIFICATION FAIL");
            return false;
        }

        return true;
    }
}
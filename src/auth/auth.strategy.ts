import {PassportStrategy} from "@nestjs/passport";
import {Injectable} from "@nestjs/common";
import {Strategy} from 'passport-42'

@Injectable()
export class AuthorizationStrategy extends PassportStrategy(Strategy, '42Auth') {
    constructor() {
        super({
            clientID: process.env.UID,
            clientSecret: process.env.SECRET,
            callbackURL: process.env.CALLBACK_URI,
            scope: 'public',
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any): Promise<any> {
        const {username, photos} = profile;
        const user = {
            username,
            photos
        }
        return user;
    }
}
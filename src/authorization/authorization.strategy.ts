import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { Strategy } from 'passport-42'

@Injectable()
export class AuthorizationStrategy extends PassportStrategy(Strategy, '42Auth') {
	constructor() {
		super({
			clientID : '1756d3ec1d32646782085a847ac19c071a87bf180406b8745b67ae9f1f982a59',
			clientSecret: '702322027765a41a470665ac64ba0575b89b955585c53871aff2348c2c32ca90',
			callbackURL:'http://localhost:8081/auth/42Auth/callback',
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
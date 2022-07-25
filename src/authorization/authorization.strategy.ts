import { PassportStrategy } from "@nestjs/passport";
import { Injectable } from "@nestjs/common";
import { Strategy } from 'passport-42'

@Injectable()
// export class AuthorizationStrategy extends PassportStrategy(Strategy, '42Auth') {
// 	constructor() {
// 		super({
// 			clientID : '80c987b591e14c7fc931bb601af9d12e225943529e5994725bea31b2ee46f859',
// 			clientSecret: '8e55985f78977158171495e28aed49886f2e2010b65c250c24c320bd07d57923',
// 			callbackURL: 'http://localhost:3000/auth/42Auth/callback',
// 			scope: ['email', 'profile'],
// 		});
// 	}
// 	async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallBack): Promise<any> {
// 		const {name, emails, photos} = profile;
// 		const user = {
// 			email:emails[0].value,
// 			firstname: name.givenName,
// 			lastname: name.familyName,
// 			picture: photos[0].value,
// 			accessToken
// 		}
// 		done(null, user)
// 	}
export class AuthorizationStrategy extends PassportStrategy(Strategy, '42Auth') {
	constructor() {
		super({
			clientID : '80c987b591e14c7fc931bb601af9d12e225943529e5994725bea31b2ee46f859',
			clientSecret: '8e55985f78977158171495e28aed49886f2e2010b65c250c24c320bd07d57923',
			callbackURL: 'http://localhost:3000/auth/42Auth/callback',
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
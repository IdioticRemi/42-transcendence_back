import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import fetch from "node-fetch";
import { JsonResponseInterface } from 'lib/api.objects';
import { GetUserDto } from 'src/users/dto/user.dto';
import * as fs from 'fs';
import axios from 'axios';
import { UsersService } from 'src/users/users.service';


@Injectable()
export class AuthorizationService {
	constructor(
		@InjectRepository(UserEntity)
		private userRepository: Repository<UserEntity>,
		private usersService: UsersService
	) {}

	async getToken(code: string, res: Response): Promise<string> {
		console.log("now retrieving token...");
		const body = {
		  "grant_type": 'authorization_code',
		  "client_id": process.env.UID,
		  "client_secret": process.env.SECRET,
		  "redirect_uri": process.env.CALLBACK_URI,
		  "code": code,
		}
		const options = {
		  method: "POST",
		  headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "http://127.0.0.1:3000",
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Methods": "POST",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		  },
		  body: JSON.stringify(body),
		};
		const token = await fetch("https://api.intra.42.fr/oauth/token", options)
		  .then(async (response) => {
			let json = await response.json() as JsonResponseInterface;
			// console.log("token request's response:", json);
			if (!response.ok) {
			  return Promise.reject(json.message);
			}
			const token = json.access_token as string;
			return token;
		  })
		  .catch((error) => {
			console.log(error);
			return ''; // return empty token if error
		  });
		  return Promise.resolve(token);
	  }
	
	  async authenticate(code: string, res: Response): Promise<UserEntity|undefined> {
		const token = await this.getToken(code, res);
		if (token === '')
			return undefined;
		console.log("token obtained:", token);
		// get user info 
		const options = {
		  method: "GET",
		  headers: {
			"Authorization": "Bearer " + token,
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "http://127.0.0.1:3000",
			"Access-Control-Allow-Credentials": "true",
			"Access-Control-Allow-Methods": "GET",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		  },
		};
		return fetch("https://api.intra.42.fr/v2/me", options)
			.then(async (response) => {
			// console.log(response);
			if (!response.ok) {
				return Promise.reject(`Error ${response.status}: Failed to get user infos`);
			}
			let json = await response.json() as GetUserDto;
			//   console.log("user info's response:", json);
			if (json.hasOwnProperty('id') && json.hasOwnProperty('login')){
				const id42 = json.id;
				const username = json.login;
				console.log("id:", id42, "username:", username, "token:", token);
				return this.logUser(id42, username, token);
			}
			else
				return undefined;
			})
			.catch((error) => {
				console.log(error);
				return undefined;
			});
	  }
	
	  async logUser(id42: string, username: string, token: string): Promise<Partial<UserEntity>> {
		let user = await this.userRepository.findOne({
		  where: {
			"username": username
			}
		  });
		if (!user)
		{
		  console.log("unregistered user, creating new account with credentials:", username, token);
		  const newUser = await this.userRepository.save({
			"id": parseInt(id42),
			"username": username,
			"token": token
		  })
		  	.catch(() => {console.log("cannot register user", username)});
		  // download 42 intra's picture
		  console.log(`downloading intra picture from https://cdn.intra.42.fr/users/${username}.jpg`);
		  const imgPath = `./uploads/${username}.jpg`;
		  const url = `https://cdn.intra.42.fr/users/${username}.jpg`;
		  axios({url, method: 'GET', responseType: 'stream'})
			.then((response) => {
				if (response.status === 200)
				{
					// save file on server
					const writer = fs.createWriteStream(imgPath);
					response.data.pipe(writer);
		
					// update DB with avatar's path
					this.usersService.updateAvatar(username, imgPath);
				}
			})
			.catch(() => {
				console.log("impossible to download 42's picture");
			});
		  return newUser as Partial<UserEntity>;
		}
		console.log(`${user.username} is already registered in the database`);
		return user;
	  }
}

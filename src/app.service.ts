import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StringifyOptions } from 'querystring';
import { Repository } from 'typeorm';
import { AddUserDto } from './users/dto/user.dto';
import { UserEntity } from './users/entities/user.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

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
        let json = await response.json();
        console.log("token request's response:", json);
        if (!response.ok) {
          return Promise.reject(json.message);
        }
        const token = json.access_token as string;
        return token;
      })
      .catch((error) => {
        console.log(error);
        // TODO: handle error
        return 'ERROR REMOVE THIS';
      });
      return Promise.resolve(token);
  }

  async authenticate(code: string, res: Response): Promise<boolean> {
    const token = await this.getToken(code, res);
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
    // fetch("https://api.intra.42.fr/v2/users?filter[login]=dburgun", options)
    fetch("https://api.intra.42.fr/v2/me", options)
      .then(async (response) => {
        console.log(response);
        if (!response.ok) {
          return Promise.reject(`Error ${response.status}: Failed to get user infos`);
        }
        let json = await response.json();
        console.log("user info's response:", json);
        const id42 = json.id;
        const username = json.login;
        console.log("id:", id42, "username:", username, "token:", token);
        this.logUser(id42, username, token);
      })
      .catch((error) => {
        console.log(error);
      });
    return false;
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
      .catch((user) => {console.log("cannot register user", user)});
      return newUser as Partial<UserEntity>;
    }
    return user;
  }
}

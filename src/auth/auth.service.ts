import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {UserEntity} from 'src/users/entities/user.entity';
import {Repository} from 'typeorm';
import fetch from "node-fetch";
import {JsonResponseInterface} from 'lib/api.objects';
import {GetUserDto, SendUserDto} from 'src/users/dto/user.dto';
import * as fs from 'fs';
import axios from 'axios';
import {UsersService} from 'src/users/users.service';
import {plainToClass} from "class-transformer";
import { totp, authenticator } from 'otplib';
import { failureMResponse, MResponse, successMResponse } from 'lib/MResponse';


@Injectable()
export class AuthorizationService {
    constructor(
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        private usersService: UsersService
    ) {
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
                const json = await response.json() as JsonResponseInterface;
                // console.log("token request's response:", json);
                if (!response.ok) {
                    return Promise.reject(json.message);
                }
                return json.access_token as string;
            })
            .catch((error) => {
                console.log(error);
                return '';
            });
        return Promise.resolve(token);
    }

    async getUser(token: string): Promise<UserEntity | undefined> {
        const options = {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token,
            },
        };
        return fetch("https://api.intra.42.fr/v2/me", options)
            .then(async (response) => {
                if (!response.ok) {
                    return Promise.reject(`Error ${response.status}: Failed to get user infos`);
                }
                const json = await response.json() as GetUserDto;
                if (json.hasOwnProperty('id') && json.hasOwnProperty('login')) {
                    const id42 = json.id;
                    const username = json.login;
                    console.log("id:", id42, "username:", username, "token:", token);
                    return await this.logUser(id42, username, token);
                } else
                    return undefined;
            })
            .catch((error) => {
                console.log(error);
                return undefined;
            });
    }

    async authenticate(code: string, res: Response): Promise<UserEntity | undefined> {
        const token = await this.getToken(code, res);
        if (token === '')
            return undefined;
        console.log("AUTH: NEW TOKEN GENERATED:", token);
        return this.getUser(token);
    }

    async logUser(id42: string, username: string, token: string): Promise<UserEntity> {
        const user = await this.userRepository.findOne({
            where: {
                "username": username
            }
        });

        if (!user) {
            let nickname = username;
            let alreadyExist = true;

            while (alreadyExist) {
                alreadyExist = !!(await this.usersService.getUserByNickname(nickname));

                if (!alreadyExist)
                    break;

                nickname = username + '_';
                const characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                const charactersLength = characters.length;
                for (let i = 0; nickname.length < 16; i++ ) {
                    nickname += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
            }
            console.log(`AUTH: INITIALIZING NEW USER: ${username} (${id42})`);
            const newUser = await this.userRepository.save({
                "id": parseInt(id42),
                "username": username,
                "nickname": nickname,
                "token": token
            })
                .catch(() => {
                    console.log("cannot register user", username)
                });
            if (!newUser)
                return undefined;
            console.log(`AUTH: DOWNLOADING FILE: https://cdn.intra.42.fr/users/${username}.jpg`);
            const imgPath = `./uploads/${username}.jpg`;
            const url = `https://cdn.intra.42.fr/users/${username}.jpg`;
            axios({url, method: 'GET', responseType: 'stream'})
                .then((response) => {
                    if (response.status === 200) {
                        // save file on server
                        const writer = fs.createWriteStream(imgPath);
                        response.data.pipe(writer);

                        // update DB with avatar's path
                        this.usersService.updateAvatar(username, imgPath);
                    }
                })
                .catch(() => {
                    console.log('AUTH: Could not download user pfp');
                });
            return newUser;
        }
        if (user.token !== token) {
            await this.userRepository.update({id: user.id}, {token});
            user.token = token;
        }
        console.log(`AUTH: EXISTING USER: ${user.username}`);
        return user;
    }

    async generate2faSecret(user: UserEntity): Promise<MResponse<{secret: string, keyuri: string}>> {
        if (user.otp_enabled)
            return failureMResponse("2fa is already enabled");

        user.otp_secret = authenticator.generateSecret();

        const keyuri = authenticator.keyuri(user.username, "Transcendence", user.otp_secret);

        return this.userRepository.save(user)
                    .then(() => {return successMResponse({ secret: user.otp_secret, keyuri })})
                    .catch(() => {return failureMResponse("database error")});
    }

    async enable2fa(user: UserEntity) {
        if (user.otp_enabled)
            return failureMResponse("2fa is already enabled");
        user.otp_enabled = true;
        const token = authenticator.generate(user.otp_secret);
        console.debug('2fa-token :', token);
        return this.userRepository.save(user)
                    .then(() => {return successMResponse({token})})
                    .catch(() => {return failureMResponse("database error")});
    }

    disable2fa(user: UserEntity) {
        if (user.otp_secret === "")
            return failureMResponse("2fa already disabled");

        user.otp_secret = "";
        user.otp_enabled = false;

        return this.userRepository.save(user)
                    .then(() => {return successMResponse(true)})
                    .catch(() => {return failureMResponse("database error")});
    }

    verify2faToken(user: UserEntity, code: string) {
        return authenticator.verify({token: code, secret: user.otp_secret});
    }

}

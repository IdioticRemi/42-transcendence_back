import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MResponse } from 'src/MResponse';
import { Repository } from 'typeorm';
import { AddUserDto, SendUserDto } from './dto/user.dto';
import { BlockedEntity } from './entities/blocked.entity';
import { FriendEntity } from './entities/friend.entity';
import { UserEntity } from './entities/user.entity';
import * as fs from 'fs';
import { defaultAvatar } from 'lib';



@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(UserEntity)
		private usersRepository: Repository<UserEntity>,
		@InjectRepository(FriendEntity)
		private friendsRepository: Repository<FriendEntity>,
		@InjectRepository(BlockedEntity)
		private blockedRepository: Repository<BlockedEntity>
	) {}
	
	async getAllUsers(): Promise<UserEntity[]> {
		return this.usersRepository.find();
	}

	async findById(id: number): Promise<UserEntity> {
		const toFind : UserEntity = await this.usersRepository.findOne({
			where: {
			"id": id
			}
		});
		if (toFind === undefined)
			throw new NotFoundException(`the id:${id} does not exist`);
		return toFind;
	}

	async getUserById(id: number): Promise<UserEntity> {
		const userResult = await this.usersRepository.findOne({
			where: 
			{"id": id},
		});
		if (userResult === undefined)
			throw new NotFoundException(`the user of id=${id} does not exist`);
		return userResult;
	}

	async addUser(newUser: AddUserDto): Promise<MResponse<SendUserDto>> {
		return this.usersRepository.save(newUser)
			.then((user) => {
				return {
					status: 'success',
					payload: user,
				} as MResponse<SendUserDto>;
			}).catch(() => {
				// throw new HttpException(`Username already registered`, 400);
				return {
					status: 'error',
					message: `Username already registered`,
				};
		});
	}

	async softRemoveUser(id: number): Promise<UserEntity> {
		const toRemove : UserEntity = await this.findById(id);
		return this.usersRepository.softRemove(toRemove);
	}

	async getUserByUsername(user: string): Promise<UserEntity> {
		const userResult = await this.usersRepository.findOne({
			where: 
			{"username": user},
		});
		if (!userResult)
			throw new NotFoundException(`${user} is not registered`);
		return userResult;
	}

	async updateAvatar(user: string, path: string) {
		console.log("updating", user, path);
		// checks if previous uploaded avatar
		const userResult = await this.getUserByUsername(user);
		if (userResult.img_path !== defaultAvatar)
		{
			// delete previous avatar 
			try {
				fs.unlinkSync(userResult.img_path);
				//file removed
			} catch(err) {
				console.error(err);
			}
		}
		// register new avatar's path in DB
		await this.usersRepository.update({username: user}, {img_path: path})
	}

	async getFriends(): Promise<FriendEntity[]> {
		return await this.friendsRepository.find();
	}

	async getBlocked(): Promise<BlockedEntity[]> {
		return await this.blockedRepository.find();
	}

}
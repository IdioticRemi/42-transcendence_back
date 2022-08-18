import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MResponse } from 'src/MResponse';
import { Repository } from 'typeorm';
import { AddUserDto, SendUserDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';
import * as fs from 'fs';
import { defaultAvatar } from 'lib';
import { ChannelEntity } from 'src/channel/entities/channel.entity';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UsersService {
	constructor(
		@InjectRepository(UserEntity)
		private usersRepository: Repository<UserEntity>,

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

	async getUserById(id: number, relations: string[] = []): Promise<UserEntity> {
		const userResult = await this.usersRepository.find({
			where: 
			{"id": id},
			relations: relations
		});
		if (userResult === undefined)
			throw new NotFoundException(`the user of id=${id} does not exist`);
		return userResult[0];
	}

	async addUser(newUser: AddUserDto): Promise<MResponse<SendUserDto>> {
		return this.usersRepository.save(newUser)
			.then((user) => {
				return {
					status: 'success',
					payload: plainToClass(SendUserDto, user, {excludeExtraneousValues: true}),
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
		// checks if previous uploaded avatar and filename is different
		console.log(path);
		const userResult = await this.getUserByUsername(user);
		if (userResult.img_path !== defaultAvatar && userResult.img_path !== path)
		{
			console.log("deleting previous avatar");
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

	async getFriends(userid: number): Promise<SendUserDto[]> {
		const user = await this.usersRepository.findOne({
			where: {id: userid},
			relations: ['friends']
		});
		if (!user)
			return [];

		return user.friends.map((f) => plainToClass(SendUserDto, f, {excludeExtraneousValues: true}));
	}
	
	async getSubscribedChannels(userid: number): Promise<ChannelEntity[]> {
		const user = await this.usersRepository.findOne({
			where: {id: userid},
			relations: ['channels']
		});
		if (!user)
		return [];
		return user.channels;
	}
	
	async addFriend(userId: number, friendId: number): Promise<MResponse<SendUserDto>> {
		const user = await this.getUserById(userId, ['friends', 'blocked']);
		const friend = await this.getUserById(friendId, ['friends', 'blocked']);
		
		if (!user || !friend) {
			return {
				"status": "error",
				"message": "target or user does not exist",
			}
		}
		//check if already friends
		if (user.friends.find((f) => friend.id === f.id)) {
			return {
				"status": "error",
				"message": "target is already the user's friend",
			}
		}
		
		// check if friend has blocked the user
		if (friend.blocked.find((f) => user.id === f.id)) {
			return {
				"status": "error",
				"message": "user is blocked by target",
			}
		}
		// save copies
		const user_cpy = Object.assign({}, user) as UserEntity;
		const friend_cpy = Object.assign({}, friend) as UserEntity;
		
		// remove circular references
		delete user_cpy.friends;
		delete friend_cpy.friends;
		delete user_cpy.blocked;
		delete friend_cpy.blocked;
		
		// save to database
		user.friends.push(friend_cpy);
		friend.friends.push(user_cpy);
		
		await this.usersRepository.save(user);
		await this.usersRepository.save(friend);
		
		delete user.token;
		
		return {
			"status": "success",
			"payload": plainToClass(SendUserDto, user, {excludeExtraneousValues: true})
		}
	}
	
	async deleteFriend(userId: number, friendId: number): Promise<MResponse<SendUserDto>> {
		const user = await this.getUserById(userId, ['friends']);
		const friend = await this.getUserById(friendId, ['friends']);
		
		// check if user and friend are in the database
		if (!user || !friend) {
			return {
				"status": "error",
				"message": "target or user does not exist",
			}
		}
		
		const target = user.friends.find((f) => friend.id === f.id);
		//check if really friends
		if (!target) {
			return {
				"status": "error",
				"message": "target is not the user's friend",
			}
		}
		
		// user side friend removal
		user.friends = user.friends.filter(f => f.id != friend.id);
		await this.usersRepository.save(user);
		
		// friend side friend removal
		friend.friends = friend.friends.filter(f => f.id != user.id);
		await this.usersRepository.save(friend);
		
		
		return {
			"status": "success",
			"payload": plainToClass(SendUserDto, user, {excludeExtraneousValues: true}),
		}
	}

	async getBlocked(userid: number): Promise<SendUserDto[]> {
		const user = await this.usersRepository.findOne({
			where: {id: userid},
			relations: ['blocked']
		});
		if (!user)
			return [];
		return user.blocked.map((b) => plainToClass(SendUserDto, b, {excludeExtraneousValues: true}));
	}

	async addBlocked(userId: number, blockedId: number): Promise<MResponse<SendUserDto>> {
		const user = await this.getUserById(userId, ['friends', 'blocked']);
		const toBlock = await this.getUserById(blockedId);
		
		if (!user || !toBlock) {
			return {
				"status": "error",
				"message": "target or user does not exist",
			}
		}
		//check if already blocked
		if (user.blocked.find((b) => toBlock.id === b.id)) {
			return {
				"status": "error",
				"message": "target is already blocked by user",
			}
		}
		
		// check if user is friend with the target and remove friendship if necessary 
		if (user.friends.find((f) => toBlock.id === f.id)) {
			console.debug("removing friendship");
			await this.deleteFriend(user.id, toBlock.id);
			delete user.friends;
		}
		
		// save to database
		user.blocked.push(toBlock);

		
		return await this.usersRepository.save(user)
			.then(() => {
				return {
					"status": "success",
					"payload": plainToClass(SendUserDto, user, {excludeExtraneousValues: true})
				} as MResponse<SendUserDto>;
			})
			.catch( () => {
				return {
					"status": "error",
					"message": "cannot register change in the database"
				}
			});
	}

		
	async deleteBlocked(userId: number, blockedId: number): Promise<MResponse<SendUserDto>> {
		
		// check if user is in the database and retrieve blocked relation
		const user = await this.getUserById(userId, ['blocked']);
		if (!user) {
			return {
				"status": "error",
				"message": "user does not exist",
			}
		}
		
		//check if really blocked
		const target = user.blocked.find((b) => blockedId === b.id);
		if (!target) {
			return {
				"status": "error",
				"message": "target is not blocked by the user",
			}
		}
		
		// remove block and register change in database
		user.blocked = user.blocked.filter(b => b.id != target.id);
		return this.usersRepository.save(user)
			.then( () => {
				return {
					"status": "success",
					"payload": plainToClass(SendUserDto, user, {excludeExtraneousValues: true}),
				} as MResponse<SendUserDto>;
			}) 
			.catch( () => {
				return {
					"status": "error",
					"message": "cannot register change in the database"
				};
			});
		
	}
	
}
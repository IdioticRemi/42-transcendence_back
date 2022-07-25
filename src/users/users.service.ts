import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddUserDto } from './dto/user.dto';
import { BlockedEntity } from './entities/blocked.entity';
import { FriendEntity } from './entities/friend.entity';
import { UserEntity } from './entities/user.entity';

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

	async addUser(newUser: AddUserDto): Promise<UserEntity> {
		const addedUser = await this.usersRepository.save(newUser).catch(() => {
			throw new HttpException("Username already registered", 400);
		});
		return addedUser;
	}

	async softRemoveUser(id: number): Promise<UserEntity> {
		const toRemove : UserEntity = await this.findById(id);
		return this.usersRepository.softRemove(toRemove);
	}

	async getFriends(): Promise<FriendEntity[]> {
		return await this.friendsRepository.find();
	}

	async getBlocked(): Promise<BlockedEntity[]> {
		return await this.blockedRepository.find();
	}

}
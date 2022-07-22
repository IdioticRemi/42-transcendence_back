import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AddUserDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
	constructor(
		private usersService: UsersService
	) {}

	@Get()
	getAllUsers() : Promise<UserEntity[]> {
		return this.usersService.getAllUsers();
	}

	@Get(':id')
	getUserById(
		@Param('id', ParseIntPipe) id: number
	) : Promise<UserEntity> {
		return this.usersService.getUserById(id);
	}
	
	@Post('register')
	addUser(
		@Body() newuserdto: AddUserDto
		) : Promise<UserEntity> {
			return this.usersService.addUser(newuserdto);
		}
		
	@Delete(':id')
	softRemoveUser(
		@Param('id', ParseIntPipe) id: number
		) {
			return this.usersService.softRemoveUser(id);
		}
	}
	
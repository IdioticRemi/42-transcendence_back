import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UploadedFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExpressAdapter, FileInterceptor } from '@nestjs/platform-express';
import { MResponse } from 'src/MResponse';
import { AddUserDto, SendUserDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';
import { Express } from 'express';

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
		) : Promise<MResponse<SendUserDto>> {
			return this.usersService.addUser(newuserdto);
		}
		
	@Delete(':id')
	softRemoveUser(
		@Param('id', ParseIntPipe) id: number
		) {
			return this.usersService.softRemoveUser(id);
		}
	}

	// @Post('upload')
	// @UseInterceptors(FileInterceptor('file'))
	// uploadFile(
	// 	@UploadedFile() file: Express.Multer.File
	// 	) {
	// 	console.log(file);
	// }
	
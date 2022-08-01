import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MResponse } from 'src/MResponse';
import { AddUserDto, SendUserDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';
import { Express } from 'express';
import { diskStorage, Multer } from 'multer';
import { extname } from 'path';

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
		
	// the interceptor work on the 'file' field of the request
	@Post('upload/:user')
	@UseInterceptors(FileInterceptor('file', {
		storage: diskStorage({
			destination: './uploads',
			filename:  function (req, file, cb) { 
				cb(null, req.params.user + extname(file.originalname));
			  }
			})
		}))
	uploadFile(
		@UploadedFile() file: Express.Multer.File,
		@Param('user') user: string
		): void {
	console.log(user, file);
	console.log(file.mimetype);
	this.usersService.updateAvatar(user, file.path);
	}
}
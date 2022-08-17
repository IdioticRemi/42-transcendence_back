import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Res, StreamableFile, UnsupportedMediaTypeException, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MResponse } from 'src/MResponse';
import { AddUserDto, SendUserDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';
import { Express, Response } from 'express';
import { diskStorage, Multer } from 'multer';
import { extname, join } from 'path';
import { maxUploadSize } from 'lib';
import { ChannelEntity } from 'src/channel/entities/channel.entity';
import { plainToClass } from 'class-transformer';

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
	// returns 415 error if file type is wrong and 413 if file too large
	@Post('avatar/:user')
	@UseInterceptors(FileInterceptor('file', {
		storage: diskStorage({
			destination: './uploads',
			filename:  function (req, file, cb) { 
				cb(null, req.params.user + extname(file.originalname).toLowerCase());
			  }
			}),
		limits: { fileSize: maxUploadSize },
		fileFilter: function fileFilter(req, file, cb){
			if(file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg' && file.mimetype !== 'image/jpeg') {
				return cb(new UnsupportedMediaTypeException('Only jpg/jpeg or png files are accepted'), false);
			 }
			 cb(null, true);
		 },
		}))
	uploadFile(
		@UploadedFile() file: Express.Multer.File,
		@Param('user') user: string,
		): void {
		console.log(user, file);
		console.log(file.mimetype);
		this.usersService.updateAvatar(user, file.path);
	}

	@Get('avatar/:user')
	async getFile(
		@Param('user') user: string,
		@Res() res: Response
	): Promise<void> {
		const userResult = await this.usersService.getUserByUsername(user);
		res.sendFile(userResult.img_path, {root: './'});
	}

	// readStream version
	// @Get('avatar/:user')
	// async getFileStream(
	// 	@Param('user') user: string,
	// 	@Res() res
	// ): Promise<void> {
	// 	const userResult = await this.usersService.getUserByUsername(user);
	// 	const fileType = extname(userResult.img_path);
	// 	const file = createReadStream(join(process.cwd(), userResult.img_path))
	// 	res.set({
	// 		'Content-Type': 'image/' + fileType.substring(1)
	// 	});
	// 	file.pipe(res);
	// }

	//TODO : test with postman
	@Get(':userid/channels')
	async GetSubscribedChannels(
		@Param('userid', ParseIntPipe) userid: number
	): Promise<ChannelEntity[]> {
		return this.usersService.getSubscribedChannels(userid);
	}

	//TODO : test with postman
	@Get(':userid/friends')
	async GetFriends(
		@Param('userid', ParseIntPipe) userid: number
	): Promise<SendUserDto[]> {
		return this.usersService.getFriends(userid);
	}

	@Post(':userid/friends')
	async AddFriend(
		@Param('userid', ParseIntPipe) userId: number,
		@Body('friendId') friendId: string
	) : Promise<MResponse<SendUserDto>> {
		return this.usersService.addFriend(userId, parseInt(friendId));
	}

	@Delete(':userid/friends')
	async deleteFriend(
		@Param('userid', ParseIntPipe) userId: number,
		@Body('friendId') friendId: string
	) : Promise<MResponse<SendUserDto>> {
		return this.usersService.deleteFriend(userId, parseInt(friendId));
	}

	//TODO : test with postman
	@Get(':userid/blocked')
	async GetBlocked(
		@Param('userid', ParseIntPipe) userid: number
	): Promise<SendUserDto[]> {
		return (await this.usersService.getBlocked(userid)).map(b => plainToClass(SendUserDto, b, {excludeExtraneousValues: true}));
	}

}
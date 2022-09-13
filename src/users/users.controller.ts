import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    ParseIntPipe,
    Post,
    Req,
    Res,
    UnsupportedMediaTypeException,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {failureMResponse, MResponse, successMResponse} from 'lib/MResponse';
import {SendUserDto} from './dto/user.dto';
import {UserEntity} from './entities/user.entity';
import {UsersService} from './users.service';
import {Express, Response} from 'express';
import {diskStorage} from 'multer';
import {extname} from 'path';
import {defaultAvatar, maxUploadSize} from 'lib';
import {plainToClass} from 'class-transformer';
import {UserTokenGuard} from 'src/auth/auth.guard';
import { GameEntity } from 'src/game/entities/game.entity';
import { GameEntityDto } from 'src/game/dto/game.dto';

@Controller('users')
export class UsersController {
    constructor(
        private usersService: UsersService
    ) {
    }

    @UseGuards(UserTokenGuard)
    @Get()
    getAllUsers(): Promise<UserEntity[]> {
        return this.usersService.getAllUsers();
    }

    @UseGuards(UserTokenGuard)
    @Get(':id')
    async getUserById(
        @Param('id', ParseIntPipe) id: number
    ): Promise<MResponse<SendUserDto>> {
        const user = await this.usersService.getUserById(id);

        if (!user)
            return failureMResponse("user does not exist.");
        return successMResponse(plainToClass(SendUserDto, user, {excludeExtraneousValues: true}));
    }

    
    @UseGuards(UserTokenGuard)
    @Post('avatar/me')
    @UseInterceptors(FileInterceptor('file', {
        storage: diskStorage({
            destination: './uploads',
            filename: function (req, file, cb) {
                cb(null, req.user.username + extname(file.originalname).toLowerCase() + '.tmp');
            }
        }),
        limits: {fileSize: maxUploadSize},
        fileFilter: function fileFilter(req, file, cb) {
            if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg' && file.mimetype !== 'image/jpeg') {
                return cb(new UnsupportedMediaTypeException('Only jpg/jpeg or png files are accepted'), false);
            }
            cb(null, true);
        },
    }))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Req() req
    ): Promise<MResponse<boolean>> {
        if (!req.file)
            return failureMResponse("could not find file in body");

        return await this.usersService.updateAvatar(req.user.username, file.path);;
    }

    @Get('avatar/:user/*')
    @Header('Cache-Control', 'none')
    async getFile(
        @Param('user', ParseIntPipe) user: number,
        @Res() res: Response
    ): Promise<void> {
        const userResult = await this.usersService.getUserById(user);

        if (!userResult) {
            res.sendFile(defaultAvatar, {root: './'});
            return;
        }
        res.sendFile(userResult.img_path, {root: './'});
    }

    @UseGuards(UserTokenGuard)
    @Get(':userid/friends')
    async GetFriends(
        @Param('userid', ParseIntPipe) userid: number
    ): Promise<MResponse<SendUserDto[]>> {
        const friends = await this.usersService.getFriends(userid);

        if (friends)
            return successMResponse(friends);
        return failureMResponse("failed to fetch friends");
    }

    @UseGuards(UserTokenGuard)
    @Post(':userid/friends')
    async AddFriend(
        @Param('userid', ParseIntPipe) userId: number,
        @Body('friendId', ParseIntPipe) friendId: number
    ): Promise<MResponse<SendUserDto>> {
        return this.usersService.addFriend(userId, friendId);
    }

    @UseGuards(UserTokenGuard)
    @Delete(':userid/friends')
    async deleteFriend(
        @Param('userid', ParseIntPipe) userId: number,
        @Body('friendId', ParseIntPipe) friendId: number
    ): Promise<MResponse<SendUserDto>> {
        return this.usersService.deleteFriend(userId, friendId);
    }

    @UseGuards(UserTokenGuard)
    @Get(':userid/blocked')
    async GetBlocked(
        @Param('userid', ParseIntPipe) userid: number
    ): Promise<MResponse<SendUserDto[]>> {
        return this.usersService.getBlocked(userid);
    }

    @UseGuards(UserTokenGuard)
    @Post(':userid/blocked')
    async AddBlocked(
        @Param('userid', ParseIntPipe) userId: number,
        @Body('blockedId') blockedId: string
    ): Promise<MResponse<SendUserDto>> {
        return this.usersService.addBlocked(userId, parseInt(blockedId));
    }

    @UseGuards(UserTokenGuard)
    @Delete(':userid/blocked')
    async deleteBlocked(
        @Param('userid', ParseIntPipe) userId: number,
        @Body('blockedId') blockedId: string
    ): Promise<MResponse<SendUserDto>> {
        return this.usersService.deleteBlocked(userId, parseInt(blockedId));
    }

    @UseGuards(UserTokenGuard)
    @Get(':userid/games')
    async getUserGames(
        @Param('userid', ParseIntPipe) userId: number
    ): Promise<MResponse<GameEntityDto[]>> {
        return await this.usersService.getUserGames(userId);
    }

    @Get('leaderboard')
    async getLeaderboard() {
        return await this.usersService.getLeaderboard();
    }
    

}
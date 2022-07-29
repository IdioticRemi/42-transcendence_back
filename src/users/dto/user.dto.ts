import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";
import { Unique } from "typeorm";

export class AddUserDto {
	@IsNotEmpty()
	@IsString()
	username: string;

	@IsNotEmpty()
	@IsString()
	token: string;

}

export class SendUserDto {
	username: string;
}

export class GetUserDto {
	id: string;
	login: string;
}
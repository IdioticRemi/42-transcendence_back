import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";
import { Unique } from "typeorm";

export class AddUserDto {
	@IsNotEmpty()
	@IsString()
	name: string;

}
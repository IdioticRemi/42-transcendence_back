import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsString, Max, Min } from "class-validator";

export class AddUserDto {
	@IsNotEmpty()
	@IsString()
	nickname: string;

	@IsNotEmpty()
	@IsString()
	firstname: string;

	@IsNotEmpty()
	@IsString()
	lastname: string;

	@IsNotEmpty()
	@Type( () => Number )
	@IsNumber()
	@Min(1)
	@Max(99)
	age: number;
}
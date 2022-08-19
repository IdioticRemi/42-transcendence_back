import {Expose} from "class-transformer";
import {IsDate, IsNotEmpty, IsNumber, IsOptional, IsString} from "class-validator";

export class AddUserDto {

    @IsNotEmpty()
    @IsString()
    username: string;

    @IsNotEmpty()
    @IsString()
    token: string;
}

export class SendUserDto {

    @Expose()
    @IsNotEmpty()
    @IsNumber()
    id: number;

    @Expose()
    @IsNotEmpty()
    @IsString()
    username: string;

    @Expose()
    @IsOptional()
    @IsString()
    nickname: string;

    @Expose()
    @IsDate()
    @IsNotEmpty()
    createdAt: string;

    @Expose()
    @IsDate()
    @IsOptional()
    updatedAt: string;

    @Expose()
    @IsDate()
    @IsOptional()
    deletedAt: string;
}

export class GetUserDto {
    id: string;
    login: string;
}
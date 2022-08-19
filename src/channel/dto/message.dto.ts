import {IsNotEmpty, IsNumber, IsOptional, IsString} from "class-validator";
import {ChannelEntity} from "../entities/channel.entity";

export class AddMessageEntityDto {

    @IsNotEmpty()
    @IsNumber()
    userId: number;

    @IsNotEmpty()
    @IsString()
    content: string;

    @IsOptional()
    channelId: number;

}
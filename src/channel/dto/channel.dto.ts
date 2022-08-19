import {Expose} from "class-transformer";
import {UserEntity} from "src/users/entities/user.entity";
import {MessageEntity} from "../entities/message.entity";

export class ChannelDto {

    @Expose()
    id: number;

    @Expose()
    name: string;

    @Expose()
    ownerId: number;

    @Expose()
    isPrivate: boolean;

    @Expose()
    users: UserEntity[];

    @Expose()
    messages: MessageEntity[];

}
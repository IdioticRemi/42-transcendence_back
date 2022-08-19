import {Expose} from "class-transformer";
import {UserEntity} from "src/users/entities/user.entity";
import {MessageEntity} from "../entities/message.entity";
import {BannedEntity} from "../entities/banned.entity";

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
    admins: UserEntity[];

    @Expose()
    banned: BannedEntity[];

    @Expose()
    messages: MessageEntity[];

}
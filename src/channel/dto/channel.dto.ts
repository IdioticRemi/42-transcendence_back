import {Expose} from "class-transformer";
import {UserEntity} from "src/users/entities/user.entity";
import {MessageEntity} from "../entities/message.entity";
import {SanctionEntity} from "../entities/sanction.entity";

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
    sanctions: SanctionEntity[];

    @Expose()
    messages: MessageEntity[];

}
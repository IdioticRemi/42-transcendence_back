import {Expose, Type} from "class-transformer";
import { ValidateNested } from "class-validator";
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

    @Type(() => UserEntity)
    @Expose()
    users: UserEntity[];

    @Type(() => UserEntity)
    @Expose()
    admins: UserEntity[];

    @Type(() => SanctionEntity)
    @Expose()
    sanctions: SanctionEntity[];

    @Type(() => MessageEntity)
    @Expose()
    messages: MessageEntity[];

}
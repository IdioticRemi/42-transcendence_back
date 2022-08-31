import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {BannedEntity} from "./banned.entity";
import {MessageEntity} from "./message.entity";

@Entity('ChannelEntity')
export class ChannelEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        unique: true
    })
    name: string;

    @Column()
    ownerId: number;

    @Column({
        default: false
    })
    isPrivate: boolean;

    @Column({
        default: ""
    })
    password: string;
    
    @JoinTable()
    @ManyToMany(() => UserEntity, (user) => user.channels)
    users: UserEntity[];
    
    @JoinTable()
    @ManyToMany(() => UserEntity)
    admins: UserEntity[];

    @JoinTable()
    @ManyToMany(() => BannedEntity, {cascade: true})
    banned: BannedEntity[]

    @OneToMany(() => MessageEntity, message => message.channel, {cascade: true})
    messages: MessageEntity[];

}
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

    // // @JoinColumn()
    // @ManyToOne( () => UserEntity )
    // owner: UserEntity;

    // TODO: A voir avec Remi
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
    @ManyToMany(() => BannedEntity, {cascade: true})
    banned: BannedEntity[]

    // TODO: cascade ?
    @JoinTable()
    @ManyToMany(() => UserEntity, (user) => user.channels)
    users: UserEntity[];

    @JoinTable()
    @ManyToMany(() => UserEntity)
    admins: UserEntity[];

    @OneToMany(() => MessageEntity, message => message.channel, {cascade: true})
    messages: MessageEntity[];

}
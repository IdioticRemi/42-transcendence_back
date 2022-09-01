import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn} from "typeorm";
import {SanctionEntity} from "./sanction.entity";
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
    @ManyToMany(() => SanctionEntity, {cascade: true})
    sanctions: SanctionEntity[]

    @OneToMany(() => MessageEntity, message => message.channel, {cascade: true})
    messages: MessageEntity[];

}
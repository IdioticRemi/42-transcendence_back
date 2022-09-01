import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {ChannelEntity} from "./channel.entity";

export enum SanctionType {
    MUTE = 'mute',
    BAN = 'ban'
}

@Entity('SanctionEntity')
export class SanctionEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;
    
    @Column()
    type: string;

    @ManyToMany(() => ChannelEntity, channel => channel.sanctions)
    channel: ChannelEntity;

    @Column()
    end: Date;
}
import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
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

    @ManyToOne(() => ChannelEntity, channel => channel.sanctions, {onDelete: 'CASCADE', onUpdate: 'CASCADE'})
    channel: ChannelEntity;

    @Column()
    end: Date;
}
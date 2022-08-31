import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, ManyToMany, PrimaryGeneratedColumn} from "typeorm";
import {ChannelEntity} from "./channel.entity";

@Entity('BannedEntity')
export class BannedEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @ManyToMany(() => ChannelEntity, channel => channel.banned)
    channel: ChannelEntity;

    @Column()
    end: Date;
}
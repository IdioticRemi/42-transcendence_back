import { Expose } from "class-transformer";
import {Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {ChannelEntity} from "./channel.entity";

@Entity('MessageEntity')
export class MessageEntity {

    @Expose()
    @PrimaryGeneratedColumn()
    id: number;

    @Expose()
    @ManyToOne(() => ChannelEntity, channel => channel.messages, {onDelete: 'CASCADE'})
    channel: ChannelEntity;

    @Expose()
    @Column()
    userId: number;

    @Expose()
    @Column()
    userNick: string;

    @Expose()
    @Column()
    content: string;

    @Expose()
    @CreateDateColumn()
    createdAt: Date;
}
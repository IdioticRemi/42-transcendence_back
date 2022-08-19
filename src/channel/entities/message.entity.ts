import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {ChannelEntity} from "./channel.entity";

@Entity('MessageEntity')
export class MessageEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => ChannelEntity, channel => channel.messages, {onDelete: 'CASCADE'})
    channel: ChannelEntity;

    @Column()
    userId: number;

    @Column()
    content: string;

}
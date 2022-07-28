import { ChannelEntity } from "src/channel/entities/channel.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable, ManyToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('UserEntity')
export class UserEntity {

	@PrimaryColumn()
	id: number;

	@Column({
		default: ""
	})
	token: string;

	@Column({
		default: "img/default_avatar.jpeg"
	})
	avatar: string;

	@Column({
		length: 16,
		unique: true
	})
	username: string;

	@JoinTable()
	@ManyToMany( () => ChannelEntity )
	channels: ChannelEntity[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}
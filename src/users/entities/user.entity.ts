import { ChannelEntity } from "src/channel/entities/channel.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable, ManyToMany, OneToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity('UserEntity')
export class UserEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	token: string;

	@Column({
		default: "img/default_avatar.jpeg"
	})
	avatar: string;

	@Column({
		length: 16,
		unique: true
	})
	name: string;

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
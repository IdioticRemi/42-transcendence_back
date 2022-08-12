import { ChannelEntity } from "src/channel/entities/channel.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinTable, ManyToMany, OneToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('UserEntity')
export class UserEntity {

	@PrimaryColumn()
	id: number;

	@Column({
		default: ""
	})
	token: string;

	@Column({
		default: "img/default_avatar.jpg"
	})
	img_path: string;

	@Column({
		length: 16,
		unique: true
	})
	username: string;

	@Column({
		default: "",
		length: 16,
	})
	nickname: string;

	@JoinTable()
	@ManyToMany( () => ChannelEntity, (channel) => channel.users )
	channels: ChannelEntity[];

	@JoinTable()
	@ManyToMany( () => ChannelEntity, (channel) => channel.operators )
	channels_op: ChannelEntity[];

	@JoinTable({ joinColumn: {name: 'UserEntity_id_1'}})
	@ManyToMany( () => UserEntity)
	friends: UserEntity[]

	@JoinTable({ joinColumn: {name: 'UserEntity_id_1'}})
	@ManyToMany( () => UserEntity)
	blocked: UserEntity[]

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}
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
		type: 'bytea',
		default: ""
	})
	img: Uint8Array;

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
	@ManyToMany( () => ChannelEntity )
	channels: ChannelEntity[];

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}
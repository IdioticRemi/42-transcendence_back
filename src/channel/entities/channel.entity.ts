import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BannedEntity } from "./banned.entity";
import { MessageEntity } from "./message.entity";

@Entity('ChannelEntity')
export class ChannelEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({
		unique: true
	})
	name: string;

	// // @JoinColumn()
	// @ManyToOne( () => UserEntity )
	// owner: UserEntity;

	// TODO: A voir avec Remi
	@Column()
	owner: number;

	@Column({
		default: false
	})
	isPrivate: boolean;

	@Column({
		default: ""
	})
	password: string;

	@JoinTable()
	@ManyToMany( () => BannedEntity )
	banned: BannedEntity[]

	// TODO: cascade ?
	@JoinColumn()
	@ManyToMany( () => UserEntity, (user) => user.channels)
	users: UserEntity[];

	@JoinColumn()
	@ManyToMany( () => UserEntity )
	admins: UserEntity[];

	@OneToMany( () => MessageEntity, message => message.channel)
	messages: MessageEntity[];

}
import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { BannedEntity } from "./banned.entity";

@Entity('ChannelEntity')
export class ChannelEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({
		unique: true
	})
	name: string;

	@Column()
	owner: string;

	@Column({
		default: false
	})
	isPrivate: boolean;

	@Column({
		default: ""
	})
	password: string;

	@JoinTable()
	@ManyToMany( () => BannedEntity, banned => banned.channel )
	banned: BannedEntity[]

	@JoinColumn()
	@ManyToMany( () => UserEntity, (user) => user.channels)
	users: UserEntity[];

	@JoinColumn()
	@ManyToMany( () => UserEntity )
	admins: UserEntity[];


}
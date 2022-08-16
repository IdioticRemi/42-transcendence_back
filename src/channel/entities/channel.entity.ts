import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, JoinColumn, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";

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
	@ManyToMany( () => UserEntity )
	banned: UserEntity[]

	@JoinColumn()
	@ManyToMany( () => UserEntity, (user) => user.channels)
	users: UserEntity[];

	@JoinColumn()
	@ManyToMany( () => UserEntity, (user) => user.channels_op )
	admins: UserEntity[];


}
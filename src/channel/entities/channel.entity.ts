import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, JoinColumn, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity('ChannelEntity')
export class ChannelEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@JoinColumn()
	@ManyToMany( () => UserEntity, (user) => user.channels)
	users: UserEntity[];

	@JoinColumn()
	@ManyToMany( () => UserEntity, (user) => user.channels_op )
	operators: UserEntity[];

}
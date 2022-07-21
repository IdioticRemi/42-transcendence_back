import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, ManyToMany, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity('ChannelEntity')
export class ChannelEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	// @Column({
	// 	array: true })
	// @ManyToMany( () => UserEntity, (user) => user.id)
	// users: UserEntity[];

	// @Column({ array: true })
	// @ManyToMany( () => UserEntity, (user) => user.id )
	// operators: UserEntity[];

}
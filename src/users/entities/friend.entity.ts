import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity('FriendEntity')
export class FriendEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@JoinColumn()
	@OneToOne( () => UserEntity, (user) => user.id )
	userId: UserEntity;

	@JoinColumn()
	@OneToOne( () => UserEntity, (user) => user.id )
	friendId: UserEntity;

}
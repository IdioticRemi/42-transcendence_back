import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity('BlockedEntity')
export class BlockedEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@JoinColumn()
	@OneToOne( (type) => UserEntity, (user) => user.id )
	userId: UserEntity;

	@JoinColumn()
	@OneToOne( (type) => UserEntity, (blocked) => blocked.id )
	blockedId: UserEntity;

}
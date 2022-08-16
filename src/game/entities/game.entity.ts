import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";

export enum GameStatus {
	PENDING = 0,
	RUNNING = 1,
	FINISHED = 2,
}

@Entity('GameEntity')
export class GameEntity {
	
	@PrimaryGeneratedColumn()
	id: number;

	@ManyToOne( () => UserEntity, user => user.games)
	player: UserEntity;

	@OneToOne( () => GameEntity, game => game.opponent)
	opponent: GameEntity;

	@Column({
		default: 0
	})
	score: number;

	@Column({
		default: GameStatus.PENDING
	})
	status: number;

}
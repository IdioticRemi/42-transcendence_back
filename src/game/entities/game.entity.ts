import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, JoinColumn, ManyToMany, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";

export enum GameStatus {
	PENDING = 0,
	RUNNING = 1,
	FINISHED = 2,
}

export enum GameType {
	CLASSIC = 0,
	CUSTOM = 1,
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
		default: GameType.CLASSIC
	})
	type: number;

	@Column({
		default: GameStatus.PENDING
	})
	status: number;

}
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('GameEntity')
export class GameEntity {
	
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	firstPlayerId: number;

	@Column()
	secondPlayerId: number;

	@Column({
		default: 0
	})
	firstPlayerScore: number;

	@Column({
		default: 0
	})
	secondPlayerScore: number;

	@Column({
		default: 'in progress'
	})
	status: string;
}
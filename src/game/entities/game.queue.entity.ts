import { UserEntity } from "src/users/entities/user.entity";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { GameType } from "./game.entity";

@Entity('GameQueueEntity')
export class GameQueueEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	user: UserEntity;

	@Column({
		default: GameType.CLASSIC
	})
	type: number;

}
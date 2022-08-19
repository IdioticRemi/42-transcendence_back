import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {GameType} from "./game.entity";

@Entity('GameQueueEntity')
export class GameQueueEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column({
        default: null,
    })
    targetId: number;

    @Column({
        default: GameType.CLASSIC
    })
    type: number;

}
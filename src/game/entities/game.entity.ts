import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn} from "typeorm";


export type Game = {
    p1Score: number;
    p2Score: number;
    ballX: number;
    ballY: number;
    ballSpeed: number;
    ballVelocityX: number;
    ballVelocityY: number;
    padLeftX: number;
    padLeftY: number;
    padLeftVelocity: number;
    padRightX: number;
    padRightY: number;
    padRightVelocity: number;
}

export enum GameStatus {
    PENDING = 0,
    RUNNING = 1,
    FINISHED = 2,
}

export enum GameType {
    CLASSIC = 'classic',
    CUSTOM = 'custom',
}

@Entity('GameEntity')
export class GameEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => UserEntity, user => user.games)
    player: UserEntity;

    @ManyToOne(() => UserEntity)
    opponent: UserEntity;
    
    @Column({
        default: 0
    })
    score: number;

    @Column({
        default: GameType.CLASSIC
    })
    type: string;

    @Column({
        default: GameStatus.PENDING
    })
    status: number;

}
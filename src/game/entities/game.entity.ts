import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";

export type Ball = {
    x: number;
    y: number;
    speed: number;
    velocityX: number;
    velocityY: number;
    span: number;
}

export type Pad = {
    x: number;
    y: number;
    height: number;
    width: number;
    speed: number;
    move: number;
}

export type Game = {
    interval;
    p1Score: number;
    p2Score: number;
    ball: Ball;
    padLeft: Pad;
    padRight: Pad;
}

export enum GameStatus {
    PENDING = 0,
    RUNNING = 1,
    FINISHED = 2,
}

export enum PadMove {
    UP = -1,
    STATIC,
    DOWN,
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
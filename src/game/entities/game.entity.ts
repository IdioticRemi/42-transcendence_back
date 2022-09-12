import { Expose, Type } from "class-transformer";
import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

export enum GameType {
    CLASSIC = 'classic',
    CUSTOM = 'custom',
}

@Entity('GameEntity')
export class GameEntity {

    @Expose()
    @PrimaryGeneratedColumn()
    id: number;

    @Expose()
    @Type(() => UserEntity)
    @ManyToOne(() => UserEntity, user => user.games)
    player: UserEntity;

    @Expose()
    @Type(() => UserEntity)
    @ManyToOne(() => UserEntity)
    opponent: UserEntity;
    
    @Expose()
    @Column({
        default: 0
    })
    playerScore: number;
    
    @Expose()
    @Column({
        default: 0
    })
    opponentScore: number;

    @Expose()
    @Column({
        default: GameType.CLASSIC
    })
    type: string;

    @Column()
    @UpdateDateColumn({type: 'timestamptz'})
    endedAt: Date;


}
import {UserEntity} from "src/users/entities/user.entity";
import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";

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

}
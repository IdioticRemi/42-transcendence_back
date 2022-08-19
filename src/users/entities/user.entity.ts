import {ChannelEntity} from "src/channel/entities/channel.entity";
import {GameEntity} from "src/game/entities/game.entity";
import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    OneToMany,
    PrimaryColumn,
    UpdateDateColumn
} from "typeorm";

export enum UserStatus {
    OFFLINE = 0,
    ONLINE = 1,
    INGAME = 2,
}

@Entity('UserEntity')
export class UserEntity {

    @PrimaryColumn()
    id: number;

    @Column({
        default: ""
    })
    token: string;

    @Column({
        default: "img/default_avatar.jpg"
    })
    img_path: string;

    @Column({
        length: 16,
        unique: true
    })
    username: string;

    @Column({
        default: "",
        length: 16,
    })
    nickname: string;

    @Column({
        default: UserStatus.OFFLINE
    })
    status: number;

    @ManyToMany(() => ChannelEntity, (channel) => channel.users)
    channels: ChannelEntity[];

    @JoinTable({joinColumn: {name: 'UserEntity_id_1'}})
    @ManyToMany(() => UserEntity, {cascade: true})
    friends: UserEntity[]

    @JoinTable({joinColumn: {name: 'UserEntity_id_1'}})
    @ManyToMany(() => UserEntity, {cascade: true})
    blocked: UserEntity[]

    @JoinTable()
    @OneToMany(() => GameEntity, game => game.player)
    games: GameEntity[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;

}
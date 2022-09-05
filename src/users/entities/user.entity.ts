import { Exclude, Expose, Type } from "class-transformer";
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

@Entity('UserEntity')
export class UserEntity {

    @Expose()
    @PrimaryColumn()
    id: number;

    @Exclude()
    @Column({
        default: ""
    })
    token: string;

    @Column({
        default: "img/default_avatar.jpg"
    })
    img_path: string;

    @Expose()
    @Column({
        length: 16,
        unique: true
    })
    username: string;

    @Expose()
    @Column({
        length: 16,
        unique: true,
    })
    nickname: string;

    @Type(() => ChannelEntity)
    @ManyToMany(() => ChannelEntity, (channel) => channel.users)
    channels: ChannelEntity[];

    @Type(() => UserEntity)
    @JoinTable({joinColumn: {name: 'UserEntity_id_1'}})
    @ManyToMany(() => UserEntity, {cascade: true})
    friends: UserEntity[]

    @Type(() => UserEntity)
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
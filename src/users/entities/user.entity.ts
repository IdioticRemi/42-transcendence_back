import { Exclude, Expose, Type } from "class-transformer";
import { defaultAvatar } from "lib";
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

    @Expose()
    @Column({
        default: false
    })
    otp_enabled: boolean;

    @Exclude()
    @Column({
        default: ""
    })
    otp_secret: string;

    @Exclude()
    @Column({
        default: ""
    })
    otp_token: string;

    @Column({
        default: defaultAvatar
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
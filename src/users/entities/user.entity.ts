import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";

@Entity('UserEntity')
export class UserEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	token: string;

	@Column({
		default: "img/default_avatar.jpeg"
	})
	avatar: string;

	@Column({
		length: 16,
		unique: true
	})
	name: string;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}
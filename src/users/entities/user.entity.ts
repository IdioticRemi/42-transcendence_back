import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('UserEntity')
export class UserEntity {

	@PrimaryGeneratedColumn()
	id: number;

	@Column({
		length: 15
	})
	nickname: string;

	@Column({
		length: 15
	})
	firstname: string;

	@Column({
		length: 20
	})
	lastname: string;

	@Column()
	age: number;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;

	@DeleteDateColumn()
	deletedAt: Date;

}
import {Module} from '@nestjs/common';
import {GameService} from './game.service';
import {GameController} from './game.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {GameEntity} from './entities/game.entity';
import { UsersModule } from 'src/users/users.module';

@Module({
    imports: [TypeOrmModule.forFeature([GameEntity])],
    providers: [GameService],
    controllers: [GameController]
})
export class GameModule {

}

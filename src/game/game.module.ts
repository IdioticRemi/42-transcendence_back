import {Module} from '@nestjs/common';
import {GameService} from './game.service';
import {GameController} from './game.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {GameEntity} from './entities/game.entity';
import { SocketModule } from 'src/socket/socket.module';
import { SocketService } from 'src/socket/socket.service';


@Module({
    imports: [TypeOrmModule.forFeature([GameEntity]), SocketModule],
    providers: [GameService],
    controllers: [GameController],
    exports: [GameService]
})
export class GameModule {

}

import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {GameEntity} from './entities/game.entity';
import {Game} from './entities/game.entity';

@Injectable()
export class GameService {
    constructor(
        @InjectRepository(GameEntity)
        private gameRepository: Repository<GameEntity>,
    ) {
    }
    //800 / 600
    gameInit(game: Game) {
        game.p1Score = 0;
        game.p2Score = 0;
        this.setInit(game);
    }

    setInit(game: Game) {
        game.ballX = 50;
        game.ballY = 6.67;
        game.ballSpeed = 5;
        if (game.p2Score > game.p1Score)
            game.ballVelocityX = game.ballSpeed * Math.cos(Math.PI / 4);
        else
            game.ballVelocityX = -game.ballSpeed * Math.cos(Math.PI / 4);
        game.ballVelocityY = game.ballSpeed*Math.sin(Math.PI / 4);
        game.padLeftX = 2.5;
        game.padLeftY = 50;
        game.padLeftVelocity = 0;
        game.padLeftX = 97.5;
        game.padLeftY = 50;
        game.padLeftVelocity = 0;
    }


}

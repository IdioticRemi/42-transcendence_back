import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {GameEntity} from './entities/game.entity';
import {Game} from './entities/game.entity';
import {Ball} from './entities/game.entity';
import {Pad} from './entities/game.entity';
import {scoreMax} from "lib/index";
import {interval} from "rxjs";

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
        game.ball.x = 50;
        game.ball.y = 6.67;
        game.ball.speed = 1;
        game.ball.span = 2.5;
        if (game.p2Score > game.p1Score)
            game.ball.velocityX = game.ball.speed * Math.cos(Math.PI / 4);
        else
            game.ball.velocityX = -game.ball.speed * Math.cos(Math.PI / 4);
        game.ball.velocityY = game.ball.speed * Math.sin(Math.PI / 4);
        game.padLeft.x = 2.5;
        game.padLeft.y = 50;
        game.padLeft.speed = 1;
        game.padLeft.height = 15;
        game.padLeft.width = 1.25;
        game.padRight.x = 97.5;
        game.padRight.y = 50;
        game.padRight.speed = 1;
        game.padRight.height = 15;
        game.padRight.width = 1.25;
    }

    checkWalls(ball: Ball) {
        if (
            (ball.y <= 0 && ball.velocityY < 0) ||
            (ball.y + ball.span >= 100 && ball.velocityY > 0)
        )
            ball.velocityY = -ball.velocityY;
    }

    checkPadLeft(game: Game) {
        if (game.ball.x <= game.padLeft.x + game.padLeft.width && game.ball.velocityX < 0) {
            if (
                game.ball.y + game.ball.span > game.padLeft.y &&
                game.ball.y < game.padLeft.y + game.padLeft.height
            ) {
                const collidePoint = game.ball.y + game.ball.span / 2 -
                (game.padLeft.y + game.padLeft.height / 2);

                game.ball.velocityX = Math.abs(game.ball.speed *
                Math.cos((collidePoint * Math.PI) / 4 / (game.padLeft.height / 2)));

                game.ball.velocityX = Math.abs(game.ball.speed *
                Math.sin((collidePoint * Math.PI) / 4 / (game.padLeft.height / 2)));

                game.ball.speed += 0.2;
            }
        }
    }

    checkPadRight(game: Game) {
        if (game.ball.x + game.ball.span >= game.padRight.x + game.padLeft.width && game.ball.velocityX > 0) {
            if (
                game.ball.y + game.ball.span > game.padRight.y &&
                game.ball.y < game.padRight.y + game.padRight.height
            ) {
                const collidePoint = game.ball.y + game.ball.span / 2 -
                    (game.padRight.y + game.padRight.height / 2);

                game.ball.velocityX = Math.abs(game.ball.speed *
                    Math.cos((collidePoint * Math.PI) / 4 / (game.padRight.height / 2)));

                game.ball.velocityX = Math.abs(game.ball.speed *
                    Math.sin((collidePoint * Math.PI) / 4 / (game.padRight.height / 2)));

                game.ball.speed += 0.2;
            }
        }
    }

    checkWin(game: Game) {
        if (game.ball.x <= 0) {
            game.p2Score++;
            if (game.p2Score !== scoreMax)
                this.setInit(game);
        }
        else if (game.ball.x + game.ball.span >= 100) {
            game.p1Score++;
            if (game.p1Score !== scoreMax)
                this.setInit(game);
        }
    }

    gameLoop(game: Game) {
        this.checkWin(game);
        if (game.p1Score === scoreMax || game.p2Score === scoreMax) {
            clearInterval(game.interval);
        }
        this.checkWalls(game.ball);
        this.checkPadLeft(game);
        this.checkPadRight(game);
        game.ball.x += game.ball.velocityX;
        game.ball.y += game.ball.velocityY;
    }

    padUp(pad: Pad) {
        if (pad.y - pad.speed <= 0)
            pad.y = 0;
        else
            pad.y -= pad.speed;
    }

    padDown(pad: Pad) {
        if (pad.y + pad.height + pad.speed >= 100)
            pad.y = 100;
        else
            pad.y += pad.speed;
    }

    startNewGame() {
        let game:Game;
        this.gameInit(game);
        //TODO: what start the party? the first pad move?
        game.interval = setInterval(() => this.gameLoop(game), 16);
    }


}

import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import { Server } from 'socket.io';
import {Repository} from 'typeorm';
import {GameEntity} from './entities/game.entity';
import {Game} from './lib/game';
import {Ball} from './lib/game';
import {Pad} from './lib/game';
import {PadMove} from './lib/game';
import {scoreMax} from "./lib/game";
import {startTime} from "./lib/game";
import {gameFps} from "./lib/game";
import {ballStartX} from "./lib/game";
import {ballStartY} from "./lib/game";
import {ballSpeed} from "./lib/game";
import {ballSpan} from "./lib/game";
import {ballSpeedInc} from "./lib/game";
import {padLeftStartX} from "./lib/game";
import {padRightStartX} from "./lib/game";
import {padStartY} from "./lib/game";
import {padSpeed} from "./lib/game";
import {padHeight} from "./lib/game";
import {padWidth} from "./lib/game";

@Injectable()
export class GameService {
    constructor(
        @InjectRepository(GameEntity)
        private gameRepository: Repository<GameEntity>,
    ) {
    }

    gameInit(game: Game) {
        game.p1Score = 0;
        game.p2Score = 0;
        this.setInit(game);
    }

    setInit(game: Game) {
        game.ball.x = ballStartX;
        game.ball.y = ballStartY;
        game.ball.speed = ballSpeed;
        game.ball.size = ballSpan;
        if (game.p2Score > game.p1Score)
            game.ball.velocityX = game.ball.speed * Math.cos(Math.PI / 4);
        else
            game.ball.velocityX = -game.ball.speed * Math.cos(Math.PI / 4);
        game.ball.velocityY = game.ball.speed * Math.sin(Math.PI / 4);
        this.padInit(game.padLeft, 1);
        this.padInit(game.padRight, 2);
    }

    padInit(pad: Pad, side: number) {
        if (side === 1)
            pad.x = padLeftStartX;
        else
            pad.x = padRightStartX;
        pad.y = padStartY;
        pad.speed = padSpeed;
        pad.height = padHeight;
        pad.width = padWidth;
        pad.move = PadMove.STATIC;
    }

    checkWalls(ball: Ball) {
        if (
            (ball.y <= 0 && ball.velocityY < 0) ||
            (ball.y + ball.size >= 100 && ball.velocityY > 0)
        )
            ball.velocityY = -ball.velocityY;
    }

    checkPad(pad: Pad, ball: Ball) {
        if (
          ball.y + ball.size > pad.y &&
          ball.y < pad.y + pad.height
        ) {
            const collidePoint = ball.y + ball.size / 2 -
              (pad.y + pad.height / 2);

            ball.velocityX = Math.abs(ball.speed *
              Math.cos((collidePoint * Math.PI) / 4 / (pad.height / 2)));

            ball.velocityX = Math.abs(ball.speed *
              Math.sin((collidePoint * Math.PI) / 4 / (pad.height / 2)));

            ball.speed += ballSpeedInc;
        }
    }

    checkWin(game: Game) {
        if (game.ball.x <= 0) {
            game.p2Score++;
            if (game.p2Score !== scoreMax)
                this.setInit(game);
        }
        else if (game.ball.x + game.ball.size >= 100) {
            game.p1Score++;
            if (game.p1Score !== scoreMax)
                this.setInit(game);
        }
    }

    gameLoop(game: Game) {
        this.checkWin(game);
        if (game.p1Score === scoreMax || game.p2Score === scoreMax) {
            clearInterval(game.interval);
            //TODO: send victory and saving in database history
            return;
        }
        this.checkWalls(game.ball);
        if (game.ball.x <= game.padLeft.x + game.padLeft.width && game.ball.velocityX < 0) {
            this.checkPad(game.padLeft, game.ball);
        }
        if (game.ball.x + game.ball.size >= game.padRight.x + game.padLeft.width && game.ball.velocityX > 0) {
            this.checkPad(game.padRight, game.ball);
        }
        game.ball.x += game.ball.velocityX;
        game.ball.y += game.ball.velocityY;
        if (game.padLeft.move === PadMove.UP)
            this.padUp(game.padLeft);
        else if (game.padLeft.move === PadMove.DOWN)
            this.padDown(game.padLeft);
        if (game.padRight.move === PadMove.UP)
            this.padUp(game.padRight);
        else if (game.padRight.move === PadMove.DOWN)
            this.padDown(game.padRight);
        //TODO: send new pos for front
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

    async startNewGame(server: Server, p1: number, p2: number) {
        const game = new Game(server, p1, p2);
        this.gameInit(game);
        await new Promise(resolve => setTimeout(resolve, startTime));
        game.interval = setInterval(() => this.gameLoop(game), 1000/gameFps);
    }




}

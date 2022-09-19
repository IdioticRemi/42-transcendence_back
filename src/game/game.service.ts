import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SocketService } from 'src/socket/socket.service';
import { Repository } from 'typeorm';
import { GameEntity } from './entities/game.entity';
import {Game} from './lib/game';
import { Ball } from './lib/game';
import { Pad } from './lib/game';
import { PadMove } from './lib/game';
import { scoreMax } from "./lib/game";
import { startTime } from "./lib/game";
import { gameTps } from "./lib/game";
import { ballStartX } from "./lib/game";
import { ballStartY } from "./lib/game";
import { ballSpeed } from "./lib/game";
import { padStartY } from "./lib/game";
import { numActPerSendData } from "./lib/game";

@Injectable()
export class GameService {
    constructor(
        @InjectRepository(GameEntity)
        private gameRepository: Repository<GameEntity>,
        private socketService: SocketService,
    ) {
    }

    setInit(game: Game) {
        game.ball.x = ballStartX;
        game.ball.y = ballStartY;
        game.ball.speed = ballSpeed;
        if (game.p2Score > game.p1Score)
            game.ball.velocityX = game.ball.speed * Math.cos(Math.PI / 4);
        else
            game.ball.velocityX = -game.ball.speed * Math.cos(Math.PI / 4);
        game.ball.velocityY = game.ball.speed * Math.sin(Math.PI / 4);
        this.padInit(game.padLeft);
        this.padInit(game.padRight);
        this.formatAndSendData(game);
        game.pause = true;
        this.formatAndSendData(game);
        setTimeout(() => {
            game.pause = false
        }, startTime);
    }


    padInit(pad: Pad) {
        pad.y = padStartY;
        pad.move = PadMove.STATIC;
    }

    checkWalls(ball: Ball) {
        if (
            (ball.y <= 0 && ball.velocityY < 0) ||
            (ball.y + ball.sizeY >= 100 && ball.velocityY > 0)
        )
            ball.velocityY = -ball.velocityY;
    }

    checkPad(pad: Pad, ball: Ball) {
        if (
            ball.y + ball.sizeY > pad.y &&
            ball.y < pad.y + pad.height
        ) {
            const collidePoint = ball.y + ball.sizeY / 2 -
                (pad.y + pad.height / 2);

            ball.velocityX = (pad.x > 50 ? -1 : 1) * Math.abs(ball.speed *
                Math.cos((collidePoint * Math.PI) / 4 / (pad.height / 2)));

            ball.velocityY = ball.speed *
                Math.sin((collidePoint * Math.PI) / 4 / (pad.height / 2));

            ball.speed += ball.accel;
            if (ball.speed >= pad.width) {
                ball.speed = pad.width - 0.05;
                ball.accel = 0;
            }
        }
    }

    checkWin(game: Game) {
        if (game.ball.x <= 0 || game.ball.x + game.ball.sizeX >= 100) {
            if (game.ball.x <= 0)
                game.p2Score++;
            else
                game.p1Score++;
            this.updateDbScore(game);
            this.setInit(game);
            if (game.p2Score !== scoreMax && game.p1Score !== scoreMax) {
                game.server.to(`game_${game.id}`).emit('success', `Score: ${game.p1Score} - ${game.p2Score}`);
            }
        }
    }

    async gameLoop(game: Game) {
        if (!game.pause) {
            this.checkWin(game);
            if (game.p1Score === scoreMax || game.p2Score === scoreMax) {
                clearInterval(game.interval);
                const winner = game.p1Score === scoreMax ? game.p1 : game.p2;
                const winnerScore = Math.max(game.p1Score, game.p2Score);
                const loserScore = Math.min(game.p1Score, game.p2Score);

                const winnerObj = this.socketService.getConnectedUserById(winner);

                let winnerNick;
                if (!winnerObj) winnerNick = "sample_nick";
                else winnerNick = winnerObj.nickname;

                game.server.to(`game_${game.id}`).emit('success', `user ${winnerNick} won the game ${winnerScore} - ${loserScore}`);
                game.server.to(`game_${game.id}`).emit('game_ended', { winnerNick, winnerId: winner, winnerScore, loserScore });
                this.socketService.endGame(game.id);

                return;
            }
            this.checkWalls(game.ball);
            if (game.ball.x <= game.padLeft.x + game.padLeft.width &&
                game.ball.x + game.ball.sizeX >= game.padLeft.x &&
                game.ball.velocityX < 0) {
                this.checkPad(game.padLeft, game.ball);
            }
            else if (game.ball.x + game.ball.sizeX >= game.padRight.x &&
                    game.ball.x <= game.padRight.x + game.padRight.width &&
                    game.ball.velocityX > 0) {
                this.checkPad(game.padRight, game.ball);
            }

            // Add velocity to ball
            game.ball.x += game.ball.velocityX;
            game.ball.y += game.ball.velocityY;

            // Make sure coordinates stay positive between 0 and 100
            game.ball.x = Math.min(game.ball.x, 100 - game.ball.sizeX);
            game.ball.x = Math.max(game.ball.x, 0);
            game.ball.y = Math.min(game.ball.y, 100 - game.ball.sizeY);
            game.ball.y = Math.max(game.ball.y, 0);

            if (game.setTrigger &&
                (game.triggerZone.x - game.triggerSpeed > 0) &&
                (game.triggerZone.x + game.triggerZone.height + (game.triggerSpeed / 2))) {
                game.triggerZone.x -= game.triggerSpeed / 2;
                game.triggerZone.height += game.triggerSpeed;
            }

            if (game.isInTrigger === false && game.setTrigger &&
                game.ball.x <= game.triggerZone.x + game.triggerZone.width &&
                game.ball.x + game.ball.sizeX >= game.triggerZone.x &&
                game.ball.y <= game.triggerZone.y + game.triggerZone.height &&
                game.ball.y + game.ball.sizeY >= game.triggerZone.y) {
                if (game.ball.velocityX > 0)
                    game.badCmdP2 = !game.badCmdP2;
                else
                    game.badCmdP1 = !game.badCmdP1;
                game.isInTrigger = true;
            }
            else
                game.isInTrigger = false;

            if ((game.padLeft.move === PadMove.UP && !game.badCmdP1) ||
                (game.padLeft.move === PadMove.DOWN && game.badCmdP1))
                this.padUp(game.padLeft);
            else if ((game.padLeft.move === PadMove.DOWN && !game.badCmdP1) ||
                    (game.padLeft.move === PadMove.UP && game.badCmdP1))
                this.padDown(game.padLeft);
            if ((game.padRight.move === PadMove.UP && !game.badCmdP2) ||
                (game.padRight.move === PadMove.DOWN && game.badCmdP2))
                this.padUp(game.padRight);
            else if ((game.padRight.move === PadMove.DOWN && !game.badCmdP2) ||
                    (game.padRight.move === PadMove.UP && game.badCmdP2))
                this.padDown(game.padRight);
        }
        if (game.sendTest === numActPerSendData && !game.pause) {
            this.formatAndSendData(game);
            game.sendTest = 1;
        }
        else if (!game.pause)
            game.sendTest++;
    }

    formatAndSendData(game: Game) {
        game.server.to(`game_${game.id}`).emit('game_data', {
            ball: game.ball,
            padLeft: game.padLeft,
            padRight: game.padRight,
            tps: Math.floor(gameTps / numActPerSendData),
            pause: game.pause,
            p1Score: game.p1Score,
            p2Score: game.p2Score,
            p1: game.p1,
            p2: game.p2
        });
    }

    padUp(pad: Pad) {
        if (pad.y - pad.speed <= 0)
            pad.y = 0;
        else
            pad.y -= pad.speed;
    }

    padDown(pad: Pad) {
        if (pad.y + pad.height + pad.speed >= 100)
            pad.y = 100 - pad.height;
        else
            pad.y += pad.speed;
    }

    async startGame(game: Game) {
        await new Promise(resolve => setTimeout(resolve, startTime));
        game.interval = setInterval(() => this.gameLoop(game), 1000 / gameTps);
    }

    async updateDbScore(game: Game) {
        try {
            await this.gameRepository.update(game.dbIdP1, { playerScore: game.p1Score, opponentScore: game.p2Score });
            await this.gameRepository.update(game.dbIdP2, { playerScore: game.p2Score, opponentScore: game.p1Score });
        } catch {
            game.server.to(`game_${game.id}`).emit('error', "could not update score in database");
        }
    }
}

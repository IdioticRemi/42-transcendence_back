import { StringifyOptions } from "querystring";
import { Server } from "socket.io";
import { GameType } from "../entities/game.entity";

export const baseSpeed = 60;
export const scoreMax = 3;
export const startTime = 1e3;
export const gameTps = 60;
export const ballStartX = 50;
export const ballStartY = 6.67;
export const ballSpeed = (baseSpeed / gameTps); //don't take a ration baseSpeed / gameTps over the padWidth could cause problem with colision detection
export const ballSize = 2.5;
export const ballSpeedInc = ballSpeed / 50;
export const padSpeed = (baseSpeed / gameTps);
export const padHeight = 15;
export const padWidth = 1.25;
export const padLeftStartX = padWidth * 2;
export const padRightStartX = 100 - (padWidth * 3);
export const padStartY = 50 - padHeight / 2;

export enum PadMove {
  UP = -1,
  STATIC,
  DOWN,
}

export class Ball {
  x: number;
  y: number;
  speed: number;
  velocityX: number;
  velocityY: number;
  size: number;

  constructor(velocityX: number) {
    this.x = ballStartX;
    this.y = ballStartY;
    this.speed = ballSpeed;
    this.velocityX  = velocityX;
    this.velocityY = ballSpeed * Math.sin(Math.PI / 4);
    this.size = ballSize;
  }
}

export class Pad {
  x: number;
  y: number;
  height: number;
  width: number;
  speed: number;
  move: number;

  constructor(startX: number) {
    this.x = startX;
    this.y = padStartY;
    this.height = padHeight;
    this.width = padWidth;
    this.speed = padSpeed;
    this.move = PadMove.STATIC;
  }
}

export class Game {
  
  interval: NodeJS.Timer;
  pause: boolean;
  p1Score: number;
  p2Score: number;
  ball: Ball;
  padLeft: Pad;
  padRight: Pad;
  server: Server;
  p1: number;
  p2: number;
  id: string;
  dbIdP1: number;
  dbIdP2: number;
  type: GameType;
  spectactors: number[];

  constructor(server: Server, p1: number, p2: number, dbIdP1: number, dbIdP2: number, type: GameType) {
    this.server = server;
    this.interval = null;
    this.pause = false;
    this.p1Score = 0;
    this.p2Score = 0;
    this.ball = new Ball(-ballSpeed * Math.cos(Math.PI / 4));
    this.padLeft = new Pad(padLeftStartX);
    this.padRight = new Pad(padRightStartX);
    this.p1 = p1;
    this.p2 = p2;
    this.spectactors = [];
    this.id = [p1, p2].sort().join('_');
    this.dbIdP1 = dbIdP1;
    this.dbIdP2 = dbIdP2;
    this.type = type;
  }

}
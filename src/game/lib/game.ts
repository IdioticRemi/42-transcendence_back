import { Server } from "socket.io";

export const scoreMax = 3;
export const startTime = 3000;
export const gameFps = 60;
export const ballStartX = 50;
export const ballStartY = 6.67;
export const ballSpeed = 1;
export const ballSpan = 2.5;
export const ballSpeedInc = 0.2;
export const padSpeed = 1;
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

  constructor() {
    this.x = 0;
    this.y = 0;
    this.speed = 0;
    this.velocityX  = 0;
    this.velocityY = 0;
    this.size = 0;
  }
}

export class Pad {
  x: number;
  y: number;
  height: number;
  width: number;
  speed: number;
  move: number;

  constructor() {
    this.x = 0;
    this.y = 0;
    this.height = 0;
    this.width = 0;
    this.speed = 0;
    this.move = 0;
  }
}

export class Game {
  
  interval: NodeJS.Timer;
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
  spectactors: number[];

  constructor(server: Server, p1: number, p2: number, dbIdP1: number, dbIdP2: number) {
    this.server = server;
    this.interval = null;
    this.p1Score = 0;
    this.p2Score = 0;
    this.ball = new Ball();
    this.padLeft = new Pad();
    this.padRight = new Pad();
    this.p1 = p1;
    this.p2 = p2;
    this.spectactors = [];
    this.id = [p1, p2].sort().join('_');
    this.dbIdP1 = dbIdP1;
    this.dbIdP2 = dbIdP2;
  }

}
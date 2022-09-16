import { Server } from "socket.io";
import { GameType } from "../entities/game.entity";

export const numActPerSendData = 4;
export const baseSpeed = 120;
export const scoreMax = 3;
export const startTime = 1e3;
export const gameTps = 120;
export const ballStartX = 50;
export const ballStartY = 6.67;
export const ballSpeed = (baseSpeed / gameTps); //don't take a ration baseSpeed / gameTps over the padWidth could cause problem with collision detection
export const ballSizeX = 2.4;
export const ballSizeY = 3.2;
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
  sizeX: number;
  sizeY: number;
  accel: number;

  constructor(velocityX: number, customBallSpeed: number, accel: number) {
    this.x = ballStartX;
    this.y = ballStartY;
    this.speed = customBallSpeed;
    this.velocityX  = velocityX;
    this.velocityY = customBallSpeed * Math.sin(Math.PI / 4);
    this.sizeX = ballSizeX;
    this.sizeY = ballSizeY;
    this.accel = accel;
  }
}

export class Pad {
  x: number;
  y: number;
  height: number;
  width: number;
  speed: number;
  move: number;

  constructor(startX: number, height: number) {
    this.x = startX;
    this.y = padStartY;
    this.height = height;
    this.width = padWidth;
    this.speed = padSpeed;
    this.move = PadMove.STATIC;
  }
}

export class TriggerZone {
  x: number;
  y: number;
  height: number;
  width: number;

  constructor(posX: number, posY: number, height: number, width: number) {
    this.x = posX;
    this.y = posY;
    this.height = height;
    this.width = width;
  }
}

export class Game {
  
  interval: NodeJS.Timer;
  sendTest: number;
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
  spectators: number[];
  badCmdP1: boolean;
  badCmdP2: boolean;
  setTrigger: boolean;
  triggerSpeed: number;
  isInTrigger: boolean;
  triggerZone: TriggerZone;

  constructor(server: Server,
              p1: number,
              p2: number,
              dbIdP1: number,
              dbIdP2: number,
              type: GameType,
              customPadHeight= padHeight,
              customBallSpeed = ballSpeed,
              customAccelBall = 0,
              triggerSpeed = 0,
              badCmd = false,
              setTrigger = false) {
    this.server = server;
    this.interval = null;
    this.sendTest = 1;
    this.pause = false;
    this.p1Score = 0;
    this.p2Score = 0;
    this.ball = new Ball(-customBallSpeed * Math.cos(Math.PI / 4), customBallSpeed, customAccelBall);
    this.padLeft = new Pad(padLeftStartX, customPadHeight);
    this.padRight = new Pad(padRightStartX, customPadHeight);
    this.p1 = p1;
    this.p2 = p2;
    this.spectators = [];
    this.id = [p1, p2].sort().join('_');
    this.dbIdP1 = dbIdP1;
    this.dbIdP2 = dbIdP2;
    this.type = type;
    this.badCmdP1 = badCmd;
    this.badCmdP2 = badCmd;
    this.setTrigger = setTrigger;
    this.isInTrigger = false;
    this.triggerZone = new TriggerZone(47, 46, 8, 6);
  }

}
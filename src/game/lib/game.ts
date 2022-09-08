
export let scoreMax = 3;
export let startTime = 3000;
export let ballStartX = 50;
export let ballStartY = 6.67;
export let ballSpeed = 1;
export let ballSpan = 2.5;
export let ballSpeedInc = 0.2;
export let padSpeed = 1;
export let padHeight = 15;
export let padWidth = 1.25;
export let padLeftStartX = padWidth * 2;
export let padRightStartX = 100 - (padWidth * 2);
export let padStartY = 50 - padHeight / 2;

export enum PadMove {
  UP = -1,
  STATIC,
  DOWN,
}

export type Ball = {
  x: number;
  y: number;
  speed: number;
  velocityX: number;
  velocityY: number;
  span: number;
}

export type Pad = {
  x: number;
  y: number;
  height: number;
  width: number;
  speed: number;
  move: number;
}

export type Game = {
  interval;
  p1Score: number;
  p2Score: number;
  ball: Ball;
  padLeft: Pad;
  padRight: Pad;
}
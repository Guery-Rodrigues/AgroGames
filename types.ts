export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Player extends Position, Size {
  speed: number;
  color: string;
}

export interface Enemy extends Position {
  id: number;
  radius: number;
  speed: number;
  active: boolean;
}

export interface Spray extends Position, Size {
  lifeTime: number; // Frames remaining
  maxLifeTime: number;
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER,
}
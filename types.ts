
export enum Color {
  RED = 'RED',
  BLACK = 'BLACK'
}

export enum PieceType {
  GENERAL = 'GENERAL', // Shuai/Jiang
  ADVISOR = 'ADVISOR', // Shi
  ELEPHANT = 'ELEPHANT', // Xiang
  HORSE = 'HORSE', // Ma
  CHARIOT = 'CHARIOT', // Ju
  CANNON = 'CANNON', // Pao
  SOLDIER = 'SOLDIER', // Bing/Zu
}

export interface TileData {
  id: string; // Unique ID for React keys
  type: PieceType;
  color: Color;
  label: string; // Chinese character
  value: number; // For sorting/logic
}

export interface Player {
  id: number;
  name: string;
  isHuman: boolean; // True if controlled by a real person (Local or Remote)
  isReady: boolean; // True if ready to start
  hand: TileData[];
  discards: TileData[];
  chips: number; 
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  CUTTING = 'CUTTING', 
  DEALING = 'DEALING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum GameMode {
  SINGLEPLAYER = 'SINGLEPLAYER',
  MULTIPLAYER = 'MULTIPLAYER'
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  turnIndex: number; 
  dealerIndex: number;
  wall: TileData[]; 
  wallBreakIndex: number; 
  players: Player[];
  lastDiscard: TileData | null;
  winnerId: number | null;
  loserId: number | null; 
  winningHand: TileData[] | null;
  logs: string[];
}

// Network Actions
export type NetworkActionType = 
  | 'JOIN' 
  | 'SYNC_STATE' 
  | 'ACTION_DRAW' 
  | 'ACTION_DISCARD' 
  | 'ACTION_EAT' 
  | 'ACTION_WIN' 
  | 'ACTION_PASS'
  | 'ACTION_CUT'
  | 'ACTION_TOGGLE_READY'
  | 'RESTART';

export interface NetworkMessage {
  type: NetworkActionType;
  payload?: any;
  senderId?: number;
}

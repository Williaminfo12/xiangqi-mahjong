import { TileData } from '../types';

// AI functionality has been removed to ensure smooth deployment on free hosting.
// This file is kept to prevent "Module not found" errors.

export const getAiDiscardHint = async (hand: TileData[], history: string[]): Promise<string> => {
  return "AI 功能已停用";
};

export const getAiChatter = async (situation: 'win' | 'lose' | 'discard', playerName: string): Promise<string> => {
  return "";
};
import { GoogleGenAI } from "@google/genai";
import { TileData, Player } from '../types';

let client: GoogleGenAI | null = null;

try {
  if (process.env.API_KEY) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize Gemini client", e);
}

export const getAiDiscardHint = async (hand: TileData[], history: string[]): Promise<string> => {
  if (!client) return "AI 未連接";

  const handStr = hand.map(t => `${t.color === 'RED' ? '紅' : '黑'}${t.label}`).join(' ');
  const prompt = `
    你是一個四人車馬炮（台灣象棋麻將）的高手。
    你的手牌是: [${handStr}].
    遊戲紀錄: ${history.slice(-5).join('; ')}.
    
    請用繁體中文簡短解釋我應該打哪張牌以及原因，以最大化聽牌或胡牌機率 (湊成 對子、三條、或 帥仕相/俥傌炮 等組合)。
    請保持在 30 字以內。
  `;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "相信你的直覺！";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "專注於湊對子。";
  }
};

export const getAiChatter = async (situation: 'win' | 'lose' | 'discard', playerName: string): Promise<string> => {
  if (!client) return "";

  const prompt = `
    你正在玩台灣象棋麻將。你是 ${playerName}。
    狀況: ${situation}。
    請用道地的台灣口語（繁體中文）講一句簡短、有趣或嗆聲的話 (10字以內)。
    例如：輸了可以說「真衰」，贏了說「爽啦」，出牌可以說「這張送你」。
  `;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text || "哈哈！";
  } catch (error) {
    return "";
  }
};
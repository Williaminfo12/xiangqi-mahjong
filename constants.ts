import { Color, PieceType, TileData } from './types';

export const CHARACTERS = {
  [Color.RED]: {
    [PieceType.GENERAL]: '帥',
    [PieceType.ADVISOR]: '仕',
    [PieceType.ELEPHANT]: '相',
    [PieceType.CHARIOT]: '俥',
    [PieceType.HORSE]: '傌',
    [PieceType.CANNON]: '炮',
    [PieceType.SOLDIER]: '兵',
  },
  [Color.BLACK]: {
    [PieceType.GENERAL]: '將',
    [PieceType.ADVISOR]: '士',
    [PieceType.ELEPHANT]: '象',
    [PieceType.CHARIOT]: '車',
    [PieceType.HORSE]: '馬',
    [PieceType.CANNON]: '包',
    [PieceType.SOLDIER]: '卒',
  },
};

// Standard count for ONE set of Chinese Chess.
// We use ONE set (Single Deck) for standard Taiwan Xiangqi Mahjong (Total 32 cards).
const SINGLE_SET_COUNTS = {
  [PieceType.GENERAL]: 1,
  [PieceType.ADVISOR]: 2,
  [PieceType.ELEPHANT]: 2,
  [PieceType.CHARIOT]: 2,
  [PieceType.HORSE]: 2,
  [PieceType.CANNON]: 2,
  [PieceType.SOLDIER]: 5,
};

export const generateDeck = (): TileData[] => {
  let deck: TileData[] = [];
  let idCounter = 0;

  // Create 1 set (Total 32 tiles)
  for (let set = 0; set < 1; set++) {
    ([Color.RED, Color.BLACK] as Color[]).forEach((color) => {
      Object.entries(SINGLE_SET_COUNTS).forEach(([type, count]) => {
        const pType = type as PieceType;
        for (let i = 0; i < count; i++) {
          deck.push({
            id: `tile-${set}-${color}-${pType}-${i}-${idCounter++}`,
            type: pType,
            color: color,
            label: CHARACTERS[color][pType],
            value: getPieceValue(pType),
          });
        }
      });
    });
  }
  return deck;
};

const getPieceValue = (type: PieceType): number => {
  switch (type) {
    case PieceType.GENERAL: return 7;
    case PieceType.ADVISOR: return 6;
    case PieceType.ELEPHANT: return 5;
    case PieceType.CHARIOT: return 4;
    case PieceType.HORSE: return 3;
    case PieceType.CANNON: return 2;
    case PieceType.SOLDIER: return 1;
    default: return 0;
  }
};

export const AVATARS = [
  "https://picsum.photos/seed/p1/100/100",
  "https://picsum.photos/seed/bot1/100/100",
  "https://picsum.photos/seed/bot2/100/100",
  "https://picsum.photos/seed/bot3/100/100",
];

export const PLAYER_NAMES = ["你自己", "老張", "林阿姨", "王伯伯"];
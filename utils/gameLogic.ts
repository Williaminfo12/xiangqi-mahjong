
import { TileData, PieceType, Color } from '../types';

export const shuffleDeck = (deck: TileData[]): TileData[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const sortHand = (hand: TileData[]): TileData[] => {
  return [...hand].sort((a, b) => {
    if (a.color !== b.color) return a.color === Color.RED ? -1 : 1; // Red first
    return b.value - a.value; // Higher value pieces first
  });
};

// --- Chi (Eat) Logic ---

export const getChiCombinations = (hand: TileData[], tile: TileData): TileData[][] => {
  const combinations: TileData[][] = [];
  
  const findPieces = (type: PieceType, color: Color | 'ANY'): TileData[] => {
    return hand.filter(t => t.type === type && (color === 'ANY' || t.color === color));
  };

  // Group A: General(7) - Advisor(6) - Elephant(5)
  // Logic: Generals are interchangeable. Advisor/Elephant must match color.
  
  const isGroupA = [PieceType.GENERAL, PieceType.ADVISOR, PieceType.ELEPHANT].includes(tile.type);
  
  if (isGroupA) {
     // Define the role of the incoming tile and what we need
     // If incoming is General: We need Adv + Ele of SAME color (Red or Black)
     // If incoming is Adv/Ele: We need Partner (Ele/Adv) of SAME color + General of ANY color
     
     const tryFormSet = (targetColor: Color) => {
         // Do we have the parts for a set of `targetColor`?
         // If the incoming tile is part of this set, use it.
         
         // Check compatibility of incoming tile with this target set color
         if (tile.type !== PieceType.GENERAL && tile.color !== targetColor) return;

         const neededTypes: PieceType[] = [];
         if (tile.type !== PieceType.GENERAL) neededTypes.push(PieceType.GENERAL);
         if (tile.type !== PieceType.ADVISOR) neededTypes.push(PieceType.ADVISOR);
         if (tile.type !== PieceType.ELEPHANT) neededTypes.push(PieceType.ELEPHANT);

         // Find candidates for needed types
         const candidates1 = findPieces(neededTypes[0], neededTypes[0] === PieceType.GENERAL ? 'ANY' : targetColor);
         const candidates2 = findPieces(neededTypes[1], neededTypes[1] === PieceType.GENERAL ? 'ANY' : targetColor);

         for (const c1 of candidates1) {
             for (const c2 of candidates2) {
                 if (c1.id !== c2.id) {
                     combinations.push([c1, c2]);
                 }
             }
         }
     };

     // Try to form Red Set and Black Set
     tryFormSet(Color.RED);
     tryFormSet(Color.BLACK);
  }

  // Group B: Chariot(4) - Horse(3) - Cannon(2)
  // Logic: Strict Color matching
  const groupB = [PieceType.CHARIOT, PieceType.HORSE, PieceType.CANNON];
  if (groupB.includes(tile.type)) {
    const neededTypes = groupB.filter(t => t !== tile.type);
    const p1List = findPieces(neededTypes[0], tile.color);
    const p2List = findPieces(neededTypes[1], tile.color);
    
    for (const p1 of p1List) {
        for (const p2 of p2List) {
            if (p1.id !== p2.id) combinations.push([p1, p2]);
        }
    }
  }

  // Deduplicate combinations (by ID) just in case
  const uniqueCombos: TileData[][] = [];
  const seenIds = new Set<string>();
  
  for (const combo of combinations) {
      const sortedIds = combo.map(c => c.id).sort().join(',');
      if (!seenIds.has(sortedIds)) {
          seenIds.add(sortedIds);
          uniqueCombos.push(combo);
      }
  }

  return uniqueCombos;
};


// --- Win Checking Logic ---

export const checkWin = (hand: TileData[]): boolean => {
  if (hand.length !== 5) return false;
  const sorted = sortHand(hand);
  
  // 1. Check for 5 Pawns (Instant Win)
  if (isFivePawns(sorted)) return true;

  // 2. Standard Win: 1 Pair + 1 Set (3 cards)
  
  // Find potential pairs
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
        if (isPair(sorted[i], sorted[j])) {
            // Remove pair
            const remaining = sorted.filter((_, idx) => idx !== i && idx !== j);
            if (isSet(remaining)) return true;
        }
    }
  }

  return false;
};

export const checkWinWithTile = (hand: TileData[], tile: TileData): boolean => {
    if (hand.length !== 4) return false; 
    const virtualHand = [...hand, tile];
    return checkWin(virtualHand);
};

export const isFivePawns = (hand: TileData[]): boolean => {
    const redPawns = hand.filter(t => t.type === PieceType.SOLDIER && t.color === Color.RED).length;
    const blackPawns = hand.filter(t => t.type === PieceType.SOLDIER && t.color === Color.BLACK).length;
    return redPawns === 5 || blackPawns === 5;
};

const isPair = (a: TileData, b: TileData) => {
  // Special Rule: Generals are interchangeable for Pairs
  if (a.type === PieceType.GENERAL && b.type === PieceType.GENERAL) return true;
  
  // Standard Rule: Must match type and color
  return a.type === b.type && a.color === b.color;
};

const isSet = (tiles: TileData[]) => {
  if (tiles.length !== 3) return false;
  const sorted = sortHand(tiles);
  const types = sorted.map(t => t.type);

  // 1. Three of a kind (Identical pieces) - Strict Color
  // Note: Impossible for Generals in Single Deck (only 2 exist), but logic holds.
  if (sorted[0].type === sorted[1].type && sorted[1].type === sorted[2].type && 
      sorted[0].color === sorted[2].color) {
    return true;
  }

  // 2. Sequences (Valid Sets in Xiangqi Mahjong)

  // Set A: General + Advisor + Elephant
  // Rule: Advisor and Elephant must match color. General can be any color.
  const hasGeneral = types.includes(PieceType.GENERAL);
  const hasAdvisor = types.includes(PieceType.ADVISOR);
  const hasElephant = types.includes(PieceType.ELEPHANT);
  
  if (hasGeneral && hasAdvisor && hasElephant) {
      const adv = sorted.find(t => t.type === PieceType.ADVISOR);
      const ele = sorted.find(t => t.type === PieceType.ELEPHANT);
      if (adv && ele && adv.color === ele.color) return true;
  }

  // Set B: Chariot + Horse + Cannon (Strict Color)
  const hasChariot = types.includes(PieceType.CHARIOT);
  const hasHorse = types.includes(PieceType.HORSE);
  const hasCannon = types.includes(PieceType.CANNON);
  
  if (hasChariot && hasHorse && hasCannon) {
     // Ensure all same color
     if (sorted[0].color === sorted[1].color && sorted[1].color === sorted[2].color) return true;
  }

  // Set C: 3 Soldiers (Strict Color)
  if (types[0] === PieceType.SOLDIER && types[1] === PieceType.SOLDIER && types[2] === PieceType.SOLDIER) {
      if (sorted[0].color === sorted[2].color) return true;
  }

  return false;
};

// --- AI Decision Logic ---

export const getBestDiscard = (hand: TileData[]): TileData => {
  const scores = new Map<string, number>();

  hand.forEach(t => {
    const identicalCount = hand.filter(h => h.type === t.type && h.color === t.color).length;
    let score = 0;
    
    if (identicalCount === 2) score += 20;
    if (identicalCount >= 3) score += 50;
    
    // Sequence Potential - Group A (Gen/Adv/Ele)
    if ([PieceType.GENERAL, PieceType.ADVISOR, PieceType.ELEPHANT].includes(t.type)) {
       // For scoring, we simplified check. 
       // If General, fits with any Adv+Ele pair. 
       // If Adv/Ele, fits with Match Ele/Adv + Any Gen.
       
       const others = hand.filter(h => h.id !== t.id && 
          [PieceType.GENERAL, PieceType.ADVISOR, PieceType.ELEPHANT].includes(h.type));
       
       let usefulPartners = 0;
       others.forEach(o => {
           if (o.type === t.type) return; // Pair handled above
           
           // Compatibility Check
           let compatible = false;
           if (t.type === PieceType.GENERAL || o.type === PieceType.GENERAL) compatible = true;
           else if (t.color === o.color) compatible = true;
           
           if (compatible) usefulPartners++;
       });

       if (usefulPartners >= 1) score += 10;
       if (usefulPartners >= 2) score += 30;
    }

    // Sequence Potential - Group B (Ju/Ma/Pao) - Strict Color
    if ([PieceType.CHARIOT, PieceType.HORSE, PieceType.CANNON].includes(t.type)) {
       const others = hand.filter(h => h.id !== t.id && h.color === t.color && 
          [PieceType.CHARIOT, PieceType.HORSE, PieceType.CANNON].includes(h.type));
       const uniqueTypes = new Set(others.map(o => o.type));
       if (!uniqueTypes.has(t.type)) {
          if (uniqueTypes.size === 1) score += 5;
          if (uniqueTypes.size >= 2) score += 40;
       }
    }
    
    if (t.type === PieceType.SOLDIER) {
        const soldierCount = hand.filter(h => h.type === PieceType.SOLDIER && h.color === t.color).length;
        if (soldierCount >= 3) score += 30;
        else score += 2;
    }

    scores.set(t.id, score);
  });

  let worstTile = hand[0];
  let minScore = 9999;

  hand.forEach(t => {
    const s = scores.get(t.id) || 0;
    if (s < minScore) {
      minScore = s;
      worstTile = t;
    }
  });

  return worstTile;
};

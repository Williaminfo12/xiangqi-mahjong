
import React, { useMemo } from 'react';
import { TileData } from '../types';

interface WallProps {
  tiles: TileData[]; // The remaining tiles
  startBreakIndex: number; // Where the wall was cut (0-15)
  onCut?: (index: number) => void;
  canCut: boolean;
  cutIndex?: number | null; // The index that was currently cut (for animation)
}

// Total 32 tiles = 16 stacks of 2.
const TOTAL_STACKS = 16;

const Wall: React.FC<WallProps> = ({ tiles, startBreakIndex, onCut, canCut, cutIndex }) => {
  
  // We need to map the flat `tiles` array to the 16 positions in the circle.
  // When tiles are drawn, they are removed from `tiles`.
  
  const stacksData = useMemo(() => {
    const stacks = [];
    const totalTiles = 32; // Updated for Single Deck
    const remainingCount = tiles.length;
    const takenCount = totalTiles - remainingCount;
    const takenStacks = Math.floor(takenCount / 2);
    const oddTileRemains = takenCount % 2 !== 0; // If 1 tile taken from a stack

    // Create the sequence of Stack Indices starting from break index
    const sequence = [];
    for (let i = 0; i < TOTAL_STACKS; i++) {
        sequence.push((startBreakIndex + i) % TOTAL_STACKS);
    }

    // Map status for each stack index
    // Status: 'FULL' (2 tiles), 'HALF' (1 tile), 'EMPTY' (0 tiles)
    const stackStatus = new Map<number, number>(); // Index -> Count
    
    // Initialize all to 2
    for(let i=0; i<TOTAL_STACKS; i++) stackStatus.set(i, 2);

    // Mark taken
    for(let i=0; i<takenStacks; i++) {
        stackStatus.set(sequence[i], 0);
    }
    // If odd tile taken, the next one has 1 left
    if (oddTileRemains) {
        stackStatus.set(sequence[takenStacks], 1);
    }

    // Generate rendering data
    for (let i = 0; i < TOTAL_STACKS; i++) {
      const angleDeg = (i * (360 / TOTAL_STACKS)) - 90; // -90 to start at top
      const angleRad = (angleDeg * Math.PI) / 180;
      // Reduced radius to 40px to create more space in the "sea" for discards
      const radius = 40; 
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      
      stacks.push({
        index: i,
        x,
        y,
        count: stackStatus.get(i) || 0
      });
    }
    
    return stacks;
  }, [tiles.length, startBreakIndex]);

  return (
    // Reduced container size
    <div className="relative w-[120px] h-[120px] rounded-full border-4 border-white/10 pointer-events-none shadow-2xl bg-[#143d23]/30 backdrop-blur-sm">
      {stacksData.map((stack) => {
        const isBeingCut = cutIndex === stack.index;

        return (
            <div
            key={stack.index}
            className={`absolute w-8 h-8 flex items-center justify-center transition-all duration-300 pointer-events-auto
                ${canCut ? 'cursor-pointer hover:scale-125 z-50' : 'z-10'}
            `}
            style={{
                left: '50%',
                top: '50%',
                transform: `translate(${stack.x}px, ${stack.y}px) translate(-50%, -50%)`,
                opacity: stack.count > 0 ? 1 : 0.05 // Hide empty stacks but keep structure hint slightly visible
            }}
            onClick={() => canCut && onCut && onCut(stack.index)}
            >
            {stack.count > 0 && (
                <div className={`relative w-8 h-8 group ${isBeingCut ? 'animate-cut-remove' : ''}`}>
                    {/* Bottom Tile */}
                    <div className={`absolute top-1 left-0 w-full h-full rounded-full shadow-md border border-amber-900/60
                    bg-amber-800 bg-gradient-to-br from-amber-700 to-amber-900
                    `}></div>
                    
                    {/* Top Tile - only if count is 2 */}
                    {stack.count === 2 && (
                        <div className={`absolute top-0 left-0 w-full h-full rounded-full shadow-lg border border-amber-800
                        bg-amber-700 bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center
                        `}>
                            {/* Inner detail for realism */}
                            <div className="w-4/5 h-4/5 rounded-full border border-black/10 opacity-30"></div>
                        </div>
                    )}
                    
                    {/* Selection Hint */}
                    {canCut && (
                        <div className="absolute -inset-1 animate-pulse bg-yellow-400/40 rounded-full blur-sm group-hover:bg-yellow-300/60 transition-colors"></div>
                    )}
                </div>
            )}
            </div>
        );
      })}
      
      {/* Center Info */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md border border-amber-900/30">
           <span className="text-amber-100/80 font-serif font-bold text-[10px] tracking-widest">{tiles.length} 張</span>
        </div>
      </div>
    </div>
  );
};

export default Wall;

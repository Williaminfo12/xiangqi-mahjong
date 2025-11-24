
import React from 'react';
import { TileData, Color } from '../types';

interface TileProps {
  tile: TileData;
  onClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  selected?: boolean;
  faceDown?: boolean;
  rotated?: boolean;
  className?: string;
}

const Tile: React.FC<TileProps> = ({ 
  tile, 
  onClick, 
  size = 'md', 
  selected = false, 
  faceDown = false,
  rotated = false,
  className = ''
}) => {
  const sizeMap = {
    xs: { dim: 'w-6 h-6', text: 'text-xs', border: 'border' },
    // Increased sm size to w-11 h-11 and text-2xl for much better visibility on discards
    sm: { dim: 'w-11 h-11', text: 'text-3xl font-black', border: 'border-[3px]' },
    md: { dim: 'w-12 h-12', text: 'text-2xl', border: 'border-[3px]' },
    lg: { dim: 'w-16 h-16', text: 'text-4xl', border: 'border-4' },
  };

  const { dim, text, border } = sizeMap[size];
  const colorClass = tile.color === Color.RED ? 'text-red-600' : 'text-black';
  
  // Wood texture effect using gradients
  const bgStyle = faceDown 
    ? 'bg-amber-800 bg-gradient-to-br from-amber-700 to-amber-900' 
    : 'bg-amber-50 bg-gradient-to-br from-amber-50 to-amber-100';

  const borderStyle = 'border-amber-800 shadow-md';
  
  // Outer wrapper handles Positioning, Rotation, and Selection Transform
  const outerClasses = `
    relative flex-shrink-0 select-none cursor-pointer transition-transform duration-200
    ${dim}
    ${selected ? '-translate-y-2 z-10' : ''}
    ${rotated ? 'rotate-180' : ''}
    ${className}
  `;

  // Inner handles Visuals and Entry Animation
  // We use animate-tile-pop to scale in when mounted
  const innerClasses = `
    w-full h-full rounded-full flex items-center justify-center font-serif font-bold
    ${bgStyle}
    ${borderStyle}
    ${border}
    ${text}
    animate-tile-pop
  `;

  const selectionRing = selected ? 'ring-2 ring-yellow-400' : '';

  return (
    <div onClick={onClick} className={outerClasses} style={{ zIndex: selected ? 20 : 'auto' }}>
      <div 
        className={`${innerClasses} ${selectionRing}`}
        style={{
          boxShadow: selected ? '0 5px 10px rgba(0, 0, 0, 0.3)' : '1px 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        {!faceDown && (
          <>
            <div className={`absolute inset-0 rounded-full border border-amber-200/50 opacity-50 pointer-events-none`}></div>
            <div className={`absolute inset-0.5 rounded-full border border-dashed border-amber-900/20 pointer-events-none`}></div>
            <span className={`${colorClass} z-10 drop-shadow-sm leading-none mt-[-2px]`}>{tile.label}</span>
          </>
        )}
        {faceDown && (
           <div className="w-2/3 h-2/3 rounded-full border border-amber-500/30 opacity-40"></div>
        )}
      </div>
    </div>
  );
};

export default Tile;
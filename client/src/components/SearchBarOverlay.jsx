import React from 'react';
import { Search } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

const SearchBarOverlay = () => {
  const { searchQuery, setSearchQuery } = usePlayer();

  return (
    <div 
      className="fixed z-[999999] flex items-center justify-center pointer-events-none"
      style={{ 
        top: '0px',             // Lo subimos al área de la barra (que suele medir 30-35px)
        left: '200px',          // Espacio para el logo/menú de la izquierda
        right: '150px',         // Espacio para los botones de cerrar/min/max
        height: '24px'          // Altura compacta para que no desborde
      }}
    >
      <div 
        className="w-full max-w-[1200px] h-full flex items-center transition-all duration-300 pointer-events-auto"
        style={{ 
          WebkitAppRegion: 'no-drag', // Obligatorio para poder hacer clic e interactuar
          backgroundColor: 'rgba(255, 255, 255, 0.07)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        <Search className="ml-3 w-3 h-3 text-zinc-400" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="BUSCAR EN KLANG..."
          className="w-full h-full bg-transparent border-none outline-none text-[10px] text-white px-3 font-mono uppercase tracking-[0.2em] placeholder:text-zinc-600"
          spellCheck="false"
        />
      </div>
    </div>
  );
};

export default SearchBarOverlay;
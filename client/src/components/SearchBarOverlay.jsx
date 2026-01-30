import React, { useState, useEffect } from 'react';
import { Search, Music, User } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

const SearchBarOverlay = () => {
  // Extraemos searchResults y playSearchResult del context
  const { searchQuery, setSearchQuery, searchResults, playSearchResult } = usePlayer();
  const [isOpen, setIsOpen] = useState(false);

  // Cerrar el panel si se borra la búsqueda
  useEffect(() => {
    setIsOpen(searchQuery.length > 0);
  }, [searchQuery]);

  return (
    <div 
      className="fixed z-[999999] flex flex-col items-center pointer-events-none"
      style={{ 
        top: '4px',
        left: '200px',
        right: '250px', // Aumentamos margen para botones de control
      }}
    >
      {/* Input de Búsqueda */}
      <div 
        className="w-full max-w-[800px] h-[24px] flex items-center transition-all duration-300 pointer-events-auto"
        style={{ 
          WebkitAppRegion: 'no-drag',
          backgroundColor: 'rgba(20, 20, 22, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '6px',
        }}
      >
        <Search className="ml-3 w-3 h-3 text-zinc-500" />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="BUSCAR EN TU BIBLIOTECA LOCAL..."
          className="w-full h-full bg-transparent border-none outline-none text-[10px] text-white px-3 font-mono uppercase tracking-[0.15em] placeholder:text-zinc-600"
          spellCheck="false"
        />
      </div>

      {/* PANEL DE RESULTADOS LOCALES */}
      {isOpen && searchResults.length > 0 && (
        <div 
          className="w-full max-w-[800px] mt-2 max-h-[400px] overflow-y-auto pointer-events-auto shadow-2xl"
          style={{ 
            backgroundColor: '#0c0c0e',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            WebkitAppRegion: 'no-drag'
          }}
        >
          <div className="p-2 border-b border-white/5 flex justify-between items-center">
            <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest ml-2">Resultados locales</span>
            <span className="text-[8px] font-mono text-zinc-600 mr-2">{searchResults.length} canciones</span>
          </div>

          {searchResults.map((track, index) => (
            <div 
              key={track.song_id || track.id || index}
              onClick={() => {
                playSearchResult(track, searchResults);
                setSearchQuery(""); // Limpiamos al reproducir
              }}
              className="flex items-center p-2 hover:bg-white/5 cursor-pointer transition-colors group border-b border-white/[0.02]"
            >
              <div className="relative w-8 h-8 flex-shrink-0">
                <img 
                  src={track.thumbnail} 
                  alt="" 
                  className="w-full h-full object-cover rounded shadow-lg opacity-80 group-hover:opacity-100" 
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                  <Music className="w-3 h-3 text-white" />
                </div>
              </div>
              
              <div className="ml-3 flex flex-col overflow-hidden">
                <span className="text-[10px] text-zinc-200 font-medium truncate uppercase tracking-tight">
                  {track.title}
                </span>
                <span className="text-[9px] text-zinc-500 flex items-center truncate">
                  <User className="w-2 h-2 mr-1" />
                  {track.artist}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBarOverlay;
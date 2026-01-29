import React, { useState } from 'react';
// 1. IMPORT CORREGIDO (Añadido ListMusic, RotateCcw y RotateCw)
import { 
  Play, Pause, SkipBack, SkipForward, Mic2, Volume2, 
  Heart, Maximize2, ListMusic, RotateCcw, RotateCw 
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import ExpandedPlayer from './ExpandedPlayer';

const PlayerBar = ({ onOpenLyrics }) => {
  const { 
    currentTrack, isPlaying, isPreloading, pause, resume, 
    nextTrack, prevTrack, currentTime, duration, seek,
    skip, // <--- EXTRAÍDO DEL CONTEXTO
    volume, setVolume, toggleFavorite, favorites, showWaveform,
    // 2. EXTRAEMOS ESTADOS DE LA COLA
    isQueueOpen, setIsQueueOpen 
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const isFavorite = currentTrack && favorites.includes(currentTrack.youtubeId || currentTrack.id);
  const progressPercent = (currentTime / duration) * 100;

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  // 3. HANDLESEEK CORREGIDO (Usa la función seek del context)
  const handleSeek = (e) => {
    if (!duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedPercent = Math.max(0, Math.min(x / rect.width, 1));
    const newTime = clickedPercent * duration;

    console.log("Intentando saltar a segundo:", newTime); // MIRA ESTO EN LA CONSOLA (F12)
    seek(newTime);
  };

  if (!currentTrack) return <footer style={{ height: '90px' }}></footer>;

  return (
    <>
      <footer className="glass-panel" style={{ 
        height: '90px', display: 'flex', alignItems: 'center', padding: '0 24px', 
        justifyContent: 'space-between', margin: '0 16px 16px 16px', borderRadius: '24px',
        position: 'relative', zIndex: 100, color: 'white', border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)', background: 'rgba(10, 10, 10, 0.75)'
      }}>
        
        {/* IZQUIERDA: INFO Y FAVORITO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%' }}>
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            <img 
              src={currentTrack.thumbnail} 
              alt="" 
              style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }} 
            />
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {currentTrack.title}
            </h4>
            <p style={{ margin: '2px 0 0 0', color: '#a1a1aa', fontSize: '0.75rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {currentTrack.artist}
            </p>
          </div>
          <button 
            onClick={() => toggleFavorite(currentTrack)} 
            className="p-btn" 
            style={{ color: isFavorite ? '#ef4444' : '#52525b', marginLeft: '4px' }}
          >
            <Heart size={18} fill={isFavorite ? "#ef4444" : "none"} strokeWidth={2} />
          </button>
        </div>

        {/* CENTRO: CONTROLES Y PROGRESS BAR */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '40%', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={prevTrack} className="p-btn"><SkipBack size={20} fill="currentColor" /></button>
            
            {/* BOTÓN -10s */}
            <button onClick={() => skip(-10)} className="p-btn" title="Retroceder 10s">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={20} />
                <span style={{ fontSize: '8px', position: 'absolute', top: '55%', fontWeight: '800' }}>10</span>
              </div>
            </button>

            <button onClick={isPlaying ? pause : resume} className="p-main-btn">
              {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" style={{ marginLeft: '3px' }} />}
            </button>

            {/* BOTÓN +10s */}
            <button onClick={() => skip(10)} className="p-btn" title="Avanzar 10s">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCw size={20} />
                <span style={{ fontSize: '8px', position: 'absolute', top: '55%', fontWeight: '800' }}>10</span>
              </div>
            </button>

            <button onClick={nextTrack} className="p-btn"><SkipForward size={20} fill="currentColor" /></button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
            <span className="p-time">{formatTime(currentTime)}</span>
            
            <div 
              onClick={handleSeek} 
              className="p-progress-container"
              style={{ 
                position: 'relative', 
                flex: 1, 
                height: '24px', 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer' 
              }}
            >
              {/* El waveform: le añadimos pointerEvents: 'none' para que no estorbe al clic */}
              {showWaveform && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: '2px', opacity: 0.3, pointerEvents: 'none' }}>
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1,
                      height: `${15 + (Math.abs(Math.sin(i * 0.5)) * 70)}%`,
                      background: (i / 40) * 100 < progressPercent ? '#3b82f6' : '#3f3f46',
                      borderRadius: '1px'
                    }} />
                  ))}
                </div>
              )}

              {/* Contenedor de la barra gris y blanca */}
              <div style={{ 
                width: '100%', 
                height: '4px', 
                background: 'rgba(255,255,255,0.1)', 
                borderRadius: '2px', 
                position: 'relative', 
                overflow: 'hidden',
                pointerEvents: 'none' // <--- IMPORTANTE: Esto hace que el clic pase al padre
              }}>
                {isPreloading && <div className="shimmer-loading" />}
                <div style={{ 
                  width: `${progressPercent}%`, 
                  height: '100%', 
                  background: 'white', 
                  borderRadius: '2px',
                  transition: 'width 0.1s linear'
                }} />
              </div>
            </div>

            <span className="p-time">{formatTime(duration)}</span>
          </div>
        </div>

        {/* DERECHA: VOLUMEN, COLA Y EXTRAS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '18px', width: '30%' }}>
          
          {/* BOTÓN DE COLA AÑADIDO */}
          <button 
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              className="p-btn"
              style={{ color: isQueueOpen ? '#3b82f6' : '#71717a' }}
              title="Cola de reproducción"
          >
              <ListMusic size={20} />
          </button>

          <button onClick={onOpenLyrics} className="p-btn" title="Letras"><Mic2 size={18} /></button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="volume-group">
            <Volume2 size={18} color="#71717a" />
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))} 
              className="v-slider" 
            />
          </div>

          <button onClick={() => setIsExpanded(true)} className="p-btn" title="Expandir">
            <Maximize2 size={18} />
          </button>
        </div>

        <style>{`
          .p-btn { background: none; border: none; color: #71717a; cursor: pointer; transition: 0.2s; padding: 6px; display: flex; align-items: center; justify-content: center; }
          .p-btn:hover { color: white; transform: scale(1.1); }
          .p-main-btn { width: 40px; height: 40px; border-radius: 50%; background: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; box-shadow: 0 4px 12px rgba(255,255,255,0.1); }
          .p-main-btn:hover { transform: scale(1.05); transform: translateY(-2px); }
          .p-time { font-size: 0.65rem; color: #52525b; width: 35px; font-family: 'JetBrains Mono', monospace; }
          .v-slider { -webkit-appearance: none; width: 70px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; accent-color: white; cursor: pointer; }
          .v-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; background: white; border-radius: 50%; }
          .shimmer-loading { 
            position: absolute; inset: 0; 
            background: linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.4), transparent); 
            animation: shimmer 1.5s infinite; 
          }
          @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          @media (max-width: 768px) {
            .volume-group { display: none !important; }
            footer { margin: 0 8px 8px 8px !important; padding: 0 16px !important; }
          }
        `}</style>
      </footer>

      {isExpanded && (
        <ExpandedPlayer 
          track={currentTrack}
          isPlaying={isPlaying}
          togglePlay={isPlaying ? pause : resume}
          next={nextTrack}
          prev={prevTrack}
          progress={currentTime}
          duration={duration}
          onSeek={(percent) => seek(percent * duration)}
          isFavorite={isFavorite}
          toggleFav={() => toggleFavorite(currentTrack)}
          onClose={() => setIsExpanded(false)}
        />
      )}
    </>
  );
};

export default PlayerBar;
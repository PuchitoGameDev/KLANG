import React, { useState, useEffect } from 'react';
import { X, Save, Play, Pause, RotateCcw, Clock, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function LyricsEditorModal({ track, onClose }) {
  const { 
    saveLyricCorrection, fetchCommunityLyrics, 
    currentTime, isPlaying, pause, resume, seek, duration 
  } = usePlayer();
  
  const [lrcText, setLrcText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadCurrent = async () => {
      const existing = await fetchCommunityLyrics(track.youtubeId || track.id);
      if (existing) setLrcText(existing);
    };
    loadCurrent();
  }, [track]);

  // Función para insertar el tiempo actual del reproductor en el editor
  const insertTimestamp = () => {
    const min = Math.floor(currentTime / 60);
    const sec = (currentTime % 60).toFixed(2);
    const timestamp = `[${min.toString().padStart(2, '0')}:${sec.padStart(5, '0')}] `;
    
    setLrcText(prev => prev + (prev.endsWith('\n') || prev === "" ? "" : "\n") + timestamp);
  };

  const formatTime = (time) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content editor-v2">
        {/* HEADER */}
        <div className="editor-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={track.thumbnail} style={{ width: 40, height: 40, borderRadius: '8px' }} alt="" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Sincronizador Pro</h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#71717a' }}>{track.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="close-circle"><X size={20} /></button>
        </div>

        {/* PREVISUALIZADOR DE TIEMPO (Mini Player) */}
        <div className="mini-preview-player">
          <div className="preview-controls">
            <button onClick={isPlaying ? pause : resume} className="play-btn-small">
              {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
            </button>
            <div className="preview-info">
              <span className="current-time">{formatTime(currentTime)}</span>
              <div className="preview-progress-bg">
                <div className="preview-progress-fill" style={{ width: `${(currentTime/duration)*100}%` }} />
              </div>
              <span className="total-time">{formatTime(duration)}</span>
            </div>
          </div>
          
          <button onClick={insertTimestamp} className="btn-timestamp">
            <Clock size={16} /> Insertar Tiempo Actual
          </button>
        </div>

        {/* ÁREA DE EDICIÓN */}
        <div className="editor-workspace">
          <textarea
            value={lrcText}
            onChange={(e) => setLrcText(e.target.value)}
            placeholder="[00:00.00] Ejemplo de letra..."
            spellCheck="false"
          />
        </div>

        {/* FOOTER */}
        <div className="editor-footer">
          <p className="helper-text">Formatos aceptados: [mm:ss.xx]</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn-secondary">Descartar</button>
            <button onClick={() => saveLyricCorrection(track, lrcText)} className="btn-primary">
              <Save size={18} /> Guardar Letra
            </button>
          </div>
        </div>

        <style>{`
          .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.9); backdrop-filter: blur(10px); z-index: 5000; display: flex; align-items: center; justify-content: center; }
          .editor-v2 { width: 95%; maxWidth: 700px; background: #0c0c0e; border: 1px solid #222; border-radius: 24px; padding: 20px; color: white; }
          
          .editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .close-circle { background: #1a1a1c; border: none; color: #666; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          
          .mini-preview-player { background: #161618; padding: 15px; border-radius: 16px; margin-bottom: 15px; border: 1px solid #222; }
          .preview-controls { display: flex; alignItems: center; gap: 15px; margin-bottom: 12px; }
          .play-btn-small { background: #3b82f6; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
          
          .preview-info { flex: 1; display: flex; alignItems: center; gap: 10px; font-family: monospace; font-size: 0.8rem; }
          .preview-progress-bg { flex: 1; height: 4px; background: #333; border-radius: 2px; position: relative; }
          .preview-progress-fill { position: absolute; height: 100%; background: #3b82f6; border-radius: 2px; }
          
          .btn-timestamp { width: 100%; background: #1db95422; color: #1db954; border: 1px dashed #1db95444; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
          .btn-timestamp:hover { background: #1db95433; border-color: #1db954; }

          .editor-workspace textarea { width: 100%; height: 250px; background: #000; border: 1px solid #222; border-radius: 12px; padding: 15px; color: #1db954; font-family: 'Fira Code', monospace; font-size: 0.95rem; outline: none; line-height: 1.6; }
          
          .editor-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
          .helper-text { font-size: 0.75rem; color: #555; margin: 0; }
          .btn-primary { background: white; color: black; border: none; padding: 10px 20px; border-radius: 30px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
          .btn-secondary { background: transparent; color: #666; border: none; cursor: pointer; font-weight: 600; }
        `}</style>
      </div>
    </div>
  );
}
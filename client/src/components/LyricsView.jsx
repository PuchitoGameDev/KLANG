import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { usePlayer } from '../context/PlayerContext';
import { initDB } from '../utils/db';
import { AlertTriangle } from 'lucide-react';

export default function LyricsView({ onClose }) {
    const { currentTrack, currentTime, reportLyric } = usePlayer();
    const [lines, setLines] = useState([]);

    useEffect(() => {
        if (!currentTrack) return;
        
        const fetchLyrics = async () => {
            try {
                const db = await initDB();
                const trackId = currentTrack.youtubeId || currentTrack.id || currentTrack.song_id;
                const cached = await db.get('tracks', trackId);
                
                if (cached?.lyrics) {
                    setLines(parseLRC(cached.lyrics));
                } else {
                    const cleanName = (str) => str ? str.split('(')[0].split('-')[0].split('feat.')[0].trim() : "";
                    const artist = cleanName(currentTrack.artist || currentTrack.author);
                    const title = cleanName(currentTrack.title);

                    const { data } = await axios.get(
                        `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
                    );
                    
                    if (data.syncedLyrics) {
                        setLines(parseLRC(data.syncedLyrics));
                        const trackId = currentTrack.youtubeId || currentTrack.id || currentTrack.song_id;
                        if (trackId) {
                            await db.put('tracks', { 
                                ...currentTrack, 
                                lyrics: data.syncedLyrics, 
                                id: trackId,
                                youtubeId: trackId
                            });
                        }
                    }
                }
            } catch (e) { 
                setLines([{ time: 0, text: 'No se pudo cargar la letra' }]); 
            }
        };
        fetchLyrics();
    }, [currentTrack?.id, currentTrack?.youtubeId, currentTrack?.song_id]);

    useEffect(() => {
        const activeLine = document.getElementById('active-lyric');
        if (activeLine) {
            activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentTime]);

    const parseLRC = (lrc) => lrc.split('\n').map(l => {
        const m = l.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (m) {
            return { 
                time: parseInt(m[1]) * 60 + parseFloat(m[2]), 
                text: m[3].trim() 
            };
        }
        return null;
    }).filter(Boolean);

    const handleReport = () => {
        if (window.confirm("¿Reportar error en esta letra?")) {
            reportLyric(currentTrack.youtubeId || currentTrack.id);
        }
    };

    if (!currentTrack) return null;

    return (
        <div style={{ 
            position: 'absolute', 
            inset: 0, 
            background: '#000', 
            zIndex: 1000, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            overflowY: 'auto', 
            padding: '10vh 2rem',
            scrollBehavior: 'smooth'
        }}>
            <div style={{ 
                position: 'fixed', 
                inset: 0, 
                background: `url(${currentTrack.thumbnail}) center/cover`, 
                filter: 'blur(80px) brightness(0.3)', 
                zIndex: -1,
                transform: 'scale(1.1)' 
            }} />
            
            <button 
                onClick={onClose} 
                style={{ 
                    position: 'fixed', top: 30, right: 30, 
                    background: 'rgba(255,255,255,0.1)', border: 'none', 
                    color: 'white', width: 50, height: 50, 
                    borderRadius: '50%', cursor: 'pointer', fontSize: '1.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1001
                }}>×</button>

            {/* Botón Reportar en LyricsView */}
            <button 
                onClick={handleReport}
                style={{
                    position: 'fixed', bottom: 30, right: 30,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)', padding: '10px 15px', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    fontSize: '0.8rem', zIndex: 1001, transition: '0.3s'
                }}
                onMouseOver={(e) => {e.currentTarget.style.color = 'white'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}}
                onMouseOut={(e) => {e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}}
            >
                <AlertTriangle size={16} /> Reportar Error
            </button>
            
            <div style={{ maxWidth: '800px', width: '100%' }}>
                {lines.map((line, i) => {
                    const isActive = currentTime >= line.time && (!lines[i+1] || currentTime < lines[i+1].time);
                    return (
                        <p 
                            key={i} 
                            id={isActive ? 'active-lyric' : `lyric-${i}`}
                            style={{ 
                                fontSize: isActive ? '3.5rem' : '2rem', 
                                fontWeight: '900', 
                                color: isActive ? 'white' : 'rgba(255,255,255,0.2)', 
                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                textAlign: 'left',
                                margin: '40px 0',
                                cursor: 'default',
                                filter: isActive ? 'none' : 'blur(1px)'
                            }}>
                            {line.text || '🎵'}
                        </p>
                    );
                })}
            </div>
        </div>
    );
}
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Heart, 
  MoreVertical, Edit3, AlertTriangle 
} from 'lucide-react';
import { initDB } from '../utils/db';
import { usePlayer } from '../context/PlayerContext';
import LyricsEditorModal from './LyricsEditorModal';

export default function ExpandedPlayer({ 
  track, isPlaying, togglePlay, next, prev, progress, duration, onSeek, isFavorite, toggleFav, onClose 
}) {
  const { fetchCommunityLyrics, reportLyric, user } = usePlayer();
  const [lines, setLines] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isCommunity, setIsCommunity] = useState(false);
  
  const scrollContainerRef = useRef(null);

  const formatTime = (time) => {
    if (time === null || time === undefined || isNaN(time)) return "0:00";
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
  };

  useEffect(() => {
    if (!track) return;
    const loadLyrics = async () => {
      const trackId = track.youtubeId || track.song_id || track.id;
      try {
        const db = await initDB();
        const cached = await db.get('tracks', trackId);
        if (cached?.lyrics) { setLines(parseLRC(cached.lyrics)); return; }
        const communityLrc = await fetchCommunityLyrics(trackId);
        if (communityLrc) {
          setLines(parseLRC(communityLrc));
          setIsCommunity(true);
          await db.put('tracks', { ...track, youtubeId: trackId, lyrics: communityLrc });
          return;
        }
        const { data } = await axios.get(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`);
        if (data.syncedLyrics) {
          setLines(parseLRC(data.syncedLyrics));
          await db.put('tracks', { ...track, youtubeId: trackId, lyrics: data.syncedLyrics });
        } else {
          setLines([{ time: 0, text: 'Letra no disponible.' }]);
        }
      } catch (e) {
        setLines([{ time: 0, text: 'Letra no encontrada.' }]);
      }
    };
    loadLyrics();
  }, [track, showEditor]);

  useEffect(() => {
    if (autoScrollEnabled && scrollContainerRef.current) {
      const activeLine = document.getElementById('active-lyric-expanded');
      if (activeLine) {
        const container = scrollContainerRef.current;
        container.scrollTo({
          top: activeLine.offsetTop - container.offsetHeight / 2 + activeLine.offsetHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [progress, lines, autoScrollEnabled]);

  const parseLRC = (lrc) => lrc.split('\n').map(l => {
    const m = l.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    return m ? { time: parseInt(m[1])*60 + parseFloat(m[2]), text: m[3].trim() } : null;
  }).filter(Boolean);

  const handleProgressBarClick = (e) => {
    if (duration > 0 && typeof onSeek === 'function') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const proportion = clickX / rect.width;
      const clampedProportion = Math.max(0, Math.min(1, proportion));
      onSeek(clampedProportion * duration); 
    }
  };

  const handleLineAction = (index) => {
    if (typeof onSeek === 'function' && duration > 0) {
      onSeek(lines[index].time);
    }
  };

  const handleReport = () => {
    if (window.confirm("¿Quieres reportar un error en esta letra?")) {
        reportLyric(track.youtubeId || track.id);
        setShowMenu(false);
    }
  };

  return (
    <div className="expanded-player-overlay">
      <div className="dynamic-background" style={{ backgroundImage: `url(${track.thumbnail})` }} />

      <header className="expanded-header-fixed">
        <button onClick={onClose} className="circle-btn"><ChevronDown size={32} /></button>
        <div className="header-text">
          <span className="subtitle">{isCommunity ? "COMUNIDAD" : "REPRODUCIENDO"}</span>
          <span className="artist-top">{track.artist}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} className="circle-btn">
          <MoreVertical size={24} />
        </button>
        {showMenu && (
          <div className="floating-menu">
            <button onClick={() => setShowEditor(true)} className="menu-item"><Edit3 size={18} /> Editar</button>
            <button onClick={() => setAutoScrollEnabled(!autoScrollEnabled)} className="menu-item">
               Scroll: {autoScrollEnabled ? 'ON' : 'OFF'}
            </button>
            <button onClick={handleReport} className="menu-item" style={{color: '#f87171'}}>
                <AlertTriangle size={18} /> Reportar
            </button>
          </div>
        )}
      </header>

      <div className="main-layout-center">
        <section className="player-column">
          <div className="visual-bundle">
            <div className="image-container-left">
               <img src={track.thumbnail} alt="" className="hero-cover" />
            </div>
            
            <div className="meta-info">
              <div className="title-fav">
                <h1>{track.title}</h1>
                <button onClick={() => toggleFav(track)} className="fav-icon">
                  <Heart fill={isFavorite ? "#3b82f6" : "none"} color={isFavorite ? "#3b82f6" : "white"} size={32} />
                </button>
              </div>
              <p className="artist-sub">{track.artist}</p>
            </div>
            
            <div className="controls-bundle">
              <div className="progress-wrapper">
                <div className="p-bar-track" onClick={handleProgressBarClick}>
                  <div className="p-bar-fill" style={{ width: `${(progress / duration) * 100}%` }} />
                </div>
                <div className="time-labels">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <div className="action-buttons">
                <button onClick={prev} className="nav-icon"><SkipBack size={35} fill="white" /></button>
                <button onClick={togglePlay} className="play-circle">
                  {isPlaying ? <Pause size={40} fill="black" /> : <Play size={40} fill="black" style={{ marginLeft: 6 }} />}
                </button>
                <button onClick={next} className="nav-icon"><SkipForward size={35} fill="white" /></button>
              </div>
            </div>
          </div>
        </section>

        <section className="lyrics-column">
          <div className="lyrics-scroll-box" ref={scrollContainerRef}>
            {lines.map((line, i) => {
              const isActive = progress >= line.time && (!lines[i+1] || progress < lines[i+1].time);
              return (
                <p 
                  key={i} 
                  id={isActive ? 'active-lyric-expanded' : ''}
                  className={`lyric-text ${isActive ? 'active' : ''}`}
                  onClick={() => handleLineAction(i)}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        </section>
      </div>

      {showEditor && <LyricsEditorModal track={track} onClose={() => setShowEditor(false)} />}

      <style>{`
        .expanded-player-overlay { position: fixed; inset: 0; background: #000; z-index: 2000; display: flex; flex-direction: column; overflow: hidden; color: white; }
        .dynamic-background { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(100px) brightness(0.2); z-index: -1; transform: scale(1.1); }
        .expanded-header-fixed { position: absolute; top: 0; left: 0; right: 0; height: 100px; display: flex; justify-content: space-between; align-items: center; padding: 0 60px; z-index: 50; }
        .main-layout-center { flex: 1; display: grid; grid-template-columns: 0.8fr 1.2fr; height: 100vh; padding: 0 40px; align-items: center; gap: 20px; }
        .player-column { display: flex; justify-content: flex-start; align-items: center; height: 100%; }
        .visual-bundle { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 30px; }
        .image-container-left { width: 100%; display: flex; justify-content: flex-start; }
        .hero-cover { width: 100%; aspect-ratio: 1; border-radius: 12px; box-shadow: 0 30px 60px rgba(0,0,0,0.5); object-fit: cover; }
        .meta-info h1 { font-size: 2.8rem; margin: 0; font-weight: 900; line-height: 1.1; letter-spacing: -1px; }
        .artist-sub { font-size: 1.4rem; color: rgba(255,255,255,0.5); margin: 8px 0; }
        .title-fav { display: flex; justify-content: space-between; align-items: center; }
        .fav-icon { background: none; border: none; cursor: pointer; }
        .progress-wrapper { width: 100%; }
        .p-bar-track { width: 100%; height: 6px; background: rgba(255,255,255,0.2); border-radius: 10px; cursor: pointer; position: relative; }
        .p-bar-fill { height: 100%; background: #fff; border-radius: 10px; position: absolute; left: 0; top: 0; pointer-events: none; }
        .time-labels { display: flex; justify-content: space-between; font-size: 0.85rem; color: rgba(255,255,255,0.5); margin-top: 8px; font-family: monospace; }
        .action-buttons { display: flex; justify-content: center; align-items: center; gap: 40px; margin-top: 15px; }
        .play-circle { width: 80px; height: 80px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
        .nav-icon { background: none; border: none; cursor: pointer; color: white; }
        .lyrics-column { height: 100%; display: flex; align-items: center; overflow: hidden; padding-left: 80px; }
        .lyrics-scroll-box { height: 85%; width: 100%; overflow-y: auto; scrollbar-width: none; padding: 42vh 0; mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent); }
        .lyrics-scroll-box::-webkit-scrollbar { display: none; }
        .lyric-text { font-size: 3.5rem; font-weight: 900; color: rgba(255,255,255,0.2); margin: 40px 0; transition: all 0.4s ease; cursor: pointer; line-height: 1.1; transform-origin: left center; white-space: pre-wrap; word-wrap: break-word; }
        .lyric-text.active { color: #fff; transform: scale(1.05); }
        .circle-btn { background: rgba(255,255,255,0.1); border: none; color: white; border-radius: 50%; width: 48px; height: 48px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .floating-menu { position: absolute; top: 80px; right: 60px; background: #1c1c1e; border: 1px solid #333; border-radius: 12px; width: 180px; padding: 5px; z-index: 100; }
        .menu-item { background: none; border: none; color: white; width: 100%; text-align: left; padding: 12px; cursor: pointer; display: flex; gap: 10px; border-radius: 8px; font-size: 0.9rem; }
        .menu-item:hover { background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
}
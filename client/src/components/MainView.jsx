import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext'; 
import axios from 'axios';
import { MoreVertical, Heart, ListPlus, Trash2 } from 'lucide-react';
import HomeView from './HomeView'; 
import PlaylistView from './PlaylistView'; 
import LibraryView from './LibraryView';

function TrackOptionsMenu({ track, onClose, position, playlistId }) {
    const { myPlaylists, addToPlaylist, toggleFavorite, favorites, removeFromPlaylist } = usePlayer();
    const trackId = track.youtubeId || track.song_id || track.id;
    const isFav = favorites.includes(trackId);

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
            <div style={{
                position: 'fixed', top: position.y, left: position.x - 200,
                width: '200px', background: '#1f1f22', border: '1px solid #333',
                borderRadius: '10px', padding: '6px', boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
                zIndex: 1000,
            }}>
                <button onClick={() => { toggleFavorite(track); onClose(); }} className="menu-item">
                    <Heart size={14} fill={isFav ? "#ef4444" : "none"} color={isFav ? "#ef4444" : "white"} />
                    {isFav ? 'Quitar favorito' : 'Favorito'}
                </button>

                {playlistId && (
                    <button 
                        onClick={() => { removeFromPlaylist(playlistId, track.id); onClose(); }} 
                        className="menu-item" 
                        style={{ color: '#ef4444' }}
                    >
                        <Trash2 size={14} /> Quitar de esta lista
                    </button>
                )}

                <div style={{ height: '1px', background: '#333', margin: '4px 8px' }} />
                <p style={{ fontSize: '0.65rem', color: '#71717a', padding: '4px 10px', margin: 0, fontWeight: 'bold' }}>AÑADIR A PLAYLIST</p>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {myPlaylists.map(pl => (
                        <button key={pl.id} onClick={() => { addToPlaylist(pl.id, track); onClose(); }} className="menu-item">
                            <ListPlus size={14} /> {pl.name}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

const MainView = ({ activeView, setView }) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [menuConfig, setMenuConfig] = useState(null);
    const [activePlaylist, setActivePlaylist] = useState(null);
    const [internalView, setInternalView] = useState(null);

    const { setQueueAndPlay, searchQuery, searchFilter } = usePlayer();

    useEffect(() => {
        if (searchQuery && searchQuery.trim() !== "") {
            if (typeof setView === 'function') setView('search');
            const delayDebounceFn = setTimeout(() => { executeSearch(searchQuery, searchFilter); }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else if (activeView === 'search') {
            if (typeof setView === 'function') setView('main'); 
        }
    }, [searchQuery, searchFilter, setView]);

    const executeSearch = async (term, filterType) => {
        setLoading(true);
        try {
            const { data } = await axios.get(`http://localhost:5002/api/search?q=${term}&type=${filterType}`);
            
            console.log("DATOS CRUDOS DEL SERVIDOR:", data); // Mira esto en la consola (F12)

            const normalizedData = data.map(item => {
                // 1. Detectar si el artista es el texto "Artista desconocido"
                const isInvalidArtist = !item.artist || item.artist === "Artista desconocido";

                // 2. Intentar buscar el nombre real en otros campos que YT suele enviar
                let realArtist = item.artist;
                
                if (isInvalidArtist) {
                    // Buscamos en author, uploader o el primer artista del array si existe
                    realArtist = item.author || (item.artists && item.artists[0]?.name) || item.album || "Klang Artist";
                }

                // 3. Limpieza de títulos (Quitamos los "Remastered", "2009", etc.)
                let cleanTitle = (item.title || item.name || "")
                    .replace(/\(Remastered.*?\)/gi, '')
                    .replace(/\[.*?\]/gi, '')
                    .trim();

                return {
                    ...item,
                    youtubeId: item.youtubeId || item.id || item.videoId,
                    title: cleanTitle,
                    artist: realArtist === "1" ? "The Beatles" : realArtist, // Parche específico para The Beatles
                    thumbnail: item.thumbnail || "https://via.placeholder.com/150"
                };
            });

            setResults(normalizedData);
        } catch (err) { 
            console.error("Error:", err); 
        } finally { 
            setLoading(false); 
        }
    };

    const openMenu = (e, track) => {
        e.stopPropagation();
        setMenuConfig({ track, position: { x: e.clientX, y: e.clientY } });
    };

    const renderContent = () => {
        if (loading) return (
            <div style={{ textAlign: 'center', marginTop: '50px', color: '#aaa' }}>
                <div className="spinner"></div><p>Buscando...</p>
            </div>
        );

        if (activeView === 'search') return (
            <div style={{ padding: '20px' }}>
                <h2 style={{ marginBottom: '20px', fontSize: '1.2rem' }}>Resultados para "{searchQuery}"</h2>
                {results.map((track) => (
                    <div key={track.youtubeId} onClick={() => setQueueAndPlay([track], 0)} className="track-row">
                        <img src={track.thumbnail} className="track-img" alt={track.title} 
                             style={{ borderRadius: searchFilter === 'artists' ? '50%' : '6px' }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="track-title">{track.title}</div>
                            <div className="track-artist">{track.artist}</div>
                        </div>
                        <button onClick={(e) => openMenu(e, track)} className="icon-btn">
                            <MoreVertical size={20} />
                        </button>
                    </div>
                ))}
            </div>
        );

        if (internalView === 'playlist-detail' && activePlaylist) {
            return (
                <PlaylistView 
                    playlist={activePlaylist} 
                    onBack={() => setInternalView(null)} 
                    onOpenMenu={openMenu}
                />
            );
        }

        if (activeView === 'library') {
            return (
                <LibraryView onSelectPlaylist={(pl) => {
                    setActivePlaylist(pl);
                    setInternalView('playlist-detail');
                }} />
            );
        }

        return (
            <HomeView 
                onSelectPlaylist={(pl) => {
                    setActivePlaylist(pl);
                    setInternalView('playlist-detail');
                }} 
                onGoToLibrary={() => {
                    if (typeof setView === 'function') setView('library');
                }}
            />
        );
    };

    return (
        <div style={{ width: '100%', minHeight: '100vh', background: '#09090b', color: 'white' }}>
            {renderContent()}
            
            {menuConfig && (
                <TrackOptionsMenu 
                    track={menuConfig.track} 
                    position={menuConfig.position} 
                    onClose={() => setMenuConfig(null)} 
                    playlistId={internalView === 'playlist-detail' ? activePlaylist?.id : null}
                />
            )}

            <style>{`
                .spinner { width: 30px; height: 30px; border: 3px solid #222; border-top: 3px solid #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                .track-row { display: flex; align-items: center; gap: 15px; padding: 10px 15px; cursor: pointer; border-radius: 10px; transition: 0.2s; }
                .track-row:hover { background: #18181b; }
                .track-row:hover .icon-btn { opacity: 1; }
                .track-img { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; }
                .track-title { font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.95rem; }
                .track-artist { font-size: 0.8rem; color: #a1a1aa; margin-top: 2px; }
                .icon-btn { background: none; border: none; color: #71717a; cursor: pointer; opacity: 0; transition: 0.2s; padding: 8px; border-radius: 50%; }
                .icon-btn:hover { color: white; background: #27272a; }
                .menu-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; background: none; border: none; color: white; cursor: pointer; border-radius: 6px; text-align: left; font-size: 0.9rem; transition: 0.2s; }
                .menu-item:hover { background: #3b82f6; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
            `}</style>
        </div>
    );
};

export default MainView;
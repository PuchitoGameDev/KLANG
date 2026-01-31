import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { ArrowLeft, Play, MoreVertical, Clock, Heart, Music, ListMusic, Zap } from 'lucide-react';
import DropdownMenu from './DropdownMenu';
import Modal from './Modal';

export default function PlaylistView({ playlist: initialPlaylist, onBack }) {
    const { 
        setQueueAndPlay, 
        updatePlaylistName, 
        deletePlaylist,
        user,
        myPlaylists, 
        startAutoLinking 
    } = usePlayer();
    
    // Sincronizamos la playlist local con los cambios globales del contexto
    const [currentPlaylist, setCurrentPlaylist] = useState(initialPlaylist);
    
    // Estados de UI
    const [isLinking, setIsLinking] = useState(false);
    const [menuConfig, setMenuConfig] = useState(null);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [tempName, setTempName] = useState(initialPlaylist.name);

    // Efecto para actualizar el nombre/tracks al instante si cambian en el contexto
    useEffect(() => {
        if (initialPlaylist.isFav) return;
        const updated = myPlaylists.find(pl => pl.id === currentPlaylist.id);
        if (updated) {
            setCurrentPlaylist(updated);
        }
    }, [myPlaylists, currentPlaylist.id, initialPlaylist.isFav]);

    const tracks = currentPlaylist.playlist_items || [];

    const getNormalizedTracks = () => tracks.map(t => {
        const finalId = t.song_id || t.id;
        const isPending = String(finalId).startsWith('pending-');
        
        return {
            ...t,
            artist: t.artist || t.author || "Artista desconocido",
            id: finalId,
            youtubeId: isPending ? null : finalId,
            isPending: isPending // Añadimos esta bandera para el filtro
        };
    });

    const handlePlayAll = () => {
        const allTracks = getNormalizedTracks();
        
        // Buscamos el índice de la primera canción que YA esté vinculada
        const firstValidIndex = allTracks.findIndex(t => !t.isPending);

        if (firstValidIndex === -1) {
            alert("Primero debes vincular las canciones (botón del rayo ⚡)");
            return;
        }

        console.log(`Reproduciendo desde la canción #${firstValidIndex + 1}`);
        setQueueAndPlay(allTracks, firstValidIndex);
    };

    // --- ACCIONES NATIVAS ---
    const confirmRename = async () => {
        if (tempName.trim() && tempName !== currentPlaylist.name) {
            await updatePlaylistName(currentPlaylist.id, tempName.trim());
        }
        setShowRenameModal(false);
    };

    const confirmDelete = async () => {
        setShowDeleteModal(false);
        onBack(); 
        await deletePlaylist(currentPlaylist.id);
    };

    const handleDelete = async (e, playlistId) => {
        e.stopPropagation(); // Evita que se reproduzca la playlist al intentar borrarla
        
        if (window.confirm("¿Estás seguro de que quieres eliminar esta playlist?")) {
            const result = await deletePlaylist(playlistId);
            if (result.success) {
                console.log("Playlist eliminada con éxito");
            } else {
                alert("No se pudo eliminar la playlist");
            }
        }
    };

    const handleLinkAll = async () => {
        if (isLinking) return;
        setIsLinking(true);
        try {
            await startAutoLinking(currentPlaylist.id);
        } catch (error) {
            console.error("Error vinculando:", error);
        } finally {
            setIsLinking(false);
        }
    };

    const openPlaylistMenu = (e) => {
        setMenuConfig({
            x: e.clientX,
            y: e.clientY,
            options: [
                { 
                    label: 'Editar nombre', 
                    onClick: () => { 
                        setTempName(currentPlaylist.name); 
                        setShowRenameModal(true); 
                    } 
                },
                { 
                    label: 'Eliminar playlist', 
                    onClick: () => setShowDeleteModal(true), 
                    variant: 'danger' 
                }
            ]
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100%', position: 'relative' }}>
            
            {/* MODAL DE RENOMBRAR */}
            {showRenameModal && (
                <Modal 
                    title="Editar nombre"
                    description="Elige un nuevo nombre para esta playlist."
                    inputValue={tempName}
                    onChange={setTempName}
                    onConfirm={confirmRename}
                    onCancel={() => setShowRenameModal(false)}
                    confirmText="Guardar"
                />
            )}

            {/* MODAL DE ELIMINAR */}
            {showDeleteModal && (
                <Modal 
                    title="¿Eliminar playlist?"
                    description={`Esto borrará "${currentPlaylist.name}" de tu biblioteca permanentemente.`}
                    onConfirm={confirmDelete}
                    onCancel={() => setShowDeleteModal(false)}
                    confirmText="Eliminar"
                    isDanger={true}
                />
            )}

            {/* MENÚ DE OPCIONES */}
            {menuConfig && <DropdownMenu {...menuConfig} onClose={() => setMenuConfig(null)} />}

            {/* CABECERA */}
            <header style={{
                padding: '60px 30px 30px 30px',
                background: 'linear-gradient(to bottom, #27272a 0%, #09090b 100%)',
                display: 'flex', alignItems: 'flex-end', gap: '30px', position: 'relative'
            }}>
                <button onClick={onBack} className="back-btn"><ArrowLeft size={20} /></button>
                <div className="hero-img-container">
                    {currentPlaylist.isFav ? (
                        <div className="hero-img-placeholder" style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}>
                            <Heart size={80} fill="white" strokeWidth={0} />
                        </div>
                    ) : tracks[0] ? (
                        <img src={tracks[0].thumbnail} alt="" className="hero-img" />
                    ) : (
                        <div className="hero-img-placeholder">
                            <Music size={60} strokeWidth={1} color="#3f3f46" />
                        </div>
                    )}
                </div>
                <div style={{ flex: 1, paddingBottom: '10px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#3b82f6' }}>Playlist</p>
                    <h1 style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: '900', margin: '10px 0', color: 'white' }}>
                        {currentPlaylist.name}
                    </h1>
                    <div style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>
                        <span style={{ color: 'white', fontWeight: 'bold' }}>Klang Player</span> • {tracks.length} canciones
                    </div>
                </div>
            </header>

            {/* ACCIONES */}
            <div style={{ padding: '30px', display: 'flex', alignItems: 'center', gap: '25px' }}>
                <button onClick={handlePlayAll} className="main-play-btn">
                    <Play size={28} fill="black" />
                </button>
                
                {/* BOTÓN AUTO-LINKER */}
                {tracks.some(t => String(t.song_id || t.id).startsWith('pending-')) && (
                    <button 
                        className="action-icon-btn linker-btn" 
                        onClick={handleLinkAll}
                        disabled={isLinking}
                        title="Vincular canciones automáticamente"
                        style={{ 
                            color: '#3b82f6', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '0.9rem', 
                            fontWeight: 'bold', 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            padding: '10px 20px', 
                            borderRadius: '20px',
                            opacity: isLinking ? 0.6 : 1,
                            cursor: isLinking ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLinking ? (
                            <span className="syncing-icon">⏳</span>
                        ) : (
                            <Zap size={20} fill="#3b82f6" />
                        )}
                        <span>{isLinking ? 'Vinculando...' : 'Vincular todo'}</span>
                    </button>
                )}

                {!currentPlaylist.isFav && (
                    <button className="action-icon-btn" onClick={openPlaylistMenu}>
                        <MoreVertical size={28} color="#a1a1aa" />
                    </button>
                )}
            </div>

            {/* LISTA DE TRACKS */}
            <div style={{ padding: '0 30px 50px 30px' }}>
                <div className="table-header">
                    <div style={{ width: '40px' }}>#</div>
                    <div style={{ flex: 1 }}>Título</div>
                    <div style={{ width: '200px' }} className="hide-mobile">Artista</div>
                    <div style={{ width: '80px', textAlign: 'center' }}>Estado</div>
                    <div style={{ width: '50px', textAlign: 'right' }}><Clock size={16} /></div>
                </div>

                {tracks.length > 0 ? (
                    getNormalizedTracks().map((track, index) => (
                        <div key={index} className="track-row" onClick={() => setQueueAndPlay(getNormalizedTracks(), index)}>
                            <div className="track-index">{index + 1}</div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <img src={track.thumbnail} style={{ width: '40px', height: '40px', borderRadius: '4px' }} alt="" />
                                <div style={{ overflow: 'hidden' }}>
                                    <div className="track-title-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                    <div className="show-mobile-only" style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>{track.artist}</div>
                                </div>
                            </div>
                            <div className="track-artist-text hide-mobile">{track.artist}</div>
                            
                            {/* INDICADOR DE ESTADO DINÁMICO */}
                            <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                                {String(track.song_id || track.id).startsWith('pending-') ? (
                                    <span title="Buscando vínculo..." className="syncing-icon">⏳</span>
                                ) : (
                                    <Zap size={14} fill="#22c55e" color="#22c55e" title="Vinculado" />
                                )}
                            </div>

                            <div style={{ width: '50px', textAlign: 'right', color: '#71717a' }}>
                                <MoreVertical size={16} />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="empty-playlist">
                        <ListMusic size={48} color="#27272a" />
                        <p>No hay canciones todavía</p>
                    </div>
                )}
            </div>

            <style>{`
                .back-btn { position: absolute; top: 25px; left: 25px; background: rgba(0,0,0,0.3); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; }
                .hero-img-container { width: 232px; height: 232px; flex-shrink: 0; box-shadow: 0 8px 40px rgba(0,0,0,0.5); }
                .hero-img { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
                .hero-img-placeholder { width: 100%; height: 100%; background: #18181b; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
                .main-play-btn { background: #3b82f6; border: none; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
                .main-play-btn:hover { transform: scale(1.05); filter: brightness(1.1); }
                .action-icon-btn { background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: 0.2s; }
                .action-icon-btn:hover { background: rgba(255,255,255,0.1); }
                .linker-btn:hover { background: rgba(59, 130, 246, 0.2) !important; transform: translateY(-1px); }
                .table-header { display: flex; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); color: #a1a1aa; font-size: 0.8rem; letter-spacing: 1px; }
                .track-row { display: flex; align-items: center; padding: 8px 15px; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
                .track-row:hover { background: rgba(255,255,255,0.1); }
                .track-index { width: 40px; color: #a1a1aa; font-family: monospace; }
                .track-title-text { color: white; font-weight: 500; font-size: 0.95rem; }
                .track-artist-text { color: #a1a1aa; font-size: 0.9rem; }
                .empty-playlist { text-align: center; padding: 60px; color: #71717a; }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .syncing-icon {
                    display: inline-block;
                    animation: spin 2s linear infinite;
                    color: #3b82f6;
                    font-size: 1.1rem;
                }
                
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.4; }
                    100% { opacity: 1; }
                }

                @media (max-width: 768px) { 
                    .hide-mobile { display: none; } 
                    .show-mobile-only { display: block; } 
                    .hero-img-container { width: 180px; height: 180px; } 
                }
                .show-mobile-only { display: none; }
            `}</style>
        </div>
    );
}
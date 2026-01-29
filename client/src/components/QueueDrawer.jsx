import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { X, Trash2, GripVertical, Zap } from 'lucide-react';

export default function QueueDrawer() {
    const { 
        isQueueOpen, 
        setIsQueueOpen, 
        queue, 
        setQueue, 
        currentTrackIndex, 
        setQueueAndPlay,
        startAutoLinking // Asegúrate de que esto esté disponible en el context
    } = usePlayer();
    
    const [draggingIndex, setDraggingIndex] = useState(null);

    // --- LÓGICA DE VINCULACIÓN AUTOMÁTICA ---
    // Cada vez que la cola cambia o avanza la canción, revisamos las 2 siguientes
    useEffect(() => {
        if (queue.length > 0 && currentTrackIndex !== -1) {
            const nextIndex1 = currentTrackIndex + 1;
            const nextIndex2 = currentTrackIndex + 2;
            
            // Si la siguiente canción es "pending", intentamos vincularla
            if (queue[nextIndex1] && String(queue[nextIndex1].id).startsWith('pending-')) {
                console.log("Vinculando próxima canción...");
                // Aquí podrías disparar una función de vinculación específica para la cola
            }
        }
    }, [queue, currentTrackIndex]);

    if (!isQueueOpen) return null;

    const handleDragStart = (e, index) => {
        setDraggingIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Evitamos que la imagen fantasma sea el elemento desapareciendo
        const dragImage = e.target.cloneNode(true);
        dragImage.style.opacity = "0.5";
    };

    const handleDragEnter = (e, targetIndex) => {
        if (draggingIndex === null || draggingIndex === targetIndex) return;

        const newQueue = [...queue];
        const itemToMove = newQueue[draggingIndex];
        
        newQueue.splice(draggingIndex, 1);
        newQueue.splice(targetIndex, 0, itemToMove);

        setDraggingIndex(targetIndex);
        setQueue(newQueue);
    };

    const handleDragEnd = () => {
        setDraggingIndex(null);
    };

    return (
        <div className="queue-overlay" onClick={() => setIsQueueOpen(false)}>
            <div className="queue-container" onClick={e => e.stopPropagation()}>
                <div className="queue-header">
                    <h3>Cola de Reproducción</h3>
                    <button onClick={() => setIsQueueOpen(false)} className="close-btn"><X size={20} /></button>
                </div>

                <div className="queue-content">
                    {queue.map((track, index) => {
                        const isPending = String(track.id || track.song_id).startsWith('pending-');
                        
                        return (
                            <div 
                                key={`${track.id}-${index}`}
                                className={`queue-item 
                                    ${index === currentTrackIndex ? 'active' : ''} 
                                    ${draggingIndex === index ? 'is-dragging' : ''}
                                `}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnter={(e) => handleDragEnter(e, index)}
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="drag-handle">
                                    <GripVertical size={16} />
                                </div>
                                
                                <div className="queue-item-info" onClick={() => setQueueAndPlay(queue, index)}>
                                    <div className="img-container">
                                        <img src={track.thumbnail} alt="" />
                                        {isPending && <div className="pending-badge"><Zap size={10} fill="currentColor" /></div>}
                                    </div>
                                    <div className="track-details">
                                        <p className="title">{track.title}</p>
                                        <p className="artist">{track.artist}</p>
                                    </div>
                                </div>

                                <button onClick={() => setQueue(queue.filter((_, i) => i !== index))} className="remove-btn">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                .queue-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: flex-end; backdrop-filter: blur(4px); }
                .queue-container { width: 350px; height: 100%; background: #0c0c0e; border-left: 1px solid #27272a; display: flex; flex-direction: column; }
                .queue-header { padding: 20px; border-bottom: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; color: white; }
                .queue-content { flex: 1; overflow-y: auto; padding: 10px; }
                
                .queue-item { 
                    display: flex; align-items: center; padding: 10px; border-radius: 10px; gap: 10px; margin-bottom: 5px; 
                    background: #161618; border: 1px solid transparent; color: white;
                    transition: transform 0.2s ease, background 0.2s ease;
                }

                /* ESTO CORRIGE EL FONDO NEGRO: En lugar de opacity 0, usamos una escala suave */
                .queue-item.is-dragging {
                    background: #27272a;
                    border: 1px solid #3b82f6;
                    transform: scale(1.02);
                    z-index: 10;
                }

                .queue-item.active { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4); }
                
                .img-container { position: relative; width: 40px; height: 40px; }
                .img-container img { width: 100%; height: 100%; border-radius: 4px; object-fit: cover; }
                
                .pending-badge { 
                    position: absolute; top: -4px; right: -4px; background: #eab308; 
                    color: black; border-radius: 50%; padding: 2px; display: flex;
                }

                .track-details { flex: 1; overflow: hidden; }
                .title { font-size: 0.85rem; font-weight: 500; margin: 0; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
                .artist { font-size: 0.75rem; color: #a1a1aa; margin: 0; }
                
                .drag-handle { color: #52525b; cursor: grab; padding: 5px; }
                .remove-btn { background: none; border: none; color: #3f3f46; cursor: pointer; }
                .close-btn { background: none; border: none; color: white; cursor: pointer; }
            `}</style>
        </div>
    );
}
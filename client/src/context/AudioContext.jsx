import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { initDB } from '../utils/db';

const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
    const audioRef = useRef(new Audio());
    const [queue, setQueue] = useState([]); // Lista de reproducción
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    
    // Usuario 'fake' inicial
    const [user, setUser] = useState({ id: 'local_user', name: 'Usuario' });

    // Definimos currentTrack basado en la cola y el índice actual
    const currentTrack = queue[currentIndex] || null;

    // --- SETUP INICIAL DE EVENTOS ---
    useEffect(() => {
        const audio = audioRef.current;
        audio.volume = 1.0; // Aseguramos volumen al máximo
        audio.muted = false; // Desactivamos el mute por si acaso
        

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => nextTrack();

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        // Notificaciones Nativas (Media Session API)
        if ('mediaSession' in navigator && currentTrack) {
            navigator.mediaSession.metadata = new window.MediaMetadata({
                title: currentTrack.title,
                artist: currentTrack.artist,
                artwork: [{ src: currentTrack.thumbnail }]
            });

            navigator.mediaSession.setActionHandler('play', togglePlay);
            navigator.mediaSession.setActionHandler('pause', togglePlay);
            navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
            navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        }

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [currentIndex, queue, isPlaying]); 

    // --- GESTIÓN DE REPRODUCCIÓN ---
    
    /**
     * playTrack ahora es más inteligente:
     * Si la canción no está en la cola, la añade.
     * Si ya está, salta a su posición.
     */
    const playTrack = async (track, newQueue = null) => {
        if (!track || !audioRef.current) return;

        const targetQueue = newQueue || queue;
        const trackIndex = targetQueue.findIndex(t => t.youtubeId === track.youtubeId);

        // Si el track no está en la cola actual, lo añadimos
        if (trackIndex === -1) {
            const updatedQueue = [...targetQueue, track];
            setQueue(updatedQueue);
            setCurrentIndex(updatedQueue.length - 1);
        } else {
            setCurrentIndex(trackIndex);
        }

        try {
            // 1. Parada de seguridad y limpieza
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load();

            // 2. URL con bypass de caché para el servidor Proxy
            const cleanId = track.youtubeId.trim();
            const url = `http://localhost:5002/api/stream?id=${cleanId}&v=${Date.now()}`;
            
            audioRef.current.src = url;

            // 3. Esperar a que el Proxy de Emergencia entregue los primeros bytes
            audioRef.current.oncanplay = async () => {
                try {
                    await audioRef.current.play();
                    setIsPlaying(true);
                    audioRef.current.oncanplay = null; 
                    console.log("🎵 Reproduciendo:", track.title);
                } catch (playErr) {
                    console.error("Error en auto-play:", playErr);
                }
            };

        } catch (err) {
            console.error("Error crítico en playTrack:", err);
        }
    };

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            if (audioRef.current.src) {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const nextTrack = async () => {
        if (currentIndex < queue.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            playTrack(queue[nextIndex]);
        } else if (currentTrack) {
            // MODO RADIO INFINITO: Buscar sugerencias basadas en la última canción
            console.log("♾️ Generando Radio...");
            try {
                const { data } = await axios.get(`http://localhost:5002/api/radio?videoId=${currentTrack.youtubeId}`);
                if (data && data.length > 0) {
                    const nextSong = data[0];
                    const newQueue = [...queue, nextSong];
                    setQueue(newQueue);
                    // No necesitamos llamar a setCurrentIndex aquí porque playTrack lo hará
                    playTrack(nextSong, newQueue);
                }
            } catch (e) {
                console.error("Error en Radio Infinita", e);
            }
        }
    };

    const prevTrack = () => {
        if (currentIndex > 0) {
            const prevIndex = currentIndex - 1;
            setCurrentIndex(prevIndex);
            playTrack(queue[prevIndex]);
        }
    };

    // --- SYNC DISCORD (Auto-Save) ---
    useEffect(() => {
        if (queue.length === 0) return;

        const saveToDiscord = setTimeout(() => {
            axios.post('http://localhost:5002/api/sync/save', {
                userId: user.id,
                data: { 
                    queue: queue.map(t => t.youtubeId), 
                    currentId: currentTrack?.youtubeId 
                }
            }).catch(e => console.error("Error Sync Discord", e));
        }, 5000); 

        return () => clearTimeout(saveToDiscord);
    }, [queue, currentIndex]);

    // --- FUNCIÓN DESCARGAR (OFFLINE) ---
    const downloadOffline = async (track) => {
        try {
            const response = await fetch(`http://localhost:5002/api/stream?id=${track.youtubeId}`);
            const blob = await response.blob();
            const db = await initDB();
            await db.put('audio_files', { youtubeId: track.youtubeId, blob: blob });
            alert(`"${track.title}" guardada para escuchar sin conexión`);
        } catch (e) { 
            console.error("Error en descarga offline:", e); 
        }
    };

    return (
        <AudioContext.Provider value={{ 
            currentTrack, 
            queue, 
            isPlaying, 
            currentTime, 
            duration,
            playTrack, 
            togglePlay, 
            nextTrack, 
            prevTrack, 
            downloadOffline,
            setQueue // Permitir limpiar la cola si es necesario
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useKlang = () => useContext(AudioContext);
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  // --- 1. ESTADO DE USUARIO Y SEGURIDAD (CON CACHÉ) ---
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('klang_user_cache');
    return saved ? JSON.parse(saved) : null;
  });
  const [isBanned, setIsBanned] = useState(false);

  // --- 2. SISTEMA DE AJUSTES GLOBALES ---
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('klang_settings');
    return saved ? JSON.parse(saved) : {
      crossfade: 0,
      normalize: true,
      theme: 'dark',
      language: 'es',
      quality: 'high',
      visualizerType: 'bars',
      autoPlay: true,
      showNotifications: true,
      playbackSpeed: 1.0
    };
  });

  const [showWaveform, setShowWaveform] = useState(() => {
    const saved = localStorage.getItem('setting_show_waveform');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // --- 3. ESTADOS DEL REPRODUCTOR (AUDIO Y COLA PERSISTENTE) ---
  const audioRef = useRef(new Audio());
  const [queue, setQueue] = useState(() => {
    const saved = localStorage.getItem('klang_current_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem('klang_current_index');
    return saved ? JSON.parse(saved) : -1;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [boost, setBoost] = useState(1.0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const linkingLogRef = useRef(new Set());
  

  const [currentBandeTracks, setCurrentBandeTracks] = useState([]);

  const queueRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const analyserRef = useRef(null);
  const bassFilterRef = useRef(null);
  const compressorRef = useRef(null);

  // --- 4. ESTADOS DE JAM, FAVORITOS Y PLAYLISTS ---
  const [jamCode, setJamCode] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [favoriteTracks, setFavoriteTracks] = useState([]);
  const [myPlaylists, setMyPlaylists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isGuest, setIsGuest] = useState(false);
  const [localPlaylists, setLocalPlaylists] = useState(() => {
    const saved = localStorage.getItem('klang_local_playlists');
    return saved ? JSON.parse(saved) : [];
  });
  const [localFavorites, setLocalFavorites] = useState(() => {
    const saved = localStorage.getItem('klang_local_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // --- 5. FUNCIONES DE UTILIDAD (NORMALIZACIÓN Y PERSISTENCIA) ---
  const normalizeTrackData = useCallback((track) => {
    if (!track) return null;
    let artist = "Artista Desconocido";
    if (track.artists && track.artists[0]) artist = track.artists[0].name;
    else if (track.artist) artist = track.artist;
    else if (track.author) artist = track.author;
    else if (track.channelTitle) artist = track.channelTitle;

    let title = track.title || track.name || "Canción Desconocida";
    title = title.replace(/\[.*?\]|\(.*?\)|OFFICIAL VIDEO|MUSIC VIDEO|LYRICS|HD|4K|AUDIO|FT\..*|FEAT\..*/gi, '').trim();
    artist = artist.replace(/- Topic/gi, '').trim();

    return { ...track, artist, title };
  }, []);

  const syncTrackIdToSupabase = async (pendingId, realId) => {
    if (String(pendingId).startsWith('item-')) return; // No existe en Supabase

    try {
      const { error } = await supabase
        .from('playlist_items')
        .update({ song_id: realId })
        .eq('song_id', pendingId); // Solo funcionará si pendingId es el que se guardó en la nube

      if (error) throw error;
    } catch (e) {
      console.warn("Persistencia omitida: Item local o error de red.");
    }
  };

  const updateSocialStatus = useCallback(async (track) => {
    if (!user || !track) return;
    try {
      await supabase.from('profiles').update({
        last_track_title: track.title,
        last_track_artist: track.artist,
        last_track_thumbnail: track.thumbnail,
        is_online: true,
        updated_at: new Date()
      }).eq('id', user.id);
    } catch (e) { console.error("Error social status:", e); }
  }, [user]);

  // --- 6. FUNCIONES DE BÚSQUEDA ---
  const searchYouTubeId = useCallback(async (title, artist) => {
    try {
      const cleanArtist = artist.split(',')[0].trim();
      const query = encodeURIComponent(`${title} ${cleanArtist} official audio`);
      const target = `https://inv.vern.cc/api/v1/search?q=${query}&type=video`;
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(target)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (data && data.length > 0) {
        const blackList = ['official video', 'music video', 'video clip', 'en vivo', 'live'];
        const bestMatch = data.find(v => {
          const t = v.title.toLowerCase();
          return !blackList.some(word => t.includes(word)) && v.lengthSeconds < 600;
        }) || data[0];
        return bestMatch.videoId;
      }
      return null;
    } catch (e) { return null; }
  }, []);

  // --- 7. LÓGICA DE AUDIO (GRAFO Y REPRODUCCIÓN) ---
  const ensureAudioGraph = async () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      
      // IMPORTANTE: crossOrigin debe estar antes del src
      audioRef.current.crossOrigin = "anonymous";
      
      const source = ctx.createMediaElementSource(audioRef.current);
      const gain = ctx.createGain();
      const analyser = ctx.createAnalyser();
      const bassFilter = ctx.createBiquadFilter();
      const compressor = ctx.createDynamicsCompressor();

      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.knee.setValueAtTime(40, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);

      bassFilter.type = "lowshelf";
      bassFilter.frequency.value = 200;
      bassFilter.gain.value = (boost - 1) * 20;
      analyser.fftSize = 256;

      source.connect(bassFilter);
      bassFilter.connect(compressor);
      compressor.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      gainRef.current = gain;
      analyserRef.current = analyser;
      bassFilterRef.current = bassFilter;
      compressorRef.current = compressor;
    }
    if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
  };

  const playIndex = useCallback(async (index) => {
    // 1. Validaciones iniciales
    const tracks = queueRef.current;
    const rawTrack = tracks[index];
    if (!rawTrack) return;

    // Normalización y obtención de ID
    let track = normalizeTrackData(rawTrack);
    let trackId = track.youtubeId || track.song_id || track.id;
    const audio = audioRef.current;

    // Reset de estados previo a la carga
    audio.pause();
    setIsPlaying(false);

    // 2. Manejo de IDs pendientes (Solo busca si realmente es necesario)
    // Si el track ya viene de una búsqueda o ya fue resuelto antes (_resolved), saltamos esto.
    if (!trackId || String(trackId).startsWith('pending-')) {
      if (window.electron) window.electron.ipcRenderer.send('terminal-log', `🔍 Resolviendo ID para: ${track.title}...`);
      try {
        const foundId = await searchYouTubeId(track.title, track.artist);
        if (foundId) {
          trackId = foundId;
          const nQ = [...queueRef.current];
          const updatedTrack = { 
            ...rawTrack, 
            id: foundId, 
            song_id: foundId, 
            youtubeId: foundId,
            _resolved: true 
          };
          nQ[index] = updatedTrack;
          queueRef.current = nQ;
          setQueue(nQ);
          track = normalizeTrackData(updatedTrack);
        } else {
          console.warn("⚠️ No se encontró ID, saltando...");
          if (index + 1 < tracks.length) return playIndex(index + 1);
          return;
        }
      } catch (searchError) {
        console.error("❌ Error en búsqueda:", searchError);
        return;
      }
    }

    // --- PERSISTENCIA DE SESIÓN ---
    localStorage.setItem('klang_current_queue', JSON.stringify(queueRef.current));
    localStorage.setItem('klang_current_index', index.toString());

    // 3. Intento de Reproducción Principal
    try {
      await ensureAudioGraph();
      
      const quality = settings.quality || 'medium';
      // Añadimos un pequeño timestamp para evitar cacheos corruptos del navegador
      const newSrc = `http://localhost:5002/api/stream?id=${trackId}&quality=${quality}`;

      if (audio.src !== newSrc) {
        audio.src = newSrc;
        audio.preload = "auto"; // Ayuda al navegador a priorizar la descarga
      }

      audio.playbackRate = settings.playbackSpeed || 1;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setCurrentIndex(index);
            currentIndexRef.current = index;
            audio.dataset.retrying = 'false';
            updateSocialStatus(track);

            // --- TRUCO SPOTIFY: Pre-cargar la siguiente canción ---
            if (index + 1 < tracks.length) {
              const nextTrack = tracks[index + 1];
              const nextId = nextTrack.youtubeId || nextTrack.song_id || nextTrack.id;
              // Si el ID de la siguiente ya existe, el servidor empezará a cachearla
              if (nextId && !String(nextId).startsWith('pending-')) {
                const img = new Image();
                img.src = `http://localhost:5002/api/stream?id=${nextId}&preload=true`; 
                // Esto inicia una petición silenciosa al server para que vaya descargando
              }
            }
          })
          .catch(async (err) => {
            if (err.name === 'AbortError') return;

            console.warn("⚠️ Error de stream. Reintentando con bypass...");

            // 4. Lógica de Reintento con Bypass (Regla de los 2s)
            if (audio.dataset.retrying === 'true') {
              console.error("❌ Segundo fallo. Saltando.");
              if (index + 1 < tracks.length) playIndex(index + 1);
              return;
            }

            audio.dataset.retrying = 'true';

            setTimeout(async () => {
              if (currentIndexRef.current !== index && currentIndexRef.current !== -1) return;

              // Bypass total: Forzamos al servidor a ignorar cualquier caché
              const retrySrc = `http://localhost:5002/api/stream?id=${trackId}&nocache=true&t=${Date.now()}`;
              audio.src = retrySrc;
              
              try {
                await audio.play();
                setIsPlaying(true);
                setCurrentIndex(index);
                currentIndexRef.current = index;
                audio.dataset.retrying = 'false';
              } catch (retryErr) {
                audio.dataset.retrying = 'false';
                if (index + 1 < tracks.length) playIndex(index + 1);
              }
            }, 1500); // Bajado a 1.5s para mayor agilidad
          });
      }
    } catch (err) {
      console.error("🔥 Error crítico:", err);
      setIsPlaying(false);
    }
  }, [
    settings.quality, 
    settings.playbackSpeed, 
    normalizeTrackData, 
    searchYouTubeId, 
    updateSocialStatus, 
    ensureAudioGraph
  ]);

  const setQueueAndPlay = useCallback((tracks, start = 0) => {
    if (!tracks || !tracks.length) return;

    // 1. Parada de emergencia y limpieza de buffer
    audioRef.current.pause();
    audioRef.current.src = ""; // Liberamos la conexión de red actual inmediatamente
    audioRef.current.load();   // Fuerza al navegador a olvidar el stream anterior

    // 2. Sincronización de estados (React + Referencias)
    // Usamos las referencias para que playIndex tenga los datos frescos sin esperar al re-render
    setQueue(tracks);
    setCurrentIndex(start);
    queueRef.current = tracks;
    currentIndexRef.current = start;

    // 3. Ejecución inmediata
    // Usamos un micro-task (setTimeout 0) para permitir que React procese el cambio de cola
    // antes de que playIndex intente acceder a los nuevos tracks.
    setTimeout(async () => {
      try {
        await ensureAudioGraph();
        // Llamamos a playIndex con el índice inicial
        await playIndex(start);
      } catch (err) {
        console.error("❌ Autoplay failed:", err);
      }
    }, 0);
  }, [playIndex]);

  // --- 8. VINCULACIÓN PROACTIVA (PRE-LINKER) ---

  const prefetchCooldownRef = useRef(false);

  const silentPrefetch = useCallback((id) => {
    if (!id || String(id).startsWith('pending-')) return;
    
    // Si el reproductor está cargando datos críticos, no molestamos al servidor
    if (audioRef.current.networkState === 2) return; 

    fetch(`http://localhost:5002/api/prefetch?id=${id}`, { 
      priority: 'low' 
    }).catch(() => {
      // Silencio total ante errores de pre-carga
    });
  }, []);

  const preLinkNextTracks = useCallback(async () => {
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0 || currentIndex === -1) return;
    
    // ESPERAMOS 5 SEGUNDOS: Damos prioridad absoluta al buffer de la canción actual
    setTimeout(async () => {
      const range = [currentIndex + 1, currentIndex + 2];

      for (const nextIdx of range) {
        const track = currentQueue[nextIdx];
        if (!track) continue;

        const trackId = track.song_id || track.id;

        if (String(trackId).startsWith('pending-')) {
          const tempId = trackId;
          const foundId = await searchYouTubeId(track.title, track.artist);
          
          if (foundId) {
            setQueue(prev => {
              const updated = [...prev];
              if (updated[nextIdx] && (updated[nextIdx].song_id === tempId || updated[nextIdx].id === tempId)) {
                updated[nextIdx] = { ...updated[nextIdx], id: foundId, youtubeId: foundId, song_id: foundId };
              }
              return updated;
            });
            syncTrackIdToSupabase(tempId, foundId);
            silentPrefetch(foundId); 
          }
        } else if (trackId && !track._prefetchedServer) {
          silentPrefetch(trackId);
          track._prefetchedServer = true; 
        }
      }
    }, 5000); // El retraso de 5 seg evita el colapso inicial
  }, [currentIndex, searchYouTubeId, silentPrefetch, syncTrackIdToSupabase]);

  // --- 11. PLAYLISTS Y FAVORITOS ---
  const loadUserData = useCallback(async (forcedUserId = null) => {
    // 1. Identificar al usuario
    const userId = forcedUserId || user?.id;
    
    // 2. RECUPERACIÓN INMEDIATA (Sincrona)
    // Leemos del disco antes de cualquier IF para tener datos listos ya mismo
    const savedLocalPlaylists = JSON.parse(localStorage.getItem('klang_local_playlists') || '[]');
    const savedLocalFavs = JSON.parse(localStorage.getItem('klang_local_favorites') || '[]');

    // 3. ESTADO INICIAL (Reactivo)
    // Llenamos el estado con lo local inmediatamente. Si el usuario es invitado, 
    // esto es lo que verá. Si tiene cuenta, esto es lo que verá mientras carga la nube.
    setMyPlaylists(savedLocalPlaylists);
    setPlaylists(savedLocalPlaylists);
    setFavoriteTracks(savedLocalFavs);
    setFavorites(savedLocalFavs.map(f => f.song_id || f.id));

    // 4. SI NO HAY USUARIO, PARAMOS AQUÍ (Ya hemos cargado lo local)
    if (!userId) {
      if (window.electron) window.electron.ipcRenderer.send('terminal-log', "📂 Playlists locales cargadas (Modo Invitado)");
      return;
    }

    // 5. INTENTO DE SINCRONIZACIÓN CON LA NUBE (Supabase)
    try {
      if (window.electron) window.electron.ipcRenderer.send('terminal-log', "☁️ Sincronizando con Supabase...");
      
      const [favsRes, plsRes] = await Promise.all([
        supabase.from('favorites').select('*').eq('user_id', userId),
        supabase.from('playlists').select(`*, playlist_items (*)`).eq('user_id', userId)
      ]);

      if (favsRes.error || plsRes.error) throw new Error("Error en respuesta de servidor");

      // Si hay datos en la nube, sobreescribimos el estado local con el de la nube
      if (favsRes.data) {
        setFavorites(favsRes.data.map(f => f.song_id));
        setFavoriteTracks(favsRes.data);
      }
      if (plsRes.data) {
        setMyPlaylists(plsRes.data);
        setPlaylists(plsRes.data);
      }
      
      if (window.electron) window.electron.ipcRenderer.send('terminal-log', "✅ Datos de usuario sincronizados");
    } catch (e) {
      console.warn("⚠️ Modo Offline: Manteniendo datos locales.", e.message);
      // No hace falta hacer nada en el catch porque ya cargamos lo local en el paso 3
    }
  }, [user?.id]);

  // --- 10. GESTIÓN DE USUARIO Y SEGURIDAD ---
  const handleUser = useCallback(async (session) => {
    if (!session?.user) { 
      setUser(null); 
      localStorage.removeItem('klang_user_cache');
      setFavorites([]);
      setFavoriteTracks([]);
      setMyPlaylists([]);
      setIsBanned(false); // Resetear estado de baneo al cerrar sesión
      return; 
    }
    
    setUser(session.user);
    localStorage.setItem('klang_user_cache', JSON.stringify(session.user));
    loadUserData(session.user.id);

    // --- NUEVA LÓGICA DE SEGURIDAD RESILIENTE ---
    try {
      // Intentamos verificar el baneo con un tiempo límite de 3 segundos
      const { data: banned, error } = await Promise.race([
        supabase.from('banned_users').select('*').eq('user_id', session.user.id).maybeSingle(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
      ]);

      // Solo bloqueamos si Supabase responde afirmativamente que el usuario está en la tabla
      if (!error && banned) {
        setIsBanned(true);
        await supabase.auth.signOut();
      } else {
        // Si no hay baneo o hay un error de red/timeout, permitimos el acceso
        setIsBanned(false);
      }
    } catch (e) { 
      // En caso de error (sin internet, base de datos caída), el baneo NO bloquea la app
      console.warn("⚠️ Verificación de seguridad omitida (Modo Offline/Error):", e.message);
      setIsBanned(false); 
    }
  }, [loadUserData]);

  // --- 9. EFECTOS DE SINCRONIZACIÓN Y PERSISTENCIA ---
  useEffect(() => {
    const initAuth = async () => {
      // A. CARGA AGRESIVA: Antes de mirar internet, cargamos lo que hay en el disco
      // Esto hace que las playlists aparezcan en menos de 100ms
      await loadUserData(); 

      const cached = localStorage.getItem('klang_user_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setUser(parsed);
          // Recargamos específicamente para este usuario
          await loadUserData(parsed.id); 
        } catch (e) { console.error("Error caché:", e); }
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await handleUser(session);
        }
      } catch (e) {
        console.warn("Supabase offline - Usando modo local");
      } finally {
        // Marcamos como cargado solo después de intentar la sesión
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await handleUser(session);
      }
      setIsLoading(false);
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [loadUserData, handleUser]);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  useEffect(() => {
    // Guardamos estado actual para persistencia
    localStorage.setItem('klang_current_queue', JSON.stringify(queue));
    localStorage.setItem('klang_current_index', JSON.stringify(currentIndex));

    // Esperamos 1.5 segundos de estabilidad antes de empezar a trabajar en segundo plano
    // para no robar ancho de banda a la canción que acaba de empezar.
    const timer = setTimeout(() => {
      preLinkNextTracks();
    }, 1500); 

    return () => clearTimeout(timer);
  }, [queue.length, currentIndex, preLinkNextTracks]);

  useEffect(() => {
    localStorage.setItem('klang_settings', JSON.stringify(settings));
    if (audioRef.current) audioRef.current.playbackRate = settings.playbackSpeed;
  }, [settings]);

  // --- 12. EVENTOS DEL NODO DE AUDIO ---
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      if (!audio.seeking) {
        setCurrentTime(audio.currentTime);

        // Pre-carga agresiva: Si faltan menos de 45 segundos, despertamos la siguiente canción
        const remaining = audio.duration - audio.currentTime;
        if (remaining > 0 && remaining < 45) {
          const nextTrack = queueRef.current[currentIndexRef.current + 1];
          if (nextTrack) {
            const nextId = nextTrack.youtubeId || nextTrack.song_id || nextTrack.id;
            if (nextId && !String(nextId).startsWith('pending-') && !nextTrack._prefetchedServer) {
              silentPrefetch(nextId);
              nextTrack._prefetchedServer = true; 
            }
          }
        }
      }
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    
    const handleEnded = () => {
      if (currentIndexRef.current + 1 < queueRef.current.length) {
        playIndex(currentIndexRef.current + 1);
      } else {
        setIsPlaying(false);
      }
    };

    const handleError = (e) => {
      console.error("Fallo de stream");
      // Detener si hay demasiados fallos seguidos
      if (retryCount > 2) {
          stopPlayback();
          alert("Error de conexión. Revisa los binarios o cookies.");
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [playIndex, isPlaying, silentPrefetch]);

  useEffect(() => { audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    if (bassFilterRef.current) bassFilterRef.current.gain.value = (boost - 1) * 20;
  }, [boost]);

  // --- 13. ACCIONES DE UI ---
  const fetchMyPlaylists = useCallback(() => loadUserData(), [loadUserData]);

  const loginWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { access_type: 'offline', prompt: 'select_account' } }
      });
      if (error) throw error;
    } catch (e) { alert("Error Google Login: " + e.message); }
  };

  const updateSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const toggleWaveform = () => setShowWaveform(prev => !prev);
  
  const toggleFavorite = async (track) => {
    const clean = normalizeTrackData(track);
    const trackId = clean.youtubeId || clean.song_id || clean.id;

    // --- 1. INTENTO CON LA NUBE (Si hay usuario) ---
    if (user) {
      try {
        if (favorites.includes(trackId)) {
          // Intentar borrar de la nube
          const { error } = await supabase.from('favorites')
            .delete()
            .eq('user_id', user.id)
            .eq('song_id', trackId);
          
          if (error) throw error;
          setFavorites(prev => prev.filter(id => id !== trackId));
          setFavoriteTracks(prev => prev.filter(f => (f.song_id || f.id) !== trackId));
        } else {
          // Intentar insertar en la nube
          const { error } = await supabase.from('favorites').insert({ 
            user_id: user.id, 
            song_id: trackId, 
            title: clean.title, 
            artist: clean.artist, 
            thumbnail: clean.thumbnail 
          });

          if (error) throw error;
          setFavorites(prev => [trackId, ...prev]);
          setFavoriteTracks(prev => [clean, ...prev]);
        }
        
        if (window.electron) window.electron.ipcRenderer.send('terminal-log', "☁️ Favorito sincronizado en la nube");
        return; // Éxito en la nube, salimos de la función

      } catch (e) {
        console.warn("⚠️ Fallo en la nube, usando almacenamiento local de respaldo:", e.message);
        // Si llegamos aquí, es que Supabase falló (Error 400, sin internet, etc.)
        // No salimos con 'return', dejamos que el código siga hacia la lógica local
      }
    }

    // --- 2. FALLBACK: LÓGICA LOCAL (Si no hay usuario o falló la nube) ---
    let updatedLocal;
    if (favorites.includes(trackId)) {
      // Quitar de local
      updatedLocal = localFavorites.filter(f => (f.youtubeId || f.song_id || f.id) !== trackId);
    } else {
      // Añadir a local
      updatedLocal = [clean, ...localFavorites];
    }

    // Actualizar estados y persistencia en disco
    setLocalFavorites(updatedLocal);
    setFavoriteTracks(updatedLocal);
    setFavorites(updatedLocal.map(f => f.youtubeId || f.song_id || f.id));
    localStorage.setItem('klang_local_favorites', JSON.stringify(updatedLocal));

    if (window.electron) {
      window.electron.ipcRenderer.send('terminal-log', `💾 Favorito guardado localmente (Backup)`);
    }
  };

  const addTrackToPlaylist = async (playlistId, track) => {
      const clean = normalizeTrackData(track);
      let finalId = clean.youtubeId || clean.id;

      // Aseguramos formato de ID pendiente si no es de YouTube
      if (!clean.youtubeId && !String(finalId).startsWith('pending-') && String(finalId).length !== 11) {
        finalId = `pending-${finalId}`;
      }

      // 1. INTENTO EN LA NUBE (Si hay usuario)
      if (user && !String(playlistId).startsWith('local-')) {
        try {
          const { error } = await supabase.from('playlist_items').insert([{
            playlist_id: playlistId,
            song_id: finalId,
            title: clean.title,
            artist: clean.artist,
            thumbnail: clean.thumbnail
          }]);

          if (!error) {
            await loadUserData(); // Recargar de la nube
            
            // --- AUTO-VINCULACIÓN AUTOMÁTICA ---
            if (String(finalId).startsWith('pending-')) {
                startAutoLinking(playlistId);
            }
            
            return { success: true, mode: 'cloud' };
          }
          // Si hay error (como el 400 que te salía), no hacemos throw, pasamos al modo local
          console.warn("Error en Supabase, reintentando guardar localmente...");
        } catch (e) {
          console.error("Fallo de conexión con la nube:", e);
        }
      }

      // 2. FALLBACK: GUARDADO LOCAL (Si no hay usuario, es playlist local o falló la nube)
      try {
        const updatedLocal = localPlaylists.map(pl => {
          if (pl.id === playlistId) {
            const newItem = {
              id: `local-item-${Math.random()}`,
              playlist_id: playlistId,
              song_id: finalId,
              title: clean.title,
              artist: clean.artist,
              thumbnail: clean.thumbnail,
              created_at: new Date().toISOString()
            };
            return { ...pl, playlist_items: [...(pl.playlist_items || []), newItem] };
          }
          return pl;
        });

        setLocalPlaylists(updatedLocal);
        localStorage.setItem('klang_local_playlists', JSON.stringify(updatedLocal));
        
        // Forzar actualización visual
        setMyPlaylists(updatedLocal);
        
        if (window.electron) window.electron.ipcRenderer.send('terminal-log', `💾 Canción guardada localmente en playlist: ${playlistId}`);

        // --- AUTO-VINCULACIÓN AUTOMÁTICA ---
        if (String(finalId).startsWith('pending-')) {
            startAutoLinking(playlistId);
        }

        return { success: true, mode: 'local' };
      } catch (localError) {
        return { success: false, error: localError.message };
      }
  };

  const deletePlaylist = async (playlistId) => {
    // 1. DETERMINAR SI ES LOCAL O NUBE
    const isLocal = String(playlistId).startsWith('local-');

    // 2. LÓGICA PARA MODO NUBE (Si hay usuario y no es ID local)
    if (user && !isLocal) {
      try {
        if (window.electron) window.electron.ipcRenderer.send('terminal-log', `☁️ Eliminando playlist de la nube: ${playlistId}`);
        
        const { error } = await supabase
          .from('playlists')
          .delete()
          .eq('id', playlistId)
          .eq('user_id', user.id);

        if (error) throw error;
        
        // Refrescamos datos de la nube
        await loadUserData();
        return { success: true };
      } catch (e) {
        console.error("Error eliminando en nube:", e);
        // Si falla la nube, no hacemos nada más para evitar borrar algo que sigue ahí
        return { success: false, error: e.message };
      }
    }

    // 3. LÓGICA PARA MODO LOCAL / INVITADO
    try {
      if (window.electron) window.electron.ipcRenderer.send('terminal-log', `🗑️ Borrando playlist local: ${playlistId}`);
      
      const updatedLocal = localPlaylists.filter(pl => pl.id !== playlistId);
      
      // Actualizamos estado y persistencia
      setLocalPlaylists(updatedLocal);
      localStorage.setItem('klang_local_playlists', JSON.stringify(updatedLocal));
      
      // Actualizamos la UI inmediatamente
      setMyPlaylists(updatedLocal);
      setPlaylists(updatedLocal);
      
      return { success: true };
    } catch (e) {
      console.error("Error eliminando local:", e);
      return { success: false };
    }
  };

  const startAutoLinking = useCallback(async (playlistId) => {
    if (linkingLogRef.current.has(playlistId)) return;
    linkingLogRef.current.add(playlistId);

    try {
      const playlist = myPlaylists.find(pl => pl.id === playlistId);
      if (!playlist || !playlist.playlist_items) return;

      const isLocal = String(playlistId).startsWith('local-');
      const pendingTracks = playlist.playlist_items.filter(item => 
        String(item.song_id || item.id).startsWith('pending-')
      );

      if (pendingTracks.length === 0) return;

      let updatedPlaylistItems = [...playlist.playlist_items];

      for (const item of pendingTracks) {
        try {
          const foundId = await searchYouTubeId(item.title, item.artist);
          
          if (foundId) {
            // 1. Actualización en memoria (UI inmediata)
            updatedPlaylistItems = updatedPlaylistItems.map(track => 
              (track.id === item.id || track.song_id === item.song_id)
              ? { ...track, song_id: foundId, id: foundId, youtubeId: foundId, _linked: true }
              : track
            );

            setMyPlaylists(prev => prev.map(pl => 
              pl.id === playlistId ? { ...pl, playlist_items: updatedPlaylistItems } : pl
            ));

            // 2. Persistencia en Nube
            if (user && !isLocal) {
              await supabase.from('playlist_items').update({ song_id: foundId }).eq('id', item.id);
              if (window.electron) window.electron.ipcRenderer.send('terminal-log', `🔗 Vinculado (Cloud): ${item.title}`);
            }
          }
        } catch (err) {
          console.warn(`Error vinculando track:`, err);
        }
        await new Promise(r => setTimeout(r, 250)); // Delay para evitar 429 (Too Many Requests)
      }

      // 3. Persistencia Final Local
      if (isLocal || !user) {
        const savedLocals = JSON.parse(localStorage.getItem('klang_local_playlists') || '[]');
        const finalLocal = savedLocals.map(pl => 
          pl.id === playlistId ? { ...pl, playlist_items: updatedPlaylistItems } : pl
        );
        setLocalPlaylists(finalLocal);
        localStorage.setItem('klang_local_playlists', JSON.stringify(finalLocal));
        if (window.electron) window.electron.ipcRenderer.send('terminal-log', `💾 Cambios guardados en local storage`);
      }

    } catch (e) {
      console.error("Error crítico en AutoLinking:", e);
    } finally {
      linkingLogRef.current.delete(playlistId);
    }
  }, [myPlaylists, searchYouTubeId, user]);

  //const startAutoLinking = useCallback(async (playlistId) => {
  //  const playlist = myPlaylists.find(pl => pl.id === playlistId);
  //  if (!playlist) return;

  //  const pendingTracks = playlist.playlist_items.filter(item => 
  //    String(item.song_id).startsWith('pending-')
  //  );

  //  for (const item of pendingTracks) {
  //    const foundId = await searchYouTubeId(item.title, item.artist);
  //    if (foundId) {
  //      await supabase.from('playlist_items').update({ song_id: foundId }).eq('id', item.id);
  //      if (window.electron) window.electron.ipcRenderer.send('terminal-log', `🔗 Vinculado: ${item.title}`);
  //    }
  //    await new Promise(r => setTimeout(r, 1000));
  //  }
  //  loadUserData();
  //}, [myPlaylists, searchYouTubeId, loadUserData]);

  const seek = useCallback((t) => {
    const audio = audioRef.current;
    if (!audio) return;
    const targetTime = Math.max(0, Math.min(t, audio.duration || 0));
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  }, []);

  const skip = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio || isNaN(audio.duration)) return;
    let newTime = audio.currentTime + seconds;
    audio.currentTime = Math.max(0, Math.min(newTime, audio.duration));
    setCurrentTime(audio.currentTime);
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(async () => {
    try {
      const track = queueRef.current[currentIndexRef.current];
      if (!audioRef.current.src || audioRef.current.src === window.location.href) {
        if (track) return playIndex(currentIndexRef.current);
      }
      await ensureAudioGraph();
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) { console.error(err); }
  }, [playIndex]);

  const createPlaylist = async (name, tracks = []) => {
    const localId = `local-${Date.now()}`;
    const newLocalPlaylist = {
      id: localId,
      name,
      user_id: user ? user.id : 'guest',
      created_at: new Date().toISOString(),
      playlist_items: tracks.map(t => ({
        ...t,
        id: `item-${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString()
      }))
    };

    // 1. INTENTO EN LA NUBE
    if (user) {
      try {
        const { data: playlist, error } = await supabase
          .from('playlists')
          .insert([{ name, user_id: user.id }])
          .select().single();

        if (error) throw error;

        if (tracks.length > 0) {
          const items = tracks.map(t => ({
            playlist_id: playlist.id,
            song_id: t.song_id || t.id,
            title: t.title,
            artist: t.artist,
            thumbnail: t.thumbnail
          }));
          await supabase.from('playlist_items').insert(items);
        }

        await loadUserData(user.id);
        startAutoLinking(playlist.id);
        return playlist;
      } catch (e) {
        console.warn("⚠️ Error en nube, creando copia local...", e.message);
      }
    }

    // 2. FALLBACK LOCAL
    const updatedLocal = [newLocalPlaylist, ...localPlaylists];
    setLocalPlaylists(updatedLocal);
    setMyPlaylists(updatedLocal);
    localStorage.setItem('klang_local_playlists', JSON.stringify(updatedLocal));

    if (window.electron) window.electron.ipcRenderer.send('terminal-log', `💾 Playlist "${name}" local activada`);
    
    startAutoLinking(localId);
    return newLocalPlaylist;
  };

  const importSpotifyPlaylist = useCallback(async (playlistData) => {
    try {
      const initialTracks = playlistData.tracks.map(t => ({
        song_id: `pending-${Math.random().toString(36).substr(2, 9)}`,
        title: t.title,
        artist: t.artist,
        thumbnail: t.image,
      }));
      const result = await createPlaylist(playlistData.name, initialTracks);
      if (result) {
        startAutoLinking(result.id);
        return { success: true };
      }
      return { success: false };
    } catch (error) { return { success: false, error: error.message }; }
  }, [createPlaylist, startAutoLinking]);

  const loadBandeTracks = async (bandId) => {
    const { data, error } = await supabase.from('band_playlist_items').select('*').eq('band_id', bandId).order('created_at', { ascending: true });
    if (!error) setCurrentBandeTracks(data);
  };

  const subscribeToBande = (bandId) => {
    const channel = supabase.channel(`bande_tracks_${bandId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'band_playlist_items', filter: `band_id=eq.${bandId}` }, 
      (payload) => setCurrentBandeTracks(prev => [...prev, payload.new]))
      .subscribe();
    return () => supabase.removeChannel(channel);
  };

  // Restauración de sesión de audio persistente
  useEffect(() => {
    const savedQueue = localStorage.getItem('klang_current_queue');
    const savedIndex = localStorage.getItem('klang_current_index');

    if (savedQueue) {
      const parsed = JSON.parse(savedQueue);
      setQueue(parsed);
      queueRef.current = parsed;
    }
    
    if (savedIndex) {
      const idx = parseInt(savedIndex, 10);
      setCurrentIndex(idx);
      currentIndexRef.current = idx;

      const track = JSON.parse(savedQueue || "[]")[idx];
      if (track) {
        const trackId = track.youtubeId || track.song_id || track.id;
        audioRef.current.src = `http://localhost:5002/api/stream?id=${trackId}`;
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Si no hay usuario, inyectamos los datos locales en el estado global
      setMyPlaylists(localPlaylists);
      setPlaylists(localPlaylists);
      setFavorites(localFavorites.map(f => f.song_id || f.id));
      setFavoriteTracks(localFavorites);
    }
  }, [user, localPlaylists, localFavorites]);

  const enterAsGuest = useCallback(() => {
    setIsGuest(true);
    setUser(null);
    localStorage.removeItem('klang_user_cache');
    
    // Forzamos la carga de playlists locales e indicamos que ya no carga
    loadUserData();
    setIsLoading(false); 
    
    if (window.electron) {
      window.electron.ipcRenderer.send('terminal-log', "👤 Acceso como invitado: Playlists locales activas");
    }
  }, [loadUserData]);

  const playSearchResult = useCallback((track, results) => {
    if (!results || results.length === 0) return;
    
    // OPTIMIZACIÓN: Marcamos los resultados como "ya resueltos" 
    // para que playIndex no intente buscar el ID en YouTube de nuevo.
    const optimizedResults = results.map(t => ({
      ...t,
      // Si viene de YouTube Search, el ID ya es el correcto
      song_id: t.videoId || t.id || t.song_id,
      youtubeId: t.videoId || t.id || t.song_id,
      _resolved: true // Esta flag es la que hace que playIndex sea instantáneo
    }));

    // Encontramos el índice de la canción elegida usando el ID optimizado
    const trackId = track.videoId || track.song_id || track.id;
    const index = optimizedResults.findIndex(t => (t.song_id || t.id) === trackId);
    
    // Seteamos la cola con los resultados ya "curados"
    setQueueAndPlay(optimizedResults, index >= 0 ? index : 0);
    
    if (window.electron) {
      window.electron.ipcRenderer.send('terminal-log', `🔍 Reproducción instantánea desde búsqueda: ${track.title}`);
    }
  }, [setQueueAndPlay]);

  useEffect(() => {
    if (!user || isGuest) {
      setMyPlaylists(localPlaylists);
      setPlaylists(localPlaylists);
    }
  }, [localPlaylists, user, isGuest]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      const query = searchQuery.toLowerCase();
      const tracksInPlaylists = localPlaylists.flatMap(pl => pl.playlist_items || []);
      const allLocalTracks = [...tracksInPlaylists, ...localFavorites];

      const filtered = allLocalTracks.filter(track => 
        track.title?.toLowerCase().includes(query) || 
        track.artist?.toLowerCase().includes(query)
      );

      const uniqueResults = Array.from(new Map(filtered.map(item => [item.song_id || item.id, item])).values());
      setSearchResults(uniqueResults);
    }, 150); // 150ms de respiro para la CPU

    return () => clearTimeout(timer);
  }, [searchQuery, localPlaylists, localFavorites]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      const query = searchQuery.toLowerCase();
      // Aplanamos todas las canciones disponibles en local
      const tracksInPlaylists = localPlaylists.flatMap(pl => pl.playlist_items || []);
      const allLocalTracks = [...tracksInPlaylists, ...localFavorites];

      const filtered = allLocalTracks.filter(track => 
        track.title?.toLowerCase().includes(query) || 
        track.artist?.toLowerCase().includes(query)
      );

      // Eliminamos duplicados por ID
      const uniqueResults = Array.from(
        new Map(filtered.map(item => [item.song_id || item.id, item])).values()
      );
      
      setSearchResults(uniqueResults);
    }, 150); // Debounce para no saturar el render

    return () => clearTimeout(timer);
  }, [searchQuery, localPlaylists, localFavorites]);

  if (isBanned === true) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#09090b', 
        color: '#ff4444',
        fontFamily: 'Plus Jakarta Sans'
      }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '800' }}>ACCESO RESTRINGIDO</h1>
        <p style={{ color: '#a1a1aa' }}>Esta cuenta ha sido suspendida de la red KLANG.</p>
      </div>
    );
  }

  return (
    <PlayerContext.Provider value={{
      user, isLoading,
      loginWithGoogle,
      logout: async () => { 
        if (user) await supabase.from('profiles').update({ is_online: false }).eq('id', user.id);
        await supabase.auth.signOut(); 
        setUser(null); 
        localStorage.removeItem('klang_user_cache');
      },
      settings, updateSetting,
      showWaveform, toggleWaveform,
      searchResults,
      playSearchResult,
      deletePlaylist,
      isGuest, setIsGuest, enterAsGuest,
      currentTrack: queue[currentIndex] ? normalizeTrackData(queue[currentIndex]) : null,
      favorites, favoriteTracks, toggleFavorite,
      myPlaylists, loadUserData, createPlaylist, playlists, fetchMyPlaylists, addTrackToPlaylist,
      searchQuery, setSearchQuery, startAutoLinking,
      isQueueOpen, setIsQueueOpen, seek, skip, resume, pause,
      importSpotifyPlaylist, queue, setQueue,
      isPlaying, currentTime, duration, volume, setVolume, boost, setBoost,
      playIndex, 
      nextTrack: () => { if (currentIndex < queue.length - 1) playIndex(currentIndex + 1); },
      prevTrack: () => { if (currentIndex > 0) playIndex(currentIndex - 1); },
      setQueueAndPlay,
      currentBandeTracks, loadBandeTracks, subscribeToBande,
      addTrackToBande: async (bandId, track) => {
        const clean = normalizeTrackData(track);
        await supabase.from('band_playlist_items').insert([{
          band_id: bandId, song_id: clean.youtubeId || clean.id,
          title: clean.title, artist: clean.artist, thumbnail: clean.thumbnail, added_by: user.id
        }]);
      },
      jamCode, setJamCode,
      analyser: analyserRef.current
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
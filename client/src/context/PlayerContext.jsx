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
  const [isQueueOpen, setIsQueueOpen] = useState(false);

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
    try {
      const { error } = await supabase
        .from('playlist_items')
        .update({ song_id: realId })
        .eq('song_id', pendingId);

      if (error) throw error;
      if (window.electron) window.electron.ipcRenderer.send('terminal-log', `💾 ID Persistido en DB: ${realId}`);
    } catch (e) {
      console.error("Error persistencia Supabase:", e);
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
    const tracks = queueRef.current;
    const rawTrack = tracks[index];
    if (!rawTrack) return;

    let track = normalizeTrackData(rawTrack);
    let trackId = track.youtubeId || track.song_id || track.id;
    const audio = audioRef.current;
    
    // Limpieza previa para evitar solapamientos visuales/sonoros
    setIsPlaying(false);
    audio.pause();

    if (String(trackId).startsWith('pending-')) {
      const tempId = trackId;
      const foundId = await searchYouTubeId(track.title, track.artist);
      
      if (foundId) {
        trackId = foundId;
        const newQueue = [...tracks];
        newQueue[index] = { ...rawTrack, youtubeId: foundId, id: foundId, song_id: foundId };
        setQueue(newQueue);
        queueRef.current = newQueue; 
        track = normalizeTrackData(newQueue[index]);
        syncTrackIdToSupabase(tempId, foundId);
      } else {
        if (index + 1 < tracks.length) return playIndex(index + 1);
        return;
      }
    }

    try {
      await ensureAudioGraph();
      const qualityParam = settings.quality === 'low' ? '&quality=low' : settings.quality === 'medium' ? '&quality=medium' : '';
      
      audio.src = `http://localhost:5002/api/stream?id=${trackId}${qualityParam}`;
      audio.preload = "auto";
      audio.playbackRate = settings.playbackSpeed;

      await audio.play();
      
      setIsPlaying(true);
      setCurrentIndex(index);
      currentIndexRef.current = index;
      updateSocialStatus(track); 

      if (settings.showNotifications && "Notification" in window && Notification.permission === "granted") {
        new Notification("Klang", { body: `${track.title} - ${track.artist}`, icon: track.thumbnail, silent: true });
      }
    } catch (err) { 
      console.error("Error en playIndex:", err);
      if (index + 1 < tracks.length) playIndex(index + 1);
    }
  }, [settings.quality, settings.playbackSpeed, settings.showNotifications, normalizeTrackData, searchYouTubeId, updateSocialStatus]);

  const setQueueAndPlay = useCallback((tracks, start = 0) => {
    if (!tracks || !tracks.length) return;

    audioRef.current.pause();
    audioRef.current.src = "";

    setQueue(tracks);
    setCurrentIndex(start);
    queueRef.current = tracks;
    currentIndexRef.current = start;

    setTimeout(async () => {
      try {
        await ensureAudioGraph();
        await playIndex(start);
      } catch (err) {
        console.error("Autoplay failed:", err);
      }
    }, 0);
  }, [playIndex]);

  // --- 8. VINCULACIÓN PROACTIVA (PRE-LINKER) ---
  const preLinkNextTracks = useCallback(async () => {
    const currentQueue = queueRef.current;
    if (currentQueue.length === 0 || currentIndex === -1) return;
    
    const range = [currentIndex + 1, currentIndex + 2, currentIndex + 3];

    await Promise.all(range.map(async (nextIdx) => {
      const track = currentQueue[nextIdx];
      if (track && String(track.song_id || "").startsWith('pending-')) {
        const tempId = track.song_id;
        const foundId = await searchYouTubeId(track.title, track.artist);
        if (foundId) {
          setQueue(prev => {
            const updated = [...prev];
            if (updated[nextIdx] && updated[nextIdx].song_id === tempId) {
              updated[nextIdx] = { ...updated[nextIdx], id: foundId, youtubeId: foundId, song_id: foundId };
            }
            return updated;
          });
          syncTrackIdToSupabase(tempId, foundId);
        }
      }
    }));
  }, [currentIndex, searchYouTubeId]);

  // --- 11. PLAYLISTS Y FAVORITOS ---
  const loadUserData = useCallback(async (forcedUserId = null) => {
    const userId = forcedUserId || user?.id;
    if (!userId) return;

    try {
      const [favsRes, playlistsRes] = await Promise.all([
        supabase.from('favorites').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('playlists').select(`*, playlist_items (*)`).eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      if (favsRes.data) {
        setFavorites(favsRes.data.map(f => f.song_id));
        setFavoriteTracks(favsRes.data);
      }

      if (playlistsRes.data) {
        const ordered = playlistsRes.data.map(pl => ({
          ...pl,
          playlist_items: (pl.playlist_items || []).sort((a, b) => 
            new Date(a.created_at) - new Date(b.created_at)
          )
        }));
        setMyPlaylists(ordered);
        setPlaylists(ordered);
      }
    } catch (e) {
      console.error("❌ Error en loadUserData:", e);
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
      return; 
    }
    
    setUser(session.user);
    localStorage.setItem('klang_user_cache', JSON.stringify(session.user));
    loadUserData(session.user.id);

    try {
      const { data: banned } = await supabase.from('banned_users').select('*').eq('user_id', session.user.id).maybeSingle();
      if (banned) {
        setIsBanned(true);
        await supabase.auth.signOut();
      }
    } catch (e) { console.error("Error seguridad:", e); }
  }, [loadUserData]);

  // --- 9. EFECTOS DE SINCRONIZACIÓN Y PERSISTENCIA ---
  useEffect(() => {
    const cached = localStorage.getItem('klang_user_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setUser(parsed);
        loadUserData(parsed.id);
      } catch (e) { console.error(e); }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        localStorage.setItem('klang_user_cache', JSON.stringify(session.user));
        loadUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem('klang_user_cache');
        setMyPlaylists([]);
        setFavoriteTracks([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  useEffect(() => {
    localStorage.setItem('klang_current_queue', JSON.stringify(queue));
    localStorage.setItem('klang_current_index', JSON.stringify(currentIndex));

    const timer = setTimeout(() => {
      preLinkNextTracks();
    }, 2000); 

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
      if (!audio.seeking) setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    
    const handleEnded = () => {
      if (currentIndexRef.current + 1 < queueRef.current.length) {
        playIndex(currentIndexRef.current + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playIndex]);

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

    if (!user) {
      // LÓGICA LOCAL
      let updated;
      if (favorites.includes(trackId)) {
        updated = localFavorites.filter(f => (f.youtubeId || f.song_id || f.id) !== trackId);
      } else {
        updated = [clean, ...localFavorites];
      }
      setLocalFavorites(updated);
      localStorage.setItem('klang_local_favorites', JSON.stringify(updated));
      return;
    }

    // LÓGICA SUPABASE (Tu código original)
    if (favorites.includes(trackId)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('song_id', trackId);
      setFavorites(prev => prev.filter(id => id !== trackId));
    } else {
      await supabase.from('favorites').insert({ 
        user_id: user.id, song_id: trackId, title: clean.title, 
        artist: clean.artist, thumbnail: clean.thumbnail 
      });
      setFavorites(prev => [trackId, ...prev]);
    }
  };

  const addTrackToPlaylist = async (playlistId, track) => {
    const clean = normalizeTrackData(track);
    let finalId = clean.youtubeId || clean.id;
    if (!clean.youtubeId && !String(finalId).startsWith('pending-') && String(finalId).length !== 11) {
      finalId = `pending-${finalId}`;
    }
    try {
      const { error } = await supabase.from('playlist_items').insert([{
        playlist_id: playlistId,
        song_id: finalId,
        title: clean.title,
        artist: clean.artist,
        thumbnail: clean.thumbnail
      }]);
      if (error) throw error;
      await loadUserData();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const startAutoLinking = useCallback(async (playlistId) => {
    const playlist = myPlaylists.find(pl => pl.id === playlistId);
    if (!playlist) return;

    const pendingTracks = playlist.playlist_items.filter(item => 
      String(item.song_id).startsWith('pending-')
    );

    for (const item of pendingTracks) {
      const foundId = await searchYouTubeId(item.title, item.artist);
      if (foundId) {
        await supabase.from('playlist_items').update({ song_id: foundId }).eq('id', item.id);
        if (window.electron) window.electron.ipcRenderer.send('terminal-log', `🔗 Vinculado: ${item.title}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    loadUserData();
  }, [myPlaylists, searchYouTubeId, loadUserData]);

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
    const newPlaylist = {
      id: `local-${Date.now()}`, // ID único local
      name,
      user_id: 'guest',
      created_at: new Date().toISOString(),
      playlist_items: tracks.map(t => ({
        ...t,
        id: `item-${Math.random()}`,
        created_at: new Date().toISOString()
      }))
    };

    if (!user) {
      // MODO LOCAL
      const updated = [newPlaylist, ...localPlaylists];
      setLocalPlaylists(updated);
      localStorage.setItem('klang_local_playlists', JSON.stringify(updated));
      setIsGuest(true);
      return newPlaylist;
    } else {
      // MODO SUPABASE (Tu código original)
      try {
        const { data: playlist, error } = await supabase.from('playlists').insert([{ name, user_id: user.id }]).select().single();
        if (error) throw error;
        if (tracks.length > 0) {
          const items = tracks.map(t => ({
            playlist_id: playlist.id,
            song_id: t.song_id,
            title: t.title,
            artist: t.artist,
            thumbnail: t.thumbnail
          }));
          await supabase.from('playlist_items').insert(items);
        }
        await loadUserData(user.id);
        return playlist;
      } catch (e) { return null; }
    }
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
    // Limpiamos el caché de usuario para evitar conflictos
    localStorage.removeItem('klang_user_cache');
    
    if (window.electron) {
      window.electron.ipcRenderer.send('terminal-log', "👤 Acceso como invitado activado");
    }
  }, []);

  if (isBanned) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#ff4444' }}>
      <h1>ACCESO RESTRINGIDO</h1>
    </div>
  );

  return (
    <PlayerContext.Provider value={{
      user, loginWithGoogle,
      logout: async () => { 
        if (user) await supabase.from('profiles').update({ is_online: false }).eq('id', user.id);
        await supabase.auth.signOut(); 
        setUser(null); 
        localStorage.removeItem('klang_user_cache');
      },
      settings, updateSetting,
      showWaveform, toggleWaveform,
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
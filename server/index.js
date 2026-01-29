// --- 1. IMPORTACIONES BÁSICAS ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Discord = require('discord.js'); 
const { getSuggestions, getArtistURL } = require('node-youtube-music');
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const axios = require('axios');

// --- NUEVO MOTOR YOUTUBE MUSIC ---
const YTMusicClass = require('ytmusic-api');
const YTMusic = YTMusicClass.default ? YTMusicClass.default : YTMusicClass;
const ytmusic = new YTMusic();

const app = express();
const PORT = process.env.PORT || 5002;

const urlCache = new Map();

app.use(cors());
app.use(express.json());

// --- 2. CONFIGURACIÓN DISCORD ---
const client = new Discord.Client({ 
    intents: [1, 32768, 33280],
    partials: ['CHANNEL'] 
});

client.once('ready', () => {
    console.log(`✅ Klang Cloud: Conectado como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ Error de Login Discord:", err.message);
});

// --- 3. MOTOR DE STREAMING (ULTRA-OPTIMIZADO) ---

app.get('/api/stream', (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).send("Falta el ID del video");

    const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');
    const denoPath = path.join(__dirname, 'deno.exe');
    const cookiesPath = path.join(__dirname, 'cookies.txt');
    
    if (urlCache.has(id)) {
        const cached = urlCache.get(id);
        if (Date.now() < cached.expires) {
            // Se añadió req aquí
            return streamFromGoogle(cached.url, res, req);
        }
    }

    const ytDlp = spawn(ytDlpPath, [
        '-g', `https://www.youtube.com/watch?v=${id}`,
        '-f', '251',
        '--cookies', cookiesPath,
        '--js-runtimes', `deno:${denoPath}`,
        '--no-check-formats', '--no-warning', '--no-check-certificate'
    ]);

    let urlData = '';
    ytDlp.stdout.on('data', (data) => { urlData += data.toString(); });
    ytDlp.on('close', (code) => {
        if (code === 0 && urlData.trim()) {
            const finalUrl = urlData.trim();
            urlCache.set(id, { url: finalUrl, expires: Date.now() + (5 * 60 * 60 * 1000) });
            // Se añadió req aquí
            streamFromGoogle(finalUrl, res, req);
        } else {
            res.status(500).send("Error en la extracción del audio");
        }
    });
});

function streamFromGoogle(url, res, req) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    };

    // Si el usuario pide un rango (seek), se lo solicitamos a Google
    if (req.headers.range) {
        headers['Range'] = req.headers.range;
    }

    https.get(url, { headers }, (proxyRes) => {
        // Establecemos el estado (200 OK o 206 Partial Content)
        res.status(proxyRes.statusCode);

        const responseHeaders = {
            'Content-Type': 'audio/webm',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
        };

        // Reenviamos cabeceras de rango si Google las proporciona
        if (proxyRes.headers['content-range']) {
            responseHeaders['Content-Range'] = proxyRes.headers['content-range'];
        }
        if (proxyRes.headers['content-length']) {
            responseHeaders['Content-Length'] = proxyRes.headers['content-length'];
        }

        res.set(responseHeaders);
        proxyRes.pipe(res);
    }).on('error', (e) => {
        console.error("❌ Error en proxy de audio:", e.message);
        if (!res.headersSent) res.status(500).send("Error de audio");
    });
}

// --- 4. NUEVO: MOTOR DE LETRAS AUTOMÁTICAS ---
/**
 * Busca letras sincronizadas (LRC) usando el ID de YouTube.
 * Utiliza el servicio gratuito LRCLIB.
 */
app.get('/api/lyrics', async (req, res) => {
    let { id, q } = req.query;

    try {
        // 1. Intentar por ID directo
        let response = await axios.get(`https://lrclib.net/api/get?youtube_id=${id}`, {
            headers: { 'User-Agent': 'KlangMusic/1.0' },
            timeout: 3000
        }).catch(() => null);

        // 2. Si no hay ID y no hay Q, intentamos obtener el título usando tu motor ytmusic
        if (!response?.data && (!q || q.trim() === "")) {
            console.log("🛠 Obteniendo metadatos de YT para búsqueda...");
            const trackInfo = await ytmusic.getSong(id).catch(() => null);
            if (trackInfo) {
                q = `${trackInfo.name} ${trackInfo.artist?.name || ''}`;
            }
        }

        // 3. Buscar por texto (Q)
        if (!response?.data && q) {
            console.log(`🔎 Buscando por texto: ${q}`);
            const searchRes = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
                headers: { 'User-Agent': 'KlangMusic/1.0' }
            });
            if (searchRes.data?.length > 0) {
                // Priorizar el que tenga letras sincronizadas
                response = { data: searchRes.data.find(s => s.syncedLyrics) || searchRes.data[0] };
            }
        }

        if (response?.data) {
            const lyrics = response.data.syncedLyrics || response.data.plainLyrics;
            return res.json({ lyrics });
        }

        res.status(404).json({ error: "Letra no encontrada" });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: "Error interno" });
    }
});

// --- 5. BÚSQUEDA (YOUTUBE MUSIC PRO) ---
app.get('/api/search', async (req, res) => {
    try {
        const { q: query, type = 'songs' } = req.query;
        if (!query) return res.json([]);

        let results = [];
        if (type === 'albums') results = await ytmusic.searchAlbums(query);
        else if (type === 'artists') results = await ytmusic.searchArtists(query);
        else results = await ytmusic.searchSongs(query);

        const cleanResults = results.map(item => {
            const getBestArtistName = (s) => {
                // 1. Si es búsqueda de artista, el nombre está en 'name'
                if (type === 'artists') return s.name || "Artista desconocido";

                // 2. Nueva estructura de ytmusicapi: item.artists es un array de objetos
                if (Array.isArray(s.artists) && s.artists.length > 0) {
                    return s.artists[0].name || s.artists[0].author || "Artista desconocido";
                }

                // 3. Algunas versiones devuelven 'artist' (en singular) como array o string
                if (s.artist) {
                    if (Array.isArray(s.artist) && s.artist.length > 0) return s.artist[0].name;
                    if (typeof s.artist === 'string') return s.artist;
                    if (typeof s.artist === 'object') return s.artist.name;
                }

                // 4. Fallback a author (videos normales de YouTube)
                if (s.author) {
                    return typeof s.author === 'string' ? s.author : (s.author.name || "Artista desconocido");
                }

                return "Artista desconocido";
            };

            return {
                youtubeId: item.videoId || item.albumId || item.browseId,
                title: item.name || item.title,
                artist: getBestArtistName(item),
                album: (item.album && typeof item.album === 'object') ? item.album.name : (item.album || "Single"),
                thumbnail: item.thumbnails && item.thumbnails.length > 0 
                    ? item.thumbnails[item.thumbnails.length - 1].url 
                    : "https://via.placeholder.com/150",
                duration: item.duration,
                type: type
            };
        });
        res.json(cleanResults);
    } catch (e) {
        res.status(500).json({ error: "Error en el motor" });
    }
});

// --- 6. RADIO Y ARTISTA ---
app.get('/api/radio', async (req, res) => {
    try {
        const suggestions = await getSuggestions(req.query.videoId);
        res.json(suggestions.map(s => ({
            youtubeId: s.youtubeId,
            title: s.title,
            artist: s.artist?.name || s.artist,
            thumbnail: s.thumbnailUrl || s.thumbnail
        })));
    } catch (e) { res.json([]); }
});

app.get('/api/artist/:id', async (req, res) => {
    try {
        const data = await getArtistURL(req.params.id);
        res.json(data);
    } catch(e) { res.status(500).send("Error"); }
});

// --- 7. SINCRONIZACIÓN DISCORD ---
app.post('/api/sync/save', async (req, res) => {
    const { userId, data } = req.body; 
    if (!userId || !data.song) return res.status(400).json({ error: "Faltan datos" });

    try {
        const channel = await client.channels.fetch(process.env.DB_CHANNEL_ID);
        const embed = {
            title: `🎵 Nueva Canción Guardada`,
            description: `**${data.song.title}**\n${data.song.artist}`,
            thumbnail: { url: data.song.thumbnail },
            color: 0x5865F2,
            footer: { text: "Klang Music Cloud Sync" }
        };
        await channel.send({ 
            content: `DATA_SYNC::${userId}::${data.song.youtubeId}`,
            embeds: [embed] 
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Error de sincronización" });
    }
});

app.get('/api/sync/load/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const channel = await client.channels.fetch(process.env.DB_CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 100 });
        const userSongs = messages
            .filter(m => m.content.startsWith(`DATA_SYNC::${userId}`))
            .map(m => {
                const embed = m.embeds[0];
                if (!embed) return null;
                return {
                    title: embed.title.replace('🎵 ', ''),
                    artist: embed.description.split('\n')[0].replace('**', ''),
                    thumbnail: embed.thumbnail?.url,
                    youtubeId: m.content.split('::')[2]
                };
            })
            .filter(Boolean);
        res.json(userSongs);
    } catch (error) {
        res.status(500).json({ error: "Error al cargar datos" });
    }
});

// --- 8. LANZAMIENTO ---
const start = async () => {
    try {
        console.log("⏳ Inicializando YouTube Music...");
        await ytmusic.initialize();
        console.log("✅ Motor de YouTube Music listo");
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor Klang activo en http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("❌ Fallo al iniciar el servidor:", err);
    }
};

start();
// --- 1. OPTIMIZACIÓN CRÍTICA DE RED ---
const dns = require('dns');
// Solo aplicamos si estamos seguros, de lo contrario dejamos que Node decida
if (typeof dns.setDefaultResultOrder === 'function') {
    // Lo ejecutamos de forma asíncrona para no detener el arranque
    setImmediate(() => {
        try { dns.setDefaultResultOrder('ipv4first'); } catch(e) {}
    });
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Discord = require('discord.js'); 
const { getSuggestions } = require('node-youtube-music');
const { spawn } = require('child_process');
const path = require('path');
const https = require('https');
const axios = require('axios');
const fs = require('fs');

// --- MOTOR YOUTUBE MUSIC ---
const YTMusicClass = require('ytmusic-api');
const YTMusic = YTMusicClass.default ? YTMusicClass.default : YTMusicClass;
const ytmusic = new YTMusic();

const app = express();
const PORT = process.env.PORT || 5002;

// --- 2. AGENTE HTTPS PERSISTENTE ---
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 100
});


// --- 2. CONFIGURACIÓN DE RUTAS Y CACHÉ PERSISTENTE ---

// Detectar si estamos en Electron empaquetado
const isProd = process.resourcesPath && process.resourcesPath.includes('resources');

// RUTA DE BINARIOS: Aquí es donde fallaba. 
// Usamos process.resourcesPath directamente si es prod.
const basePath = isProd 
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'server') 
    : __dirname;

// RUTA DE DATOS (Escritura):
const userDataPath = isProd 
    ? path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME), 'KlangMusicCloud')
    : __dirname;

const CACHE_DIR = path.join(userDataPath, 'cache_data');
const CACHE_FILE = path.join(CACHE_DIR, 'url_cache.json');

try {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
} catch (err) {
    console.error("❌ Error creando CACHE_DIR:", err);
}

console.log("🚀 Server Mode:", isProd ? "PRODUCTION" : "DEVELOPMENT");
console.log("📂 Binarios path:", basePath);

let urlCache = new Map();
const pendingExtractions = new Map();

// Cargar Caché
if (fs.existsSync(CACHE_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        urlCache = new Map(Object.entries(data));
        console.log(`📂 Caché cargado: ${urlCache.size} canciones.`);
    } catch (e) { urlCache = new Map(); }
}

// Guardado de caché con Debounce (No bloqueante)
let saveTimeout;
function scheduleSaveCache() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const obj = Object.fromEntries(urlCache);
            fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
        } catch (e) { console.error("❌ Error guardando caché:", e.message); }
    }, 10000);
}

app.use(cors());
app.use(express.json());

// --- 3. DISCORD ---
const client = new Discord.Client({ intents: [1, 32768, 33280], partials: ['CHANNEL'] });
client.once('ready', () => console.log(`✅ Klang Cloud: Conectado como ${client.user.tag}`));
setTimeout(() => {
    if (process.env.DISCORD_TOKEN) {
        client.login(process.env.DISCORD_TOKEN).catch(e => console.error("❌ Discord Error:", e.message));
    }
}, 5000);

// --- 4. EXTRACCIÓN URL (SOLO SEGUNDO PLANO) ---
async function getYoutubeUrl(id) {
    if (urlCache.has(id)) {
        const cached = urlCache.get(id);
        if (Date.now() < cached.expires) return cached.url;
    }
    if (pendingExtractions.has(id)) return pendingExtractions.get(id);

    const extractionPromise = new Promise((resolve, reject) => {
        const ytDlpPath = path.join(basePath, 'yt-dlp.exe');
        const cookiesPath = path.join(basePath, 'cookies.txt');

        const args = [
            '-g', `https://www.youtube.com/watch?v=${id}`,
            '-f', '251/bestaudio',
            '--no-check-certificate', 
            '--no-warnings', 
            '--quiet', 
            '--no-playlist',
            '--force-ipv4',
            '--no-mtime'
        ];
        if (fs.existsSync(cookiesPath)) args.push('--cookies', cookiesPath);

        const proc = spawn(ytDlpPath, args, { 
            windowsHide: true,
            detached: false, // IMPORTANTE: No lo desprendas para que muera con la app
            stdio: ['ignore', 'pipe', 'ignore'], 
            priority: 0 // Prioridad normal para no asfixiar a Electron
        });
        let output = '';
        proc.stdout.on('data', d => output += d);
        
        proc.on('close', (code) => {
            pendingExtractions.delete(id);
            const url = output.trim();
            if (code === 0 && url) {
                // Guardamos URL por 3 horas
                urlCache.set(id, { url, expires: Date.now() + (3 * 60 * 60 * 1000) });
                scheduleSaveCache();
                resolve(url);
            } else {
                reject(new Error(`yt-dlp falló (Code ${code})`));
            }
        });
    });

    pendingExtractions.set(id, extractionPromise);
    return extractionPromise;
}

// --- 5. STREAMING "ZERO WAIT" (CERO ESPERA) ---

app.get('/api/prefetch', async (req, res) => {
    const { id } = req.query;
    if (!id || urlCache.has(id)) return res.json({ status: "skipped" });
    
    // Aquí sí extraemos la URL para el futuro porque el usuario no está esperando
    getYoutubeUrl(id).catch(() => {});
    res.json({ status: "processing", id });
});

app.get('/api/stream', (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).send("Falta ID");

    // Envolvemos TODO en un setImmediate inicial. 
    // Esto hace que Electron registre el clic y libere el hilo de la UI 
    // ANTES de siquiera mirar el caché o los archivos.
    setImmediate(() => {
        try {
            if (res.writableEnded) return;

            // 1. INTENTAR CACHÉ RÁPIDO
            if (urlCache.has(id)) {
                const cached = urlCache.get(id);
                if (Date.now() < cached.expires) {
                    console.log(`🚀 [Cache Hit] Sirviendo desde Google: ${id}`);
                    return streamFromGoogle(cached.url, res, req, id);
                } else {
                    urlCache.delete(id);
                }
            }

            // 2. PRIORIDAD MÁXIMA: STREAM DIRECTO (Bypass)
            // Si no hay caché, lanzamos el pipe. 
            // El log nos confirmará si aquí es donde se produce el retraso.
            console.log(`⚡ [Cache MISS] Lanzando Fallback Pipe: ${id}`);
            fallbackPipe(id, res, req);

            // 3. SEGUNDO PLANO (CACHÉ SILENCIOSO)
            // Retrasamos la extracción 3 segundos para que no compita con el arranque del audio
            setTimeout(() => {
                getYoutubeUrl(id)
                    .then(() => console.log(`✅ [Background Cache] Guardado: ${id}`))
                    .catch(() => {}); // Ignoramos errores en segundo plano
            }, 3000);

        } catch (err) {
            console.error("❌ Error en el hilo de stream:", err);
            if (!res.headersSent) res.status(500).end();
        }
    });
});

function streamFromGoogle(url, res, req, id) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Connection': 'keep-alive'
    };
    
    if (req.headers.range) headers['Range'] = req.headers.range;

    const request = https.get(url, { 
        headers, 
        agent: httpsAgent, 
        timeout: 5000 // Bajamos a 5s para que el fallback actúe rápido si Google no responde
    }, (proxyRes) => {
        // 1. Detectar enlaces rotos de YouTube (403 Forbidden o 410 Gone)
        if (proxyRes.statusCode === 403 || proxyRes.statusCode === 410) {
            urlCache.delete(id);
            console.log(`🔄 URL caducada/bloqueada para ${id}, activando fallback...`);
            return fallbackPipe(id, res, req);
        }

        // 2. Configurar cabeceras de respuesta
        // Eliminamos las cabeceras originales de Google que puedan causar conflictos de seguridad
        const cleanHeaders = { ...proxyRes.headers };
        delete cleanHeaders['content-security-policy'];
        delete cleanHeaders['x-frame-options'];

        res.writeHead(proxyRes.statusCode, {
            ...cleanHeaders,
            'Content-Type': 'audio/webm',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache' // En streaming mejor no cachear en el navegador para evitar lag
        });

        // 3. Flujo de datos
        proxyRes.pipe(res);

        // Si la conexión con Google se corta a la mitad, intentamos salvar con el pipe
        proxyRes.on('error', () => {
            if (!res.writableEnded) fallbackPipe(id, res, req);
        });

    });

    // Manejo de errores de conexión inicial o Timeout
    request.on('error', (err) => {
        console.log(`⚠️ Google Stream Error (${err.message}). Saltando a Fallback.`);
        if (!res.writableEnded) fallbackPipe(id, res, req);
    });

    request.on('timeout', () => {
        request.destroy(); // Abortamos la petición lenta
        console.log(`⏳ Timeout en Google Stream para ${id}`);
    });
}

let activeStreams = 0;
const MAX_STREAMS = 2; // Solo permitimos 2 canciones procesándose a la vez

function fallbackPipe(id, res, req) {
    // Si ya hay demasiados procesos, cancelamos este para salvar la UI
    if (activeStreams >= MAX_STREAMS) {
        console.warn("⚠️ Máximo de procesos alcanzado. Cancelando stream.");
        if (!res.headersSent) res.status(429).send("Servidor ocupado");
        return;
    }

    activeStreams++;
    const ytDlpPath = path.join(basePath, 'yt-dlp.exe');
    const cookiesPath = path.join(basePath, 'cookies.txt');

    const args = [
        `https://www.youtube.com/watch?v=${id}`, 
        '-f', '251/bestaudio', 
        '-o', '-', 
        '--quiet', 
        '--no-playlist',
        '--force-ipv4',
        '--buffer-size', '64K'
    ];

    if (fs.existsSync(cookiesPath)) args.push('--cookies', cookiesPath);

    const proc = spawn(ytDlpPath, args, { 
        windowsHide: true,
        detached: false, // Mantenerlo unido para que muera con la app
        stdio: ['ignore', 'pipe', 'ignore'], // Evita que los logs de error bloqueen el buffer
        priority: 0 // Prioridad normal para no asfixiar a Electron
    });

    // Muy importante: no bloquees el flujo esperando eventos de escritura
    proc.stdout.on('error', () => {
        if (!proc.killed) proc.kill();
    });

    if (!res.headersSent) {
        res.writeHead(200, {
            'Content-Type': 'audio/webm',
            'Access-Control-Allow-Origin': '*',
            'Transfer-Encoding': 'chunked',
            'Connection': 'keep-alive'
        });
    }

    proc.stdout.pipe(res);

    // Limpieza total al terminar o error
    const cleanup = () => {
        if (!proc.killed) {
            proc.kill('SIGKILL');
            activeStreams = Math.max(0, activeStreams - 1);
            console.log(`♻️ Proceso liberado para ${id}. Activos: ${activeStreams}`);
        }
    };

    // Si el usuario cambia de canción o cierra la app, matamos el proceso YA
    req.on('close', cleanup);
    proc.on('close', cleanup);
    proc.on('error', cleanup);

    // Captura de errores para que el servidor no muera (Error 500)
    proc.stderr.on('data', (data) => {
        if (data.toString().includes('ERROR')) {
            console.error(`[yt-dlp error]: ${data}`);
            if (!res.writableEnded) res.end();
        }
    });
}

// --- 6. LETRAS, BÚSQUEDA Y RADIO ---
app.get('/api/lyrics', async (req, res) => {
    let { id, q } = req.query;
    try {
        let response = await axios.get(`https://lrclib.net/api/get?youtube_id=${id}`, { timeout: 3000 }).catch(() => null);
        if (!response?.data && q) {
            const searchRes = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
            if (searchRes.data?.length > 0) response = { data: searchRes.data[0] };
        }
        res.json({ lyrics: response?.data?.syncedLyrics || response?.data?.plainLyrics || null });
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, type = 'songs' } = req.query;
        if (!q) return res.json([]);
        let results = [];
        if (type === 'albums') results = await ytmusic.searchAlbums(q);
        else if (type === 'artists') results = await ytmusic.searchArtists(q);
        else results = await ytmusic.searchSongs(q);

        res.json(results.map(item => ({
            youtubeId: item.videoId || item.albumId || item.browseId,
            title: item.name || item.title,
            artist: item.artists?.[0]?.name || "Artista",
            thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url,
            type
        })));
    } catch (e) { res.status(500).json({ error: "Error" }); }
});

app.get('/api/radio', async (req, res) => {
    try {
        const s = await getSuggestions(req.query.videoId);
        res.json(s.map(i => ({ youtubeId: i.youtubeId, title: i.title, artist: i.artist?.name || i.artist, thumbnail: i.thumbnailUrl })));
    } catch (e) { res.json([]); }
});

// --- 7. SYNC ---
app.post('/api/sync/save', async (req, res) => {
    try {
        const channel = await client.channels.fetch(process.env.DB_CHANNEL_ID);
        await channel.send({ content: `DATA_SYNC::${req.body.userId}::${req.body.data.song.youtubeId}` });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Error Sync" }); }
});

app.get('/api/sync/load/:userId', async (req, res) => {
    try {
        const channel = await client.channels.fetch(process.env.DB_CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 50 });
        const songs = messages
            .filter(m => m.content.startsWith(`DATA_SYNC::${req.params.userId}`))
            .map(m => ({ youtubeId: m.content.split('::')[2] }));
        res.json(songs);
    } catch (error) { res.status(500).json({ error: "Error Load" }); }
});

// --- 8. INICIO ---
const start = async () => {
    // Verificar si yt-dlp existe antes de abrir el puerto
    const ytPath = path.join(basePath, 'yt-dlp.exe');
    if (!fs.existsSync(ytPath)) {
        console.error(`🚨 ERROR CRÍTICO: No se encontró yt-dlp.exe en ${ytPath}`);
        // Log al archivo de crash para que lo veas en el escritorio
        fs.appendFileSync(path.join(userDataPath, 'crash_log.txt'), `🚨 Binario no encontrado en: ${ytPath}\n`);
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor Klang activo en puerto ${PORT}`);
    });
    
    server.on('error', (e) => console.error("❌ Error Server:", e.code));

    try {
        ytmusic.initialize().catch(() => {});
    } catch (err) {}
};

process.on('uncaughtException', (err) => {
    // Esto creará un archivo .txt en la carpeta de la app si el servidor se rompe
    fs.appendFileSync(path.join(userDataPath, 'crash_log.txt'), 
    `[${new Date().toLocaleString()}] CRASH: ${err.message}\n${err.stack}\n\n`);
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor...');
  process.exit(0);
});

start();


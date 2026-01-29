import { openDB } from 'idb';

const DB_NAME = 'KlangDB';
const DB_VERSION = 3; // Subimos a la versión 3 para incluir la tabla de playlists

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      console.log(`Actualizando DB de versión ${oldVersion} a ${newVersion}`);

      // --- VERSIÓN 1: Estructura base ---
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'youtubeId' });
          trackStore.createIndex('artist', 'artist');
        }
      }
      
      // --- VERSIÓN 2: Soporte para letras y metadatos ---
      if (oldVersion < 2) {
        console.log("Base de datos actualizada para soporte de letras editadas.");
        // Aquí podrías añadir índices adicionales si fuera necesario
      }

      // --- VERSIÓN 3: Soporte para Playlists Importadas ---
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('playlists')) {
          // Creamos la tabla de playlists con un ID único
          const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
          playlistStore.createIndex('name', 'name');
          console.log("Tabla 'playlists' creada exitosamente.");
        }
      }
    },
  });
};

// Funciones de utilidad para facilitar el acceso desde otros componentes
export const getAllPlaylists = async () => {
  const db = await initDB();
  return db.getAll('playlists');
};

export const savePlaylist = async (playlist) => {
  const db = await initDB();
  return db.put('playlists', playlist);
};
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const { createClient } = require('@libsql/client');

// Uzak Turso veritabanı varsa onu kullan (kalıcı, ücretsiz), yoksa yerel SQLite dosyası.
// Yerel geliştirmede hiçbir env değişkeni gerekmez; otomatik olarak ./gredart.db kullanılır.
const db = process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: 'file:' + (process.env.DB_PATH || './gredart.db') });

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Temel Ayarlar
const ALLOWED_SIZES = [16, 32, 64];
const DEFAULT_BOARD_SIZE = 32;
const MAX_PLAYERS = 6;
const GAME_DURATION = 180; // Süreli mod için 3 dakika (Saniye)

// Kötüye kullanım koruması
const MAX_ROOMS = 500;                 // Aynı anda açık kalabilecek maks. oda
const ROOM_CREATE_COOLDOWN_MS = 3000;  // Aynı IP iki oda arasında bu kadar beklemeli
const roomCreateTimes = {};            // ip -> son oda kurma zamanı

// Oyun Kelimeleri ve Renkler
const WORD_LIST = [
  "Dinozor", "Uzaylı", "Korsan Gemisi", "Ejderha", "Pizza", 
  "Robot", "Gitar", "Köpekbalığı", "Şövalye", "Volkan", 
  "Uzay Mekiği", "Hamburger", "Korsan"
];
const AVATAR_COLORS = ['#e63946','#4361ee','#2dc653','#f77f00','#9b5de5','#f093fb','#00b4d8','#fb5607'];

// Odaları tutan ana obje
const rooms = {};
const sessions = {}; // { token: { name, avatarColor, pixels, roomKod, colorIndex } }
const lastPixelTime = {};

// Oda Oluşturma Fonksiyonu
function createRoom(size) {
  const boardSize = ALLOWED_SIZES.includes(size) ? size : DEFAULT_BOARD_SIZE;
  const kod = crypto.randomBytes(3).toString('hex').toUpperCase();
  rooms[kod] = {
    boardSize,
    board: Array(boardSize).fill(null).map(() => Array(boardSize).fill('#ffffff')),
    players: {},
    spectators: {},
    allowSpectatorPromotion: true,
    colorIndex: 0,
    hostId: null,
    status: 'waiting',  // waiting, playing, finished
    mode: null,         // 'timed' veya 'free'
    word: '',          
    timeLeft: 0,       
    timerInterval: null 
  };
  return kod;
}
setInterval(() => {
  const now = Date.now();
  for (const kod in rooms) {
    const room = rooms[kod];
    if (Object.keys(room.players).length === 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      delete rooms[kod];
    }
  }
}, 60_000); // every 60s

setInterval(() => {
  for (const token in sessions) {
    if (!rooms[sessions[token].roomKod]) {
      delete sessions[token];
    }
  }
  // Eski oda-kurma zaman damgalarını temizle (bellek sızıntısını önler)
  const now = Date.now();
  for (const ip in roomCreateTimes) {
    if (now - roomCreateTimes[ip] > 60_000) delete roomCreateTimes[ip];
  }
}, 5 * 60 * 1000);

// Statik Dosyalar ve Routing
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/oda/:kod', (req, res) => {
  const kod = req.params.kod.toUpperCase();
  if (!rooms[kod]) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'oda.html'));
});

// API Uçları (Endpoints)
app.post('/api/oda-kur', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (roomCreateTimes[ip] && now - roomCreateTimes[ip] < ROOM_CREATE_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Çok hızlı oda kuruyorsun, biraz bekle.' });
  }
  if (Object.keys(rooms).length >= MAX_ROOMS) {
    return res.status(503).json({ error: 'Sunucu şu an dolu, lütfen sonra tekrar dene.' });
  }

  roomCreateTimes[ip] = now;
  const size = parseInt(req.body && req.body.size);
  const kod = createRoom(size);
  res.json({ kod });
});

app.get('/api/oda/:kod', (req, res) => {
  const kod = req.params.kod.toUpperCase();
  if (rooms[kod]) {
    res.json({ 
      exists: true, 
      playerCount: Object.keys(rooms[kod].players).length, 
      maxPlayers: MAX_PLAYERS 
    });
  } else {
    res.json({ exists: false });
  }
});
db.execute(`
  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomCode TEXT,
    board TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).catch((err) => console.error('DB create table hatası:', err.message));

// Galeriyi kaydet (hem süreli mod bitişinde hem de "Bitir" butonunda kullanılır)
function saveBoardToGallery(roomCode, board) {
  return db.execute({
    sql: 'INSERT INTO boards (roomCode, board, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)',
    args: [roomCode, JSON.stringify(board)],
  })
    .then(() => console.log(`Tablo kaydedildi: ${roomCode}`))
    .catch((err) => console.error('Galeri kayıt hatası:', err.message));
}
// Gallery - list all saved boards (most recent first)
app.get('/api/gallery', async (req, res) => {
  try {
    const result = await db.execute('SELECT id, roomCode, createdAt FROM boards ORDER BY id DESC LIMIT 50');
    res.json(result.rows.map((r) => ({ id: r.id, roomCode: r.roomCode, createdAt: r.createdAt })));
  } catch (err) {
    console.error('Galeri listeleme hatası:', err.message);
    res.status(500).json({ error: 'DB hatası' });
  }
});

// Gallery - get a single board's pixel data
app.get('/api/gallery/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz id' });
  try {
    const result = await db.execute({
      sql: 'SELECT id, roomCode, board, createdAt FROM boards WHERE id = ?',
      args: [id],
    });
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ id: row.id, roomCode: row.roomCode, createdAt: row.createdAt, board: JSON.parse(row.board) });
  } catch (err) {
    res.status(404).json({ error: 'Bulunamadı' });
  }
});
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gallery.html'));
});
// Bir yer açıldığında bekleyen izleyicilere haber ver
function notifyOpenSlot(kod) {
  const room = rooms[kod];
  if (!room) return;
  if (room.spectators && Object.keys(room.spectators).length > 0
      && room.allowSpectatorPromotion
      && Object.keys(room.players).length < MAX_PLAYERS) {
    io.to(kod).emit('slot_available');
  }
}

// Soket İletişimi (Gerçek Zamanlı Altyapı)
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentKod = null;

  const sendSpectatorListToHost = () => {
    if (!currentRoom || !currentRoom.hostId) return;
    const hostSocket = io.sockets.sockets.get(currentRoom.hostId);
    if (hostSocket) hostSocket.emit('spectator_list', currentRoom.spectators || {});
  };

  // 1. Odaya Katılma
  socket.on('join_room', (data) => {
    if (!data || typeof data !== 'object' || !data.kod) return;

    const kod = data.kod.toUpperCase();
    const playerName = (data.name || 'Misafir').substring(0, 12).toUpperCase();
    const token = data.token || null;

    if (!rooms[kod]) return socket.emit('room_error', 'Oda bulunamadı.');

    const room = rooms[kod];

    // --- Reconnect: restore existing session ---
    if (token && sessions[token] && sessions[token].roomKod === kod) {
      const saved = sessions[token];

      if (Object.keys(room.players).length >= MAX_PLAYERS) {
      // Reconnecting but room is now full — demote to spectator
      currentKod = kod;
      currentRoom = room;
      socket.join(kod);
      room.spectators = room.spectators || {};
      room.spectators[socket.id] = { id: socket.id, name: saved.name };
      socket.emit('joined_as_spectator');
      socket.emit('board_state', room.board);
      socket.emit('room_info', { kod, maxPlayers: MAX_PLAYERS, hostId: room.hostId, status: room.status, mode: room.mode, word: room.word, timeLeft: room.timeLeft });
      io.to(kod).emit('spectator_count', Object.keys(room.spectators).length);
      sendSpectatorListToHost();
      return;
    }

      currentKod = kod;
      currentRoom = room;
      socket.join(kod);

      room.players[socket.id] = {
        id: socket.id,
        name: saved.name,
        avatarColor: saved.avatarColor,
        pixels: saved.pixels,
      };

      // Restore host if they were the host and no one else took it
      if (saved.wasHost && !room.hostId) {
        room.hostId = socket.id;
      }

      delete sessions[token]; // invalidate old token
      const newToken = crypto.randomBytes(16).toString('hex');
      sessions[newToken] = { name: saved.name, avatarColor: saved.avatarColor, pixels: saved.pixels, roomKod: kod, wasHost: room.hostId === socket.id };

      socket.data.sessionToken = newToken;
      socket.emit('session_token', newToken);
      socket.emit('board_state', room.board);
      socket.emit('room_info', { kod, maxPlayers: MAX_PLAYERS, hostId: room.hostId, status: room.status, mode: room.mode, word: room.word, timeLeft: room.timeLeft });
      io.to(kod).emit('players_update', room.players);
      return;
    }

    // --- Fresh join: spectator if full ---
    if (Object.keys(room.players).length >= MAX_PLAYERS) {
      currentKod = kod;
      currentRoom = room;
      socket.join(kod);
      room.spectators = room.spectators || {};
      room.spectators[socket.id] = { id: socket.id, name: playerName };

      socket.emit('joined_as_spectator');
      socket.emit('board_state', room.board);
      socket.emit('room_info', { kod, maxPlayers: MAX_PLAYERS, hostId: room.hostId, status: room.status, mode: room.mode, word: room.word, timeLeft: room.timeLeft });
      io.to(kod).emit('spectator_count', Object.keys(room.spectators).length);
      sendSpectatorListToHost();
      return;
    }

    if (Object.keys(room.players).length === 0) room.hostId = socket.id;

    currentKod = kod;
    currentRoom = room;
    socket.join(kod);

    const avatarColor = AVATAR_COLORS[room.colorIndex % AVATAR_COLORS.length];
    room.colorIndex++;
    room.players[socket.id] = { id: socket.id, name: playerName, avatarColor, pixels: 0 };

    const newToken = crypto.randomBytes(16).toString('hex');
    sessions[newToken] = { name: playerName, avatarColor, pixels: 0, roomKod: kod, wasHost: room.hostId === socket.id };

    socket.data.sessionToken = newToken;
    socket.emit('session_token', newToken);
    socket.emit('board_state', room.board);
    socket.emit('room_info', { kod, maxPlayers: MAX_PLAYERS, hostId: room.hostId, status: room.status, mode: room.mode, word: room.word, timeLeft: room.timeLeft });
    io.to(kod).emit('players_update', room.players);
  });

  // 2. Oyunu Başlatma (Host Tarafından)
  socket.on('start_game', (options) => {
    if (!currentRoom) return;
    if (socket.id !== currentRoom.hostId) return; // Sadece host başlatabilir
    if (currentRoom.status !== 'waiting') return;

    currentRoom.status = 'playing';
    currentRoom.mode = options.mode; // 'timed' veya 'free'

    if (options.mode === 'timed') {
      currentRoom.word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
      currentRoom.timeLeft = GAME_DURATION;
      
      io.to(currentKod).emit('game_started', { 
        mode: 'timed', 
        word: currentRoom.word, 
        timeLeft: currentRoom.timeLeft 
      });

      // Zamanlayıcıyı Başlat
      currentRoom.timerInterval = setInterval(() => {
        currentRoom.timeLeft--;
        io.to(currentKod).emit('time_update', currentRoom.timeLeft);
        
        if (currentRoom.timeLeft <= 0) {
          clearInterval(currentRoom.timerInterval);
          currentRoom.status = 'finished';
          io.to(currentKod).emit('game_ended');
          saveBoardToGallery(currentKod, currentRoom.board);
        }
      }, 1000);
      
    } else {
      // Serbest Mod
      currentRoom.word = 'Serbest Mod (Süresiz)';
      currentRoom.timeLeft = 0;
      io.to(currentKod).emit('game_started', { 
        mode: 'free', 
        word: currentRoom.word 
      });
    }
  });

  socket.on('finish_game', () => {
    if (!currentRoom) return;
    if (socket.id !== currentRoom.hostId) return; // Sadece host bitirebilir
    if (currentRoom.status !== 'playing') return;

    if (currentRoom.timerInterval) {
      clearInterval(currentRoom.timerInterval);
      currentRoom.timerInterval = null;
    }

    currentRoom.timeLeft = 0;
    currentRoom.status = 'finished';
    io.to(currentKod).emit('game_ended');

    saveBoardToGallery(currentKod, currentRoom.board);
  });

  // 3. Yeniden Oyna (Tabloyu Sıfırla)
  socket.on('reset_room', () => {
    if (!currentRoom) return;
    if (socket.id !== currentRoom.hostId) return; // Sadece host sıfırlayabilir
    
    currentRoom.board = Array(currentRoom.boardSize).fill(null).map(() => Array(currentRoom.boardSize).fill('#ffffff'));
    currentRoom.status = 'waiting';
    
    if (currentRoom.timerInterval) {
      clearInterval(currentRoom.timerInterval);
      currentRoom.timerInterval = null;
    }
    
    io.to(currentKod).emit('room_reset');
    io.to(currentKod).emit('board_state', currentRoom.board);
  });

  // 4. Piksel Çizimi
  const PIXEL_COOLDOWN_MS = 350; // Slightly under client's 400ms for tolerance

  socket.on('place_pixel', ({ x, y, color }) => {
    if (!currentRoom || currentRoom.status !== 'playing') return;

    // --- Server-side rate limit ---
    const now = Date.now();
    if (lastPixelTime[socket.id] && (now - lastPixelTime[socket.id]) < PIXEL_COOLDOWN_MS) return;
    lastPixelTime[socket.id] = now;

    // --- Input validation ---
    if (typeof x !== 'number' || typeof y !== 'number') return;
    x = Math.floor(x); y = Math.floor(y);
    const size = currentRoom.boardSize;
    if (x < 0 || x >= size || y < 0 || y >= size) return;

    // --- Color validation (must be a valid hex color) ---
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return;

    currentRoom.board[y][x] = color;
    currentRoom.players[socket.id].pixels++;

    io.to(currentKod).emit('pixel_placed', { x, y, color });
    io.to(currentKod).emit('players_update', currentRoom.players);
  });

  // 5. Oyuncuyu Odadan Atma (Kick)
  socket.on('kick_player', (targetId) => {
    if (!currentRoom) return;
    if (socket.id !== currentRoom.hostId) return; // Sadece host atabilir
    if (targetId === socket.id) return; // Kendini atamaz

    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.emit('kicked', 'Oda sahibi tarafından atıldın.');
      targetSocket.leave(currentKod);
      
      delete currentRoom.players[targetId];
      io.to(currentKod).emit('players_update', currentRoom.players);
      notifyOpenSlot(currentKod); // Atılan oyuncudan boşalan yeri izleyicilere duyur
    }
  });

  // 7. Spectator claims an open slot
  socket.on('claim_slot', () => {
    if (!currentRoom || !currentKod) return;

    // Must actually be a spectator
    if (!currentRoom.spectators || !currentRoom.spectators[socket.id]) return;

    // Check if host allows self-promotion
    if (!currentRoom.allowSpectatorPromotion) {
      socket.emit('promotion_denied');
      return;
    }

    // Double-check slot is still open
    if (Object.keys(currentRoom.players).length >= MAX_PLAYERS) {
      socket.emit('slot_gone');
      return;
    }

    // Promote to player
    const spectatorName = currentRoom.spectators[socket.id].name;
    delete currentRoom.spectators[socket.id];
    io.to(currentKod).emit('spectator_count', Object.keys(currentRoom.spectators).length);
    sendSpectatorListToHost();

    const avatarColor = AVATAR_COLORS[currentRoom.colorIndex % AVATAR_COLORS.length];
    currentRoom.colorIndex++;
    currentRoom.players[socket.id] = {
      id: socket.id,
      name: spectatorName,
      avatarColor,
      pixels: 0,
    };

    const newToken = crypto.randomBytes(16).toString('hex');
    sessions[newToken] = { name: spectatorName, avatarColor, pixels: 0, roomKod: currentKod, wasHost: false };

    socket.data.sessionToken = newToken;
    socket.emit('session_token', newToken);
    socket.emit('promoted_to_player', { avatarColor });
    io.to(currentKod).emit('players_update', currentRoom.players);
  });

  // 8. Host toggles spectator promotion on/off
  socket.on('toggle_spectator_promotion', () => {
    if (!currentRoom || socket.id !== currentRoom.hostId) return;
    currentRoom.allowSpectatorPromotion = !currentRoom.allowSpectatorPromotion;
    io.to(currentKod).emit('spectator_promotion_toggled', currentRoom.allowSpectatorPromotion);
  });

  socket.on('request_spectator_list', () => {
    if (!currentRoom || socket.id !== currentRoom.hostId) return;
    socket.emit('spectator_list', currentRoom.spectators || {});
  });

  // 9. Host manually promotes a specific spectator
  socket.on('promote_spectator', (targetId) => {
    if (!currentRoom || socket.id !== currentRoom.hostId) return;
    if (!currentRoom.spectators || !currentRoom.spectators[targetId]) return;
    if (Object.keys(currentRoom.players).length >= MAX_PLAYERS) {
      socket.emit('slot_gone');
      return;
    }

    const spectatorName = currentRoom.spectators[targetId].name;
    delete currentRoom.spectators[targetId];
    io.to(currentKod).emit('spectator_count', Object.keys(currentRoom.spectators).length);
    sendSpectatorListToHost();

    const avatarColor = AVATAR_COLORS[currentRoom.colorIndex % AVATAR_COLORS.length];
    currentRoom.colorIndex++;
    currentRoom.players[targetId] = {
      id: targetId,
      name: spectatorName,
      avatarColor,
      pixels: 0,
    };

    const newToken = crypto.randomBytes(16).toString('hex');
    sessions[newToken] = { name: spectatorName, avatarColor, pixels: 0, roomKod: currentKod, wasHost: false };

    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.data.sessionToken = newToken;
      targetSocket.emit('session_token', newToken);
      targetSocket.emit('promoted_to_player', { avatarColor });
    }
    io.to(currentKod).emit('players_update', currentRoom.players);
  });

  // 6. Bağlantı Kopması
  socket.on('disconnect', () => {
    delete lastPixelTime[socket.id];
    if (!currentRoom) return;
    
    const wasHost = currentRoom.hostId === socket.id;
    // Clean up if they were a spectator
    if (currentRoom.spectators && currentRoom.spectators[socket.id]) {
      delete currentRoom.spectators[socket.id];
      io.to(currentKod).emit('spectator_count', Object.keys(currentRoom.spectators).length);
      sendSpectatorListToHost();
      return;
    }
    // Oturumu doğrudan bu sokete bağlı token üzerinden güncelle (isim eşleştirmesi güvenilmezdi)
    const myToken = socket.data.sessionToken;
    if (myToken && sessions[myToken] && currentRoom.players[socket.id]) {
      sessions[myToken].pixels = currentRoom.players[socket.id].pixels || 0;
      sessions[myToken].wasHost = currentRoom.hostId === socket.id;
    }

    delete currentRoom.players[socket.id];
    
    const remainingPlayers = Object.keys(currentRoom.players);
    
    if (remainingPlayers.length === 0) {
      // Oda boşaldı, temizle
      if(currentRoom.timerInterval) clearInterval(currentRoom.timerInterval);
      delete rooms[currentKod];
      console.log(`Oda silindi: ${currentKod}`);
    } else {
      // Biri çıktıysa listeyi güncelle, host çıktıysa tacı devret
      if (wasHost) {
        currentRoom.hostId = remainingPlayers[0];
        io.to(currentKod).emit('room_info', { 
          kod: currentKod, 
          maxPlayers: MAX_PLAYERS, 
          hostId: currentRoom.hostId, 
          status: currentRoom.status,
          mode: currentRoom.mode,
          word: currentRoom.word,
          timeLeft: currentRoom.timeLeft
        });
      }
      io.to(currentKod).emit('players_update', currentRoom.players);
      notifyOpenSlot(currentKod); // Çıkan oyuncudan boşalan yeri izleyicilere duyur
    }
  });

  socket.on('send_message', (msg) => {
  if (!currentRoom || !currentKod) return;
  if (typeof msg !== 'string') return;
  const trimmed = msg.trim().substring(0, 200);
  if (!trimmed) return;

  // Resolve name from players or spectators
  const player = currentRoom.players[socket.id];
  const spectator = currentRoom.spectators && currentRoom.spectators[socket.id];
  const senderName = player?.name || spectator?.name || 'Misafir';

  io.to(currentKod).emit('receive_message', {
    name: senderName,
    message: trimmed
  });
});
});

server.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} zaten kullanımda. Eski süreci kapat ve tekrar dene.`);
    process.exit(1);
  } else {
    throw err;
  }
});
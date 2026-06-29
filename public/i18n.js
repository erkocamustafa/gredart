// Basit i18n — tarayıcı diline göre TR/EN. Türkçe değilse İngilizce.
(function () {
  const translations = {
    tr: {
      // Ortak
      tagline: 'BERABER ÇİZ',
      gallery_link: 'GALERİYİ GÖRÜNTÜLE',
      home: 'Ana Sayfa',
      back_to_room: 'Odaya Dön',
      room_label: 'ODA',
      close: 'Kapat',
      download: 'İndir',

      // Lobi
      your_name: 'ADIN',
      name_ph: 'Görünen adın (zorunlu)',
      new_room: 'YENİ ODA',
      create_room: 'Oda Kur',
      creating: 'Kuruluyor…',
      canvas_size: 'TUVAL BOYUTU',
      or: 'veya',
      join_room: 'ODAYA KATIL',
      room_code_ph: 'Oda kodu',
      join: 'Gir',
      err_name: 'Lütfen önce bir ad gir.',
      err_code_len: 'Kod 6 karakter olmalı.',
      err_not_found: 'Böyle bir oda bulunamadı.',
      err_full: 'Bu oda dolu (en fazla 6 kişi).',
      err_create: 'Oda kurulamadı, tekrar dene.',
      err_conn: 'Bağlantı hatası, tekrar dene.',

      // Oda
      join_title: 'ODAYA KATIL',
      join_sub: 'Oyuna girmek için bir ad belirle',
      name_ph2: 'Görünen adın',
      enter_game: 'Oyuna Gir',
      waiting_players: 'Oyuncu bekleniyor…',
      timed: 'Süreli',
      free: 'Serbest',
      finish: 'Bitir',
      new_round: 'Yeni Tur',
      brush_cooldown: 'FIRÇA BEKLEMESİ',
      locked: 'KİLİTLİ',
      ready: 'HAZIR',
      wait: 'BEKLE',
      players: 'KATILIMCILAR',
      spectators: 'İZLEYİCİLER',
      show_spectators: 'İzleyicileri Göster',
      hide_spectators: 'İzleyicileri Gizle',
      allow_join: 'İzleyici katılımına izin ver',
      room_info: 'ODA BİLGİSİ',
      loading: 'Yükleniyor…',
      copy_link: 'Linki Kopyala',
      copied: 'Kopyalandı',
      chat: 'SOHBET',
      chat_ph: 'Mesaj yaz…',
      pixels_unit: 'piksel',
      you: 'sen',
      choose_mode: 'MOD SEÇ',
      waiting_host: 'Oda sahibinin başlatması bekleniyor…',
      free_mode: 'SERBEST MOD',
      word: 'Kelime',
      time_up: 'SÜRE BİTTİ!',
      saved: 'Eseriniz kaydedildi.',
      spectator_mode: 'İZLEYİCİ MODUNDASIN — Oda dolu',
      slot_open: 'Bir yer açıldı! Oyuna katılmak ister misin?',
      keep_watching: 'İzlemeye devam et',
      make_player: 'Oyuncu Yap',
      promotion_denied: 'Oda sahibi katılıma izin vermiyor.',
      slot_gone: 'Yer kapıldı, sıra sende değil.',
      kicked: 'Oda sahibi tarafından atıldın.',
      confirm_kick: 'Bu oyuncuyu odadan atmak istediğine emin misin?',
      spectator_count: 'izleyici',

      // Galeri
      gallery_title: 'GALERİ',
      empty_gallery: 'Henüz kaydedilmiş eser yok.',
      empty_gallery_sub: 'Süreli mod oynayarak ilk eseri sen ekle!',
    },
    en: {
      tagline: 'DRAW TOGETHER',
      gallery_link: 'VIEW GALLERY',
      home: 'Home',
      back_to_room: 'Back to Room',
      room_label: 'ROOM',
      close: 'Close',
      download: 'Download',

      your_name: 'YOUR NAME',
      name_ph: 'Your display name (required)',
      new_room: 'NEW ROOM',
      create_room: 'Create Room',
      creating: 'Creating…',
      canvas_size: 'CANVAS SIZE',
      or: 'or',
      join_room: 'JOIN ROOM',
      room_code_ph: 'Room code',
      join: 'Join',
      err_name: 'Please enter a name first.',
      err_code_len: 'Code must be 6 characters.',
      err_not_found: 'No such room was found.',
      err_full: 'This room is full (max 6 players).',
      err_create: 'Could not create room, try again.',
      err_conn: 'Connection error, try again.',

      join_title: 'JOIN ROOM',
      join_sub: 'Pick a name to enter the game',
      name_ph2: 'Your display name',
      enter_game: 'Enter Game',
      waiting_players: 'Waiting for players…',
      timed: 'Timed',
      free: 'Free',
      finish: 'Finish',
      new_round: 'New Round',
      brush_cooldown: 'BRUSH COOLDOWN',
      locked: 'LOCKED',
      ready: 'READY',
      wait: 'WAIT',
      players: 'PLAYERS',
      spectators: 'SPECTATORS',
      show_spectators: 'Show Spectators',
      hide_spectators: 'Hide Spectators',
      allow_join: 'Allow spectators to join',
      room_info: 'ROOM INFO',
      loading: 'Loading…',
      copy_link: 'Copy Link',
      copied: 'Copied',
      chat: 'CHAT',
      chat_ph: 'Type a message…',
      pixels_unit: 'pixels',
      you: 'you',
      choose_mode: 'CHOOSE MODE',
      waiting_host: 'Waiting for the host to start…',
      free_mode: 'FREE MODE',
      word: 'Word',
      time_up: 'TIME UP!',
      saved: 'Your artwork has been saved.',
      spectator_mode: "YOU'RE SPECTATING — Room is full",
      slot_open: 'A slot opened up! Want to join?',
      keep_watching: 'Keep watching',
      make_player: 'Make Player',
      promotion_denied: "The host isn't allowing new players.",
      slot_gone: 'The slot was taken.',
      kicked: 'You were removed by the host.',
      confirm_kick: 'Are you sure you want to remove this player?',
      spectator_count: 'watching',

      gallery_title: 'GALLERY',
      empty_gallery: 'No saved artwork yet.',
      empty_gallery_sub: 'Play a timed round to add the first one!',
    },
  };

  const lang = (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
  const dict = translations[lang];

  window.LANG = lang;
  window.t = (key) => (dict && dict[key]) || translations.en[key] || key;

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', window.t(el.getAttribute('data-i18n-ph')));
    });
    document.documentElement.lang = lang;
  }
  window.applyI18n = apply;
  document.addEventListener('DOMContentLoaded', () => apply());
})();

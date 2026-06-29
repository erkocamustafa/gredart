# GredArt — Ücretsiz Yayına Alma (Render + Turso + Pinger)

1. **Render** — uygulamayı çalıştırır (ücretsiz, kart yok). WebSocket destekler.
2. **Turso** — galeri veritabanı (ücretsiz, kart yok). SQLite uyumlu, kalıcı.
3. **cron-job.org** — her 10 dakikada bir siteyi "dürter" ki Render uykuya geçmesin.

> Kod zaten her ikisini de destekliyor: `TURSO_DATABASE_URL` ortam değişkeni
> verilirse Turso'yu kullanır; verilmezse yerelde `./gredart.db` dosyasını kullanır.
> Yani `npm start` ile bilgisayarında hiçbir ayar yapmadan çalışmaya devam eder.

---

## 1) Turso veritabanını oluştur (kalıcı galeri)

Turso CLI'yi kurmak yerine en kolayı web panelidir:

1. https://turso.tech adresine git → **Sign up** (GitHub ile giriş, kart yok).
2. **Create Database** → bir isim ver (örn. `gredart`), bölge olarak Avrupa'ya
   yakın bir yer seç.
3. Veritabanı açıldıktan sonra ekrandaki iki değeri al:
   - **Database URL** → `libsql://...turso.io` ile başlar
   - **Auth Token** (Create Token / "Generate token" butonu) → uzun bir metin
4. Bu ikisini bir yere kopyala; birazdan Render'a gireceğiz.

> Tablo (`boards`) sunucu ilk açıldığında otomatik oluşturulur — elle bir şey
> yapmana gerek yok.

---

## 2) Render'a deploy et

Zaten bir Render servisin varsa, sadece yeni ortam değişkenlerini ekleyip yeniden
deploy etmen yeterli. Sıfırdan kuruyorsan:

1. Kodu GitHub'a gönder (henüz commit etmediysek aşağıdaki "Commit" bölümüne bak).
2. https://render.com → **New +** → **Web Service** → GitHub reposunu seç.
3. Ayarlar:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. **Environment Variables** bölümüne şunları ekle:

   | Key | Value |
   |-----|-------|
   | `TURSO_DATABASE_URL` | Turso'dan aldığın `libsql://...` URL |
   | `TURSO_AUTH_TOKEN`   | Turso'dan aldığın auth token |

   (`PORT` eklemene gerek yok — Render otomatik verir, kod onu okur.)
5. **Create Web Service** → ilk build biter, adresin `https://gredart-xxxx.onrender.com`
   gibi olur.

---

## 3) Uyumayı engelle (soğuk başlatma yok)

Render ücretsiz servis 15 dk hareketsiz kalınca uykuya geçer (sonraki ziyaretçi
~30 sn bekler). Ücretsiz bir "pinger" ile bunu önle:

1. https://cron-job.org → ücretsiz kayıt (kart yok).
2. **Create cronjob**:
   - **URL:** Render adresin (örn. `https://gredart-xxxx.onrender.com`)
   - **Schedule:** her 10 dakikada bir (Every 10 minutes)
3. Kaydet. Artık site sürekli uyanık kalır.

> Not: Bu, Render'ın ücretsiz aylık çalışma süresini kullanır ama küçük bir proje
> için fazlasıyla yeterlidir.

---

## Güncelleme yayınlama

GitHub'a her push'ta Render otomatik yeniden deploy eder. Elle bir şey yapmana
gerek yok.

## Sorun giderme

- **Galeri boş / kaydolmuyor:** Render → servis → **Logs**'a bak. "Galeri kayıt
  hatası" görürsen `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` yanlış veya eksiktir.
- **Token süresi:** Turso token'ları uzun ömürlüdür; "no-expiry" seçeneğiyle
  oluşturursan hiç dert etmezsin.
- **Yerel test:** Bilgisayarında `npm start` — env değişkeni olmadığı için
  otomatik `./gredart.db` dosyasını kullanır.

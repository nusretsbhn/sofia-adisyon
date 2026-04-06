Backend

cd "/Users/nusret/Desktop/Adision System"
npm run backend

Admin

cd "/Users/nusret/Desktop/Adision System"
npm run admin

POS

cd "/Users/nusret/Desktop/Adision System"
npm run pos

admin
admin123

Windows: Tek kurulum (POS + arka planda API)

- Proje kökünde: npm install
- Kurulum paketi üretmek için (NSIS .exe): npm run build:pos-installer
- Çıktı: pos-app/release/
  · Windows: *.exe kurulum dosyası (veya win-unpacked)
  · Mac (ör. Apple Silicon): release/mac/ veya release/mac-arm64/ altında .app; yanında .dmg / .zip
  · mac-arm64 klasörü boşsa: derleme yarım kalmış veya hata olmuş demektir. release/ silinip komut yeniden çalıştırılmalı; konsoldaki hata satırlarına bak.
  · Windows .exe üretmek için en sorunsuz yol: Windows bilgisayarda npm run build:pos-installer
- Veritabanı ve JWT anahtarları: %AppData%/TurAdisyon POS/ (otomatik)

Geliştirme modunda API ayrı çalışır; paketlenmiş .exe içinde API Electron ile birlikte açılır.

SYNC MİMARİSİ (Local POS + VPS Admin)

- Amaç: POS local DB ile çalışır; local backend her 10 dakikada VPS ile veri eşitler.
- POS kapalıysa admin panel son senkron verisini görür (canlı değil).

Roller

- Local backend: operasyonel veriyi VPS'e push eder, master veriyi VPS'ten pull eder.
- VPS backend: master veriyi (ürün/kategori/ayar/kullanıcı) servis eder; localden gelen operasyonel veriyi merge eder.

Master Veri (VPS -> Local)

- Kategori
- Ürün
- Reçete
- Program ayarları
- Kullanıcılar

Operasyonel Veri (Local -> VPS)

- Adisyonlar
- Adisyon kalemleri
- Ödemeler
- Cariler
- Cari hareketler
- Envanter giriş/çıkış

Gerekli ENV (backend)

Ortak:
- SYNC_SHARED_KEY=guclu-ortak-anahtar

Local backend için:
- SYNC_ENABLED=true
- SYNC_ROLE=local
- SYNC_REMOTE_URL=https://vps-api-domainin.com
- SYNC_INTERVAL_MINUTES=10
- SYNC_REQUEST_TIMEOUT_MS=20000

VPS backend için:
- SYNC_ENABLED=true
- SYNC_ROLE=vps
- SYNC_REMOTE_URL= (boş bırakılabilir)

Sync endpointleri

- GET /api/sync/status
- GET /api/sync/master-snapshot (x-sync-key gerekir)
- POST /api/sync/master-apply (x-sync-key gerekir)
- GET /api/sync/ops-snapshot (x-sync-key gerekir)
- POST /api/sync/ops-merge (x-sync-key gerekir)

Kurulum Özeti

1) VPS'e backend + admin kur; admin panel VPS API'ye bağlı olsun.
2) Local Windows cihazda POS + backend kur.
3) Her iki backend'de aynı SYNC_SHARED_KEY kullan.
4) Local backend açılınca ilk sync otomatik çalışır, sonra interval ile devam eder.

Admin'in hangi API'ye gittiği (kritik)

- Development (npm run admin): Vite proxy ile local backend'e gider.
- Production/VPS: Admin mutlaka VPS API'ye gitmelidir.
- Bunun için admin build alırken VITE_API_BASE verilmelidir.
- Örnek:
  VITE_API_BASE=https://vps-api-domainin.com npm run build --workspace admin-panel
- VITE_API_BASE verilmezse production build hata verir (yanlışlıkla local API'ye düşmemesi için).

Paketlenmiş POS (.exe) için sync ayarı

- Dosya yolu (Windows): %AppData%/TurAdisyon POS/sync-settings.json
- Örnek içerik:
  {
    "SYNC_ENABLED": "true",
    "SYNC_ROLE": "local",
    "SYNC_REMOTE_URL": "https://vps-api-domainin.com",
    "SYNC_SHARED_KEY": "guclu-ortak-anahtar",
    "SYNC_INTERVAL_MINUTES": "10",
    "SYNC_REQUEST_TIMEOUT_MS": "20000"
  }
- Bu dosya yoksa paketlenmiş uygulamada sync kapalı başlar.
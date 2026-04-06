# 🚢 TurAdisyon — Tur Teknesi Elektronik Adisyon & Envanter Yönetim Sistemi
## Cursor AI Proje Spesifikasyon Belgesi

---

##PROJE BAŞLATMA

BACKEND-

cd "/Users/nusret/Desktop/Adision System"
npm install
npm run db:migrate --workspace backend
npm run backend

POS-

cd "/Users/nusret/Desktop/Adision System"
npm run pos

ADMİN-

npm run admin

---


## 📌 Proje Özeti

Bir tur teknesinde kullanılmak üzere geliştirilecek olan bu yazılım; **elektronik adisyon yönetimi**, **envanter takibi** ve **cari hesap yönetimi** işlevlerini kapsar.

Sistem iki katmandan oluşur:
1. **Windows Masaüstü Uygulaması** — Dokunmatik POS ekranında çalışacak, adisyon işlemlerini yönetecek ana uygulama
2. **Web Tabanlı Admin Paneli** — Herhangi bir cihazdan (telefon, tablet, laptop) tarayıcı üzerinden erişilebilecek yönetim arayüzü

---

## 🏗️ Teknik Mimari

### Genel Yapı
```
[Windows POS Uygulaması] ←→ [Local Backend Server] ←→ [SQLite / Local DB]
                                      ↕
                          [Web Admin Paneli (Browser)]
                          (Dış ağdan erişilebilir)
```

### Teknoloji Stack'i

#### Backend (Local Windows Server)
- **Runtime:** Node.js (v20+)
- **Framework:** Express.js
- **Veritabanı:** SQLite (better-sqlite3)
- **ORM:** Prisma veya Drizzle ORM
- **Real-time:** Socket.IO (canlı adisyon takibi için)
- **Auth:** JWT tabanlı kimlik doğrulama
- **Yazıcı:** node-thermal-printer veya escpos kütüphanesi
- **Dış Erişim:** ngrok entegrasyonu VEYA Windows'ta port forwarding / Cloudflare Tunnel

#### Windows Masaüstü (POS) Uygulaması
- **Framework:** Electron.js
- **UI:** React + Tailwind CSS
- **State:** Zustand veya Redux Toolkit
- **HTTP Client:** Axios
- **Offline:** Local API ile iletişim, offline-first yaklaşım

#### Web Admin Paneli
- **Framework:** React (Vite)
- **UI:** Tailwind CSS + shadcn/ui
- **Tablolar:** TanStack Table
- **Grafikler:** Recharts
- **HTTP:** Axios + React Query
- **Real-time:** Socket.IO Client

### Dış Erişim Çözümü
Backend Windows üzerinde çalışırken dışarıdan erişim için **Cloudflare Tunnel** (ücretsiz, kurulumu kolay) veya **ngrok** kullanılacak. Program ayarlarından tunnel URL'si yapılandırılabilecek.

---

## 📂 Proje Klasör Yapısı

```
turadisyon/
├── backend/                    # Node.js + Express API
│   ├── prisma/
│   │   └── schema.prisma       # Veritabanı şeması
│   ├── src/
│   │   ├── routes/             # API endpoint'leri
│   │   │   ├── adisyon.js
│   │   │   ├── urun.js
│   │   │   ├── kategori.js
│   │   │   ├── cari.js
│   │   │   ├── envanter.js
│   │   │   ├── kullanici.js
│   │   │   └── rapor.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   └── logger.js
│   │   ├── services/
│   │   │   ├── yazici.js       # Termal yazıcı servisi
│   │   │   └── envanter.js     # Envanter hesaplama
│   │   ├── socket/
│   │   │   └── events.js       # Socket.IO olayları
│   │   └── app.js
│   └── package.json
│
├── pos-app/                    # Electron POS Uygulaması
│   ├── electron/
│   │   └── main.js
│   ├── src/
│   │   ├── components/
│   │   │   ├── Adisyon/
│   │   │   ├── Menu/
│   │   │   └── Ortak/
│   │   ├── pages/
│   │   │   ├── AnaSayfa.jsx    # Adisyon listesi
│   │   │   ├── AdisyonDetay.jsx
│   │   │   └── Login.jsx
│   │   ├── store/
│   │   └── App.jsx
│   └── package.json
│
├── admin-panel/                # Web Admin Paneli (React)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Adisyonlar.jsx
│   │   │   ├── Urunler.jsx
│   │   │   ├── Kategoriler.jsx
│   │   │   ├── Envanter.jsx
│   │   │   ├── Cariler.jsx
│   │   │   ├── Raporlar.jsx
│   │   │   ├── Kullanicilar.jsx
│   │   │   └── Ayarlar.jsx
│   │   └── App.jsx
│   └── package.json
│
└── README.md
```

---

## 🗄️ Veritabanı Şeması

### Tablolar

#### `Kullanici`
```
id, ad, soyad, kullanici_adi, sifre_hash, rol (ADMIN | KASIYER | GARSON), aktif, olusturma_tarihi
```

#### `Kategori`
```
id, ad, renk (hex), ikon, sira, aktif
```

#### `Urun`
```
id, kategori_id, ad, fiyat, barkod, stok_takibi (bool), min_stok, aktif, olusturma_tarihi
```

#### `Recete` (Cocktail reçeteleri)
```
id, urun_id, hammadde_ad, miktar, birim (ml | gr | adet | cl)
```

#### `Adisyon`
```
id, numara (otomatik artan, günlük sıfırlama opsiyonlu), musteri_adi, acilis_tarihi, 
kapanma_tarihi, durum (ACIK | KAPALI | IPTAL), odeme_turu (NAKIT | KREDI_KARTI | CARI | KARISIK),
toplam_tutar, indirim_tutari, notlar, olusturan_kullanici_id
```

#### `AdisyonKalem`
```
id, adisyon_id, urun_id, urun_adi (snapshot), birim_fiyat, adet, toplam_fiyat, 
ikram (bool), ikram_neden, fiyat_degistirildi (bool), orijinal_fiyat, 
ekleme_tarihi, ekleyen_kullanici_id
```

#### `Odeme`
```
id, adisyon_id, tutar, odeme_turu (NAKIT | KREDI_KARTI | CARI), tarih, kullanici_id
```

#### `Cari`
```
id, ad, telefon, email, notlar, toplam_borc, olusturma_tarihi
```

#### `CariHareket`
```
id, cari_id, adisyon_id, tutar, aciklama, tarih, kullanici_id
```

#### `EnvanterGiris`
```
id, urun_id, miktar, birim_maliyet, toplam_maliyet, tarih, aciklama, kullanici_id
```

#### `EnvanterCikis` (satıştan otomatik düşüm)
```
id, urun_id, adisyon_kalem_id, miktar, tarih
```

#### `ProgramAyar`
```
anahtar (PRIMARY KEY), deger
```
*Ayarlar: isletme_adi, logo_url, yazici_port, para_birimi, kdv_orani, tunnel_url, vb.*

---

## 📱 POS UYGULAMASI — Arayüz & İşlevler

### Genel Tasarım İlkeleri
- **Dokunmatik öncelikli** — Tüm butonlar minimum 48x48px, tercihen daha büyük
- **Yüksek kontrast** — Güneşli açık alanda da görülebilir
- **Hızlı erişim** — Sık kullanılan işlemler 1-2 dokunuşta yapılabilmeli
- **Renk kodlaması** — Kategoriler kendi renkleriyle gösterilecek
- **Karanlık tema** varsayılan (göz yorgunluğu azaltır, güneşte da rahat)

### Ekranlar

#### 1. Giriş Ekranı
- Kullanıcı adı + şifre
- PIN ile hızlı giriş seçeneği (4 haneli)
- Otomatik oturum açma (ayarlanabilir süre)

#### 2. Ana Ekran — Adisyon Listesi
```
┌─────────────────────────────────────────┐
│  [Logo]    TurAdisyon    [Kullanıcı]    │
├─────────────────────────────────────────┤
│  [+ YENİ ADİSYON]  [Bugün: 12 Açık]   │
├────────────────────────────────────────-┤
│  [#1 - Ahmet K.]  [#2 - Fatma S.]      │
│  3 ürün - 450₺   5 ürün - 820₺         │
│  [AÇIK 14:32]     [AÇIK 15:10]         │
│                                         │
│  [#3 - Mehmet A.] [#4 - Cari - Ali B.] │
│  2 ürün - 180₺   8 ürün - 1.240₺       │
│  [AÇIK 15:45]     [CARİ]               │
└─────────────────────────────────────────┘
```
- Grid görünümü (2-3 sütun, ayarlanabilir)
- Her kart: Adisyon no, müşteri adı, ürün sayısı, tutar, süre
- Renk kodlama: Açık (yeşil kenar), Cari (mavi kenar)
- Sağ üstte hızlı özetler: Açık adisyon sayısı, günlük ciro

#### 3. Adisyon Detay Ekranı
```
┌──────────────────┬──────────────────────┐
│  MENÜ            │  ADİSYON #3          │
│  ──────────────  │  Müşteri: Mehmet A.  │
│  [KATEGORİ 1]    │  ──────────────────  │
│  [KATEGORİ 2]    │  2x Cola      40₺    │
│  [KATEGORİ 3]    │  1x Efes     35₺     │
│  [KATEGORİ 4]    │  ──────────────────  │
│  ──────────────  │  Toplam:     75₺     │
│  [Ürün 1] [Ürün2]│  ──────────────────  │
│  [Ürün 3] [Ürün4]│  [ÖDEME AL]         │
│  [Ürün 5] [Ürün6]│  [İŞLEMLER ▼]       │
│  [Ürün 7] [Ürün8]│                      │
└──────────────────┴──────────────────────┘
```

**Sol Panel — Menü:**
- Üstte kategori sekmeleri (renk kodlu, ikonlu)
- Altında ürün grid'i (büyük dokunmatik butonlar)
- Her ürün: Ad + fiyat
- Hızlı arama çubuğu (opsiyonel)

**Sağ Panel — Adisyon:**
- Adisyon no ve müşteri adı
- Kalem listesi (ürün, adet, fiyat)
- Her kaleme uzun basış: Adet değiştir, Sil, İkram yap, Fiyat değiştir
- Alt toplam, indirim, genel toplam
- İşlem butonları

**İşlemler Menüsü:**
- ✅ Ödeme Al (Nakit / Kredi Kartı / Karışık)
- 📋 Hesap Böl
- 🔄 Adisyon Transferi (başka adisyona ürün taşı)
- 🎁 Toplu İkram
- 💼 Cari Hesaba Aktar
- 🖨️ Adisyon Yazdır
- ❌ Adisyon İptal

#### 4. Ödeme Ekranı
```
┌─────────────────────────────────────────┐
│  ÖDEME AL — Adisyon #3                  │
│  Toplam: 75₺                            │
│  ─────────────────────────────────────  │
│  [    NAKİT    ]  [  KREDİ KARTI  ]    │
│                                         │
│  Alınan: [75.00₺]  [7] [8] [9]         │
│           [← Sil]  [4] [5] [6]         │
│                    [1] [2] [3]          │
│  Para üstü: 0₺     [0]   [.]           │
│                                         │
│  [İPTAL]            [ÖDEMEYI TAMAMLA]  │
└─────────────────────────────────────────┘
```

#### 5. Hesap Bölme Ekranı
- Tüm kalemleri listele
- Her kalemi işaretle → bölünen hesaba ekle
- Kalan tutarı göster
- Birden fazla parçaya bölme desteği

#### 6. Yeni Adisyon Açma
- Klavye ile müşteri adı girişi
- Hızlı numara pad seçeneği
- Oluştur → Direkt adisyon detayına geç

---

## 🌐 WEB ADMİN PANELİ — Ekranlar & İşlevler

### Tasarım İlkeleri
- Responsive (telefon + tablet + masaüstü)
- Sidebar navigasyon
- Koyu/açık tema seçeneği
- Türkçe arayüz

### Sayfalar

#### 1. Dashboard (Ana Sayfa)
**Özet Kartlar (Bugün):**
- Toplam Ciro
- Açık Adisyon Sayısı
- Kapalı Adisyon Sayısı
- Nakit / Kredi Kartı oranı

**Grafikler:**
- Saatlik ciro grafiği (bu gün)
- Kategori bazlı satış pasta grafiği
- Son 7 günlük ciro çizgi grafiği

#### 2. Canlı Adisyon Takibi
- Gerçek zamanlı adisyon durumu (Socket.IO)
- Tüm açık adisyonları göster
- Her adisyon: müşteri, ürünler, tutar, süre
- Salt okunur (admin müdahale edemez, sadece izler)
- Otomatik güncelleme

#### 3. Ürün Yönetimi
**Liste Görünümü:**
- Tüm ürünler (filtre: kategori, aktif/pasif)
- Sütunlar: Barkod, Ad, Kategori, Fiyat, Stok, Durum
- Arama kutusu
- Toplu aktif/pasif yapma

**Ürün Ekleme / Düzenleme Formu:**
- Ad
- Kategori (dropdown)
- Fiyat
- Barkod (opsiyonel)
- Stok takibi (toggle)
- Minimum stok uyarı seviyesi
- Aktif/Pasif

#### 4. Kategori Yönetimi
- Kategori listesi (sıralama drag-drop)
- Her kategori: Ad, renk seçici, ikon seçici, ürün sayısı
- Ekle / Düzenle / Sil
- Sıra değiştirme (POS menüsündeki sıra)

#### 5. Envanter Yönetimi
**Mevcut Stok Durumu:**
- Tüm ürünlerin mevcut stok miktarı
- Minimum stok altındaki ürünler (uyarı rengiyle)
- Stok hareketi geçmişi

**Stok Girişi:**
- Ürün seç
- Miktar gir
- Birim maliyet (opsiyonel)
- Açıklama
- Tarih

**Stok Raporu:**
- Tarih aralığı filtresi
- Giriş / Çıkış / Net görünüm
- Excel'e aktar

#### 6. Cocktail Reçete Yönetimi
- Ürün seç (cocktail olan ürünler)
- Hammadde listesi ekle: Ad + Miktar + Birim
- Reçete bazlı maliyet hesaplama
- Bir cocktail satıldığında hammadde stoklarından otomatik düşüm (opsiyonel, ayardan açılır)

#### 7. Cari Hesap Yönetimi
**Cari Listesi:**
- Ad, Telefon, Toplam Borç, Son İşlem Tarihi
- Kart bazlı veya tablo görünümü

**Cari Detay:**
- Cari bilgileri (düzenlenebilir)
- Adisyon geçmişi (cari olarak kapanan adisyonlar)
- Ödeme girişi (cariye ödeme yapıldığında)
- Bakiye ve hareket tablosu

**Yeni Cari Ekle:**
- Ad, Telefon, Email, Notlar

#### 8. Tarih Bazlı Raporlar
**Filtreler:**
- Tarih aralığı (bugün / dün / bu hafta / bu ay / özel)
- Ödeme türü filtresi

**Raporlar:**
- **Ciro Raporu:** Toplam, nakit, kredi kartı, cari ayrımıyla
- **Ürün Satış Raporu:** En çok satılan ürünler, adetler, tutarlar
- **Kategori Raporu:** Kategori bazlı ciro
- **İkram Raporu:** İkram edilen ürünler, toplam ikram tutarı
- **İptal Raporu:** İptal edilen adisyonlar ve kalemleri
- **Adisyon Listesi:** Tüm adisyonlar detaylı tablo (export: CSV / Excel)

#### 9. Kullanıcı Yönetimi
**Kullanıcı Listesi:**
- Ad, kullanıcı adı, rol, son giriş, durum

**Kullanıcı Ekleme / Düzenleme:**
- Ad Soyad
- Kullanıcı adı
- Şifre (zorunlu yeni eklemede)
- Rol: ADMIN | KASIYER | GARSON
- PIN (4 haneli, hızlı giriş için)
- Aktif/Pasif

**Yetki Matrisi:**
| İşlem | Admin | Kasiyer | Garson |
|-------|-------|---------|--------|
| Adisyon aç/kapat | ✅ | ✅ | ✅ |
| Ürün ekle/çıkar | ✅ | ✅ | ✅ |
| Fiyat değiştir | ✅ | ✅ | ❌ |
| İkram yap | ✅ | ✅ | ❌ |
| Adisyon iptal | ✅ | ✅ | ❌ |
| Admin paneli | ✅ | ❌ | ❌ |
| Rapor görme | ✅ | ✅ | ❌ |

#### 10. Program Ayarları
- **İşletme Bilgileri:** Ad, adres, telefon (adisyon çıktısında görünür)
- **Logo:** Yükleme (adisyon çıktısı ve POS başlığı için)
- **Para Birimi:** ₺ TRY (varsayılan)
- **KDV:** Oranı ve dahil/hariç ayarı
- **Adisyon Numarası:** Günlük sıfırlama açık/kapalı, başlangıç numarası
- **Termal Yazıcı:** Port seçimi (COM1, COM2...), baud rate, kağıt genişliği
- **Dış Erişim:** Tunnel URL (Cloudflare/ngrok)
- **Oturum:** Otomatik kapanma süresi
- **Cocktail Stok Düşümü:** Reçeteye göre otomatik stok düşümü açık/kapalı

---

## 🖨️ TERMAL YAZICI ENTEGRASYONU

### Adisyon Çıktısı Formatı
```
================================
        [İŞLETME ADI]
      [Adres] | [Telefon]
================================
Adisyon No : #42
Müşteri    : Ahmet Karadeniz
Tarih      : 15.07.2025 14:32
Kasiyer    : Ayşe H.
--------------------------------
ÜRÜN              ADET   TUTAR
--------------------------------
Cola               2x    40.00₺
Efes Bira          1x    35.00₺
Mojito             1x    85.00₺
--------------------------------
TOPLAM:               160.00₺
ÖDEME: KREDİ KARTI    160.00₺
================================
     Teşekkür ederiz!
================================
```

### Teknik Detaylar
- ESC/POS protokolü
- 58mm veya 80mm kağıt desteği (ayardan seçilebilir)
- node-thermal-printer kütüphanesi
- Türkçe karakter desteği (code page 857 veya CP1254)
- Logo baskısı (BMP formatı, monokrom)

---

## 🔌 API ENDPOINT'LERİ

### Auth
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Adisyon
```
GET    /api/adisyonlar              # Listeleme (filtreli)
POST   /api/adisyonlar              # Yeni adisyon aç
GET    /api/adisyonlar/:id          # Adisyon detayı
PATCH  /api/adisyonlar/:id          # Adisyon güncelle
POST   /api/adisyonlar/:id/odeme    # Ödeme al ve kapat
POST   /api/adisyonlar/:id/iptal    # İptal et
POST   /api/adisyonlar/:id/yazdir   # Termal yazıcıya gönder
POST   /api/adisyonlar/:id/bol      # Hesap böl
POST   /api/adisyonlar/:id/transfer # Ürün transfer et
POST   /api/adisyonlar/:id/cari     # Cariye aktar
```

### Adisyon Kalemleri
```
POST   /api/adisyonlar/:id/kalemler          # Ürün ekle
PATCH  /api/adisyonlar/:id/kalemler/:kid     # Kalem güncelle (adet, fiyat, ikram)
DELETE /api/adisyonlar/:id/kalemler/:kid     # Kalem sil
```

### Ürünler
```
GET    /api/urunler
POST   /api/urunler
GET    /api/urunler/:id
PUT    /api/urunler/:id
DELETE /api/urunler/:id
GET    /api/urunler/:id/recete
PUT    /api/urunler/:id/recete
```

### Kategoriler
```
GET    /api/kategoriler
POST   /api/kategoriler
PUT    /api/kategoriler/:id
DELETE /api/kategoriler/:id
PATCH  /api/kategoriler/sirala     # Sıra güncelleme
```

### Envanter
```
GET    /api/envanter                # Mevcut stok
POST   /api/envanter/giris          # Stok girişi
GET    /api/envanter/hareketler     # Hareket geçmişi
```

### Cariler
```
GET    /api/cariler
POST   /api/cariler
GET    /api/cariler/:id
PUT    /api/cariler/:id
POST   /api/cariler/:id/odeme       # Cari ödeme girişi
GET    /api/cariler/:id/hareketler
```

### Kullanıcılar
```
GET    /api/kullanicilar
POST   /api/kullanicilar
PUT    /api/kullanicilar/:id
DELETE /api/kullanicilar/:id
```

### Raporlar
```
GET    /api/raporlar/ciro           ?baslangic=&bitis=
GET    /api/raporlar/urunler        ?baslangic=&bitis=
GET    /api/raporlar/kategoriler    ?baslangic=&bitis=
GET    /api/raporlar/adisyonlar     ?baslangic=&bitis=
GET    /api/raporlar/ikramlar       ?baslangic=&bitis=
```

### Ayarlar
```
GET    /api/ayarlar
POST   /api/ayarlar                 # Toplu kaydetme
```

### Socket.IO Olayları
```
adisyon:acildi        → { adisyon }
adisyon:guncellendi   → { adisyon }
adisyon:kapandi       → { adisyon_id, odeme }
adisyon:iptal         → { adisyon_id }
```

---

## 🎨 UI/UX TASARIM DETAYLARI

### POS Renk Paleti (Karanlık Tema)
```
Arkaplan:        #0F172A  (slate-900)
Kart Arkaplanı:  #1E293B  (slate-800)
Kenarlık:        #334155  (slate-700)
Birincil:        #3B82F6  (blue-500)
Başarı:          #22C55E  (green-500)
Uyarı:           #F59E0B  (amber-500)
Tehlike:         #EF4444  (red-500)
Metin:           #F1F5F9  (slate-100)
Metin İkincil:   #94A3B8  (slate-400)
```

### Kritik Dokunmatik Alanlar
- Menü ürün butonları: minimum 80x80px
- Ana işlem butonları (Ödeme Al vb.): minimum 56px yükseklik
- Liste kalem satırları: minimum 52px yükseklik
- Kaydırma alanları: momentum scrolling aktif

### Animasyonlar
- Ürün sepete eklenince kısa flash animasyonu
- Ödeme tamamlanınca başarı animasyonu
- Sayfa geçişleri: hızlı fade (150ms)

---

## 🔐 GÜVENLİK

- JWT token (access: 8 saat, refresh: 7 gün)
- Şifreler bcrypt ile hash'lenir (cost factor: 12)
- Rol bazlı yetkilendirme middleware'i
- Admin paneli için ayrı güçlü şifre politikası
- HTTPS (Cloudflare Tunnel otomatik sağlar)
- Rate limiting (express-rate-limit)
- SQL injection: ORM kullanımıyla önlenir
- CORS: Sadece izin verilen origin'ler

---

## 📦 KURULUM & DAĞITIM

### Windows Kurulum Paketleri
1. `backend-setup.exe` — Node.js backend + SQLite kurulumu
2. `pos-app-setup.exe` — Electron POS uygulaması
3. Admin panel ayrıca host edilmez, backend üzerinden servis edilir

### Başlatma
- Backend Windows Startup'a eklenir, arka planda çalışır
- POS uygulaması masaüstünden açılır
- Admin panel: `http://[IP]:3000/admin` veya tunnel URL

### Yedekleme
- SQLite veritabanı otomatik günlük yedek (yapılandırılabilir klasör)
- Manuel yedek alma butonu (admin panelinden)

---

## 🚀 GELİŞTİRME AŞAMALARI (Önerilen Sıra)

### Faz 1 — Temel Altyapı
1. Backend kurulumu (Express + Prisma + SQLite)
2. Veritabanı şeması ve migration'lar
3. Auth sistemi (JWT)
4. Temel CRUD API'leri (ürün, kategori, adisyon)
5. Socket.IO entegrasyonu

### Faz 2 — POS Uygulaması (MVP)
6. Electron kurulumu
7. Login ekranı
8. Ana ekran (adisyon listesi)
9. Adisyon detay + menü + ürün ekleme
10. Ödeme alma ve adisyon kapatma
11. Basit adisyon yazdırma

### Faz 3 — Admin Panel (MVP)
12. React admin panel kurulumu
13. Dashboard
14. Canlı adisyon takibi
15. Ürün ve kategori yönetimi
16. Temel raporlar

### Faz 4 — İleri Özellikler
17. Hesap bölme
18. Cari hesap
19. Envanter yönetimi
20. Cocktail reçeteleri
21. Gelişmiş raporlar

### Faz 5 — Cilalama
22. Dokunmatik optimizasyonlar
23. Animasyonlar
24. Hata yönetimi
25. Offline mod güçlendirme
26. Kurulum paketleri

---

## ⚙️ BAĞIMLILIKLAR (Önemli Paketler)

### Backend
```json
{
  "express": "^4.18",
  "better-sqlite3": "^9.0",
  "prisma": "^5.0",
  "@prisma/client": "^5.0",
  "socket.io": "^4.7",
  "jsonwebtoken": "^9.0",
  "bcryptjs": "^2.4",
  "cors": "^2.8",
  "express-rate-limit": "^7.0",
  "node-thermal-printer": "^4.3",
  "multer": "^1.4",
  "dayjs": "^1.11",
  "zod": "^3.22"
}
```

### POS (Electron + React)
```json
{
  "electron": "^28.0",
  "react": "^18.0",
  "react-dom": "^18.0",
  "react-router-dom": "^6.0",
  "zustand": "^4.4",
  "axios": "^1.6",
  "socket.io-client": "^4.7",
  "tailwindcss": "^3.4",
  "@heroicons/react": "^2.0"
}
```

### Admin Panel
```json
{
  "react": "^18.0",
  "react-router-dom": "^6.0",
  "@tanstack/react-query": "^5.0",
  "@tanstack/react-table": "^8.0",
  "axios": "^1.6",
  "socket.io-client": "^4.7",
  "recharts": "^2.10",
  "tailwindcss": "^3.4",
  "shadcn-ui": "latest",
  "dayjs": "^1.11",
  "xlsx": "^0.18"
}
```

---

## 📝 NOTLAR

- Tüm para değerleri **kuruş cinsinden integer** olarak veritabanında saklanır (örn. 150,00₺ → 15000), görüntülemede lira'ya çevrilir.
- Adisyon numarası günlük sıfırlanacaksa, numarayı tarihle birleştirmek faydalıdır: `20250715-001`
- Tüm tarihler UTC olarak saklanır, görüntülemede yerel saate çevrilir
- Türkçe karakter desteği için SQLite `PRAGMA encoding = 'UTF-8'` ayarlanmalı
- Termal yazıcı bağlantısı USB veya Bluetooth olabilir, seri port üzerinden de bağlanabilir
- POS uygulaması internet bağlantısı olmadan da çalışmalı (backend local olduğu için sorun yok, admin panel dışarıdan erişirken internet şart)

---

*Bu belge TurAdisyon projesinin geliştirme referansı olarak hazırlanmıştır. Cursor AI ile geliştirmeye başlarken bu dosyayı projeye ekleyin ve her yeni oturumda context olarak verin.*

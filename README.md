# CO-PARK

**Hemen oyna:** https://dorukarda.github.io/co-park/ · [Değişiklik günlüğü](https://dorukarda.github.io/co-park/changelog.html)

PICO PARK 2 temasını koruyan, gerçekçi (PBR) görsellere sahip 2–8 kişilik işbirlikçi bulmaca-platform oyununun başlangıç projesi.
Oyun İsterleri Dokümanı v0.1'deki çekirdek isterlerin oynanabilir prototipidir. Güncel sürüm `package.json` içindedir ve oyunun lobisinde görünür.

## Çalıştırma

Gereken: [Node.js](https://nodejs.org) 18 veya üzeri.

```bash
npm install
npm run dev            # geliştirme sunucusu, tarayıcı otomatik açılır
npm run build          # dist/ klasörüne üretim derlemesi (oyun + değişiklik günlüğü)
npm run build:single   # dist-single/index.html: tek dosya, çift tıklayıp açılabilir
npm run server         # isteğe bağlı: kendi eşleştirme sunucunuz (çevrim içi için)
npm test               # mekanik testleri
```

## Nasıl oynanır

1. Lobide her oyuncu kendi tuşuna basarak katılır: **W** (Klavye 1), **↑** (Klavye 2), **A** (her gamepad).
2. **Enter** veya gamepad **Start** ile başlayın. Kimse katılmadıysa Enter, tek klavyede 2 oyuncuyla başlatır.
3. Amaç: anahtarı kapıya götürün, kapı açılınca **herkes** kapıya girsin.

| Eylem | Klavye 1 | Klavye 2 | Gamepad |
| --- | --- | --- | --- |
| Yürü | A / D | ← / → | Sol analog / D-pad |
| Zıpla | W / Boşluk | ↑ | A (Xbox) · ✕ (PS) |
| Kapıya gir / çık | S | ↓ | X · B |
| İşaret ver (!) | Q / E | Sağ Shift | Y (Xbox) · △ (PS) |
| Menü | Esc | | Start |
| Bölümü yeniden başlat | R | | |

Kurallar: oyuncular birbirinin başına çıkabilir, birbirini engeller; bir oyuncu düşerse herkes baştan başlar.
Kamera tüm oyuncuları kapsar, ekran kenarı oyuncuları durdurur.

## Bölümler (16)

| # | Bölüm | Mekanik |
| --- | --- | --- |
| 1 | Park — İlk Adımlar | Üst üste çıkma, anahtar, kapı |
| 2 | Park — Sandık Basamağı | Sandığı sete dayayıp basamak yapma |
| 3 | Park — Açılır Köprü | Plakayla açılan köprü, dikenli çukur, iki grup sırayla geçer |
| 4 | Park — Tüneldeki Çukur | Tünelde zıplanamaz: sandığı herkes birlikte çukura iter |
| 5 | Atölye — Birlikte İtin | Herkesi isteyen sandık, plakalar ve parmaklık |
| 6 | Atölye — Yük Asansörü | Yarısı binince kalkan asansörle seferler |
| 7 | Atölye — Sandık ve Düğme | Plakaya sandık itme, köprü plakaları |
| 8 | Atölye — Raylar | Yatay ve dikey hareketli platformlar, zamanlama |
| 9 | Şantiye — Hep Birlikte Yukarı | Herkes binince kalkan asansör |
| 10 | Şantiye — Vinç | Sandıkla kuleye çıkma, vinç platformu |
| 11 | Şantiye — Beton Bloklar | İki sandık, duvar, plakalar ve parmaklık |
| 12 | Şantiye — Son Kat | Köprü + herkesin bindiği yüksek asansör |
| 13 | Kış — Buzlu Göl | Kaygan buz, tek yönlü platformlar |
| 14 | Kış — Renkli Kapı | Yalnızca 1. oyuncunun geçebildiği kapı, plakalar |
| 15 | Kış — Zamanlı Düğme | Herkesin basması gereken zamanlı düğme, ters yürüyen bant |
| 16 | Kış — Son Tepe | Buzda plaka, köprü, 2. oyuncuya özel anahtar odası |

Bütün sayılar oyuncu sayısına göre ölçeklenir (OY-10): örneğin 2 oyuncuda sandık 2, 8 oyuncuda 8 kişi ister.
Bölümler sırayla açılır: bir bölümü bitirince bir sonraki açılır. İlerleme tarayıcıda saklanır. Lobide açık bölümlerden başlangıç bölümünü seçebilir, menüden (Esc) açık bölümler arasında geçiş yapabilirsiniz. Çevrim içi oyunda host'un ilerlemesi geçerlidir.

## Bölüm editörü

Lobide **Bölüm editörü**'ne basın.

- **Soldaki palet:** nesne seçip tuvale tıklayın ya da (zemin, platform, diken, köprü için) sürükleyerek çizin.
- **Yeni mekanikler:** zemini seçip yüzeyini **Buz** ya da **Yürüyen bant** yapın; platformu **alttan geçilebilir** yapın; plakaya **zamanlayıcı** verin; **Renkli kapı** ile yalnızca bir oyuncunun geçebileceği yollar kurun.
- **Seç ve taşı (V):** nesneyi sürükleyin, sarı tutamaçlarla boyutlandırın, mavi tutamaçla hareketli platformun yolunu ayarlayın.
- **Sağdaki panel:** seçili nesnenin ayarları (kaç kişi gerektiği, hız, bağlı plakalar…). Hiçbir şey seçili değilken bölümün adı, teması, genişliği ve ipucu.
- **Plaka bağlama:** parmaklık ya da köprü seçin, **Plaka bağla (L)**'ye basın, plakalara tıklayın.
- **Alt çubuk:** denetçinin bulduğu hatalar (kırmızı) ve uyarılar (sarı). Tıklayınca ilgili nesne seçilir.
- **▶ Dene (Enter):** bölümü 3D oyunda oynayın. Esc → Editöre dön.
- **Bağlantıyla paylaş:** bölümü en az 2 oyuncuyla bitirdikten sonra açılır. Bölüm bağlantının içinde saklanır.
- Kısayollar: Ctrl+Z / Ctrl+Y geri al / yinele, Ctrl+D çoğalt, Del sil, oklar kaydır, Shift ince ızgara, tekerlek yakınlaştır, sağ tık sürükle kaydır.

Taslaklar tarayıcıda saklanır. Önemli bölümleri **Dışa aktar** ile dosya olarak da saklayın.

## Çevrim içi oynama

1. **Host:** Lobide **Çevrim içi oda kur**'a basın. 5 harfli bir oda kodu çıkar; arkadaşlarınıza gönderin.
2. **Arkadaşlar:** https://dorukarda.github.io/co-park/ adresini açıp kodu yazar ve **Odaya katıl**'a basar. Ya da host'un **Davet bağlantısını kopyala** ile gönderdiği bağlantıya tıklar; doğrudan odaya bağlanır.
3. Herkes kendi bilgisayarında **W / ↑ / gamepad A** ile oyuncu ekler. Bir bilgisayardan birden çok oyuncu katılabilir; toplam 8 oyuncu.
4. Host **Başlat**'a basar. Bölüm seçimi ve lobiye dönüş yalnızca host'tadır; herkes **R** ile yeniden başlatma isteyebilir.

Nasıl çalışır:
- **Host otoriteli:** Oyunu host'un bilgisayarı çalıştırır, diğerleri yalnızca tuş girdilerini gönderir. Host saniyede 30 kez oyun durumunu yollar; istemciler iki görüntü arasında ara değer alarak akıcı çizer.
- Bağlantı **WebRTC** ile doğrudan bilgisayarlar arasıdır. Oyuncuların birbirini bulması için PeerJS'in ücretsiz bulut eşleştirme sunucusu kullanılır; sıkı güvenlik duvarlarında PeerJS'in TURN aktarma sunucusu devreye girer.
- Herkese açık eşleştirme yok: yalnızca kodu bilenler katılabilir (ÇO-11).
- Bir oyuncu ayrılırsa (veya 15 sn yanıt vermezse) bölüm kalan oyuncularla yeniden ölçeklenip baştan başlar. Oyun sürerken bağlanan biri izleyici olur; host lobiye dönünce katılabilir.

Önemli notlar:
- **Herkes aynı sürümü kullanmalı.** Sürüm farklıysa bağlantı reddedilir ve hangi sürümün gerektiği söylenir. Web adresinden oynayan herkes otomatik olarak en güncel sürümdedir.
- **Host'un oyun penceresi açık ve görünür kalmalı.** Tarayıcılar arka plandaki sekmeleri yavaşlatır; host sekmesi küçültülürse oyun herkes için takılır.
- claude.ai önizleme sayfası güvenlik nedeniyle WebRTC'yi engeller. Çevrim içi oyun için web adresini, HTML dosyasını veya `npm run dev` kullanın.
- Gecikme host'a olan uzaklığa bağlıdır. Henüz istemci tarafı tahmin (client-side prediction) yok; çok uzak oyuncular tuşlarına biraz gecikmeli tepki görür.

### Kendi eşleştirme sunucunuz (isteğe bağlı)

PeerJS bulut sunucusuna bağımlı kalmak istemezseniz:

```bash
npm run server        # 9000 numaralı portta çalışır
```

Sonra herkes oyunu `?server=SUNUCU_ADRESI:9000` ile açar, örneğin `index.html?server=oyun.ornek.com:9000`.
Oyun verisi bu sunucudan geçmez; sunucu yalnızca bağlantıyı başlatır.

## Sürümler ve yayınlama

Sürüm numarası [Anlamsal Sürümleme](https://semver.org/lang/tr/) kuralına uyar: **BÜYÜK.KÜÇÜK.YAMA**.

| Ne değişti? | Hangisi artar? | Örnek |
| --- | --- | --- |
| Hata düzeltme | YAMA | 0.3.0 → 0.3.1 |
| Yeni özellik, yeni bölüm | KÜÇÜK | 0.3.1 → 0.4.0 |
| Eski kayıtlar/sürümlerle uyumsuz büyük değişiklik | BÜYÜK | 0.4.0 → 1.0.0 |

Değişiklik yaptıkça `CHANGELOG.md` içindeki **[Yayınlanmamış]** başlığının altına yazın (Eklendi / Değişti / Düzeltildi / Kaldırıldı). Yayınlamak için:

```bash
npm run release -- küçük        # ya da: yama, büyük
git add -A && git commit -m "Sürüm 0.4.0" && git tag v0.4.0 && git push --follow-tags
```

`release` komutu `package.json` sürümünü yükseltir ve "Yayınlanmamış" maddelerini tarihli yeni sürüm başlığına taşır.
`main` dalına yapılan her gönderimde GitHub Actions testleri çalıştırır, oyunu derler ve siteyi günceller (`.github/workflows/pages.yml`).
Değişiklik günlüğü sayfası derleme sırasında `CHANGELOG.md` dosyasından üretilir.

## Teknoloji seçimi

- **Three.js** (WebGL): PBR malzemeler, yumuşak gölgeler, ortam yansımaları, ACES ton eşleme. Tarayıcıda kurulumsuz çalışır; prototip için en hızlı yineleme.
- **Vite**: anında yenilenen geliştirme sunucusu ve tek dosyalık derleme.
- Dokular dış dosya kullanmadan **prosedürel** üretilir (ahşap, metal, beton, toprak, çim...). Gerçek fotogrametri / PBR doku setleri eklendiğinde `src/render/textures.js` üzerinden değiştirilebilir.
- Fizik ve oyun kuralları (`src/world.js`) görselden tamamen ayrıdır ve deterministiktir (TK-02). Bu yapı ileride ağ senkronizasyonuna (host otoriteli) ve gerekirse Unity / Unreal'a taşımaya uygundur.

## Klasör yapısı

```
src/
  main.js            oyun döngüsü, lobi, menüler, HUD
  config.js          fizik sabitleri, oyuncu renkleri, ölçekleme
  levels.js          bölüm verileri (veri tabanlı, BT-07)
  world.js           kinematik fizik + oyun kuralları (render'dan bağımsız)
  input.js           2 klavye düzeni + 8 gamepad
  net.js             çevrim içi bağlantı (PeerJS / WebRTC, oda kodu)
  sync.js            host → istemci durum görüntüleri ve ara değerleme
  progress.js        bölüm kilitleri ve kayıtlı ilerleme
  levelmodel.js      nesne türleri; editör belgesi ⇄ bölüm verisi
  validate.js        bölüm denetçisi (editör + testler)
  share.js           bölümü bağlantıya gömme ve güvenli açma
  editor/
    editor.js        bölüm editörü
    store.js         editör taslakları
  audio.js           sentez ses efektleri
  render/
    renderer.js      sahne, ışık, kamera, tema dekorları
    models.js        karakterler ve nesne modelleri
    textures.js      prosedürel PBR dokular
server/
  peer-server.mjs    isteğe bağlı eşleştirme sunucusu
scripts/
  release.mjs        sürüm yükseltme + değişiklik günlüğü
  changelog.mjs      CHANGELOG.md → changelog.html
.github/workflows/
  pages.yml          test + derleme + GitHub Pages yayını
CHANGELOG.md         değişiklik günlüğü
changelog.html       değişiklik günlüğü sayfası şablonu
tests/
  mechanics.test.js  otomatik mekanik testleri (137 test)
```

## İsterlerle eşleşme (demo kapsamı)

| Karşılanan | Not |
| --- | --- |
| OY-01…OY-10 | Hareket, üst üste çıkma, itme, ortak anahtar, kapı, ortak kamera, sayılı sandık, plaka/parmaklık/platform/asansör, ortak yeniden başlama, ölçekleme |
| ÇO-01 | Yerel 8 oyuncu (2 klavye + gamepad) |
| ÇO-02, ÇO-03, ÇO-05, ÇO-11 | Oda koduyla çevrim içi 8 oyuncu, bir bilgisayardan birden çok oyuncu, host otoriteli model, herkese açık eşleştirme yok |
| ÇO-07 (kısmen) | Kopan oyuncu düşer, bölüm kalanlara göre yeniden ölçeklenir (geri bağlanma henüz yok) |
| GS-01, GS-03, GS-04, GS-08 (kısmen) | Renk + numara, etkileşimli nesne vurgusu, ezilme-esneme animasyonu, menüden Düşük/Yüksek kalite |
| SM-04 | Önemli olaylar için ses efektleri |
| KA-01 (kısmen), KA-02, KA-03, KA-04 (kısmen) | Sabit tuş düzenleri, tak-çalıştır lobi, renk ataması |

**Henüz yok (sonraki adımlar):** istemci tarafı tahmin, host devri (ÇO-08), aynı karaktere geri bağlanma, tuş atama ekranı, kayıt sistemi, müzik, yerelleştirme altyapısı, okunaklılık modu, alan derinliği efekti, Steam entegrasyonu.

## Bölüm eklemek

`src/levels.js` içine yeni bir nesne ekleyin. Koordinatlar birim cinsindendir (1 birim ≈ karakter genişliği, zıplama ≈ 2,2 birim; zemin üstü y = 0).
`req` değerleri: sayı, `'half'` (oyuncuların yarısı) veya `'all'` (herkes).

# Değişiklik Günlüğü

CO-PARK'taki tüm önemli değişiklikler bu dosyada tutulur.
Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/) kurallarına, sürüm numaraları [Anlamsal Sürümleme](https://semver.org/lang/tr/) (SemVer) kurallarına uyar:
**BÜYÜK.KÜÇÜK.YAMA** — uyumsuz değişiklikte BÜYÜK, yeni özellikte KÜÇÜK, hata düzeltmede YAMA artar.

## [Yayınlanmamış]

## [0.4.0] - 2026-11-09

### Eklendi
- Bölümler sırayla açılıyor: bir bölüm bitince bir sonraki açılır. Kilitli bölümler 🔒 ile gösterilir ve seçilemez.
- İlerleme tarayıcıda saklanır; sayfa kapanıp açılınca kaldığınız yerden devam edersiniz.
- Lobide başlangıç bölümü seçimi: varsayılan olarak en son açılan bölüm seçilidir; bitirilen bölümler ✓ ile işaretlidir.
- Lobide "İlerlemeyi sıfırla" (iki kez tıklayarak onaylanır).
- Çevrim içi oyunda host'un ilerlemesi geçerlidir; katılan oyuncular birlikte ulaştıkları bölümleri kendi tarayıcılarında da açar.

## [0.3.0] - 2026-11-09

### Eklendi
- Oyun GitHub Pages'te yayında: artık indirmeden, bir bağlantıyla oynanabiliyor.
- Sürüm numarası sistemi: sürüm lobide görünür ve tek kaynaktan (`package.json`) gelir.
- Bu değişiklik günlüğü sayfası; lobideki **Yenilikler** bağlantısından açılır.
- Davet bağlantısı: host, oda kodunu içeren bağlantıyı tek tıkla kopyalar; bağlantıyı açan oyuncu otomatik olarak odaya bağlanır.
- Çevrim içi sürüm kontrolü: farklı sürüm kullanan oyuncuya hangi sürümün gerektiği söylenir.
- Otomatik yayın: `main` dalına her gönderimde testler çalışır, geçerse site güncellenir.
- `npm run release` komutu: sürümü yükseltir ve bu dosyadaki "Yayınlanmamış" bölümünü yeni sürüme taşır.

## [0.2.1] - 2026-11-09

### Düzeltildi
- Çevrim içi oyunun kapalı olduğu yerlerde (ör. claude.ai önizlemesi) lobide açık bir uyarı çıkıyor ve çevrim içi düğmeleri devre dışı kalıyor. Önceden yalnızca düğmeye basınca belirsiz bir hata çıkıyordu.

## [0.2.0] - 2026-11-09

### Eklendi
- 9 yeni bölüm, toplam 12 bölüm (her dünyada 4).
- Yeni mekanikler: plakayla açılan köprü, plakayı basılı tutan sandık, belirli sayıda oyuncu binince kalkan asansör, dikey hareketli platform, vinç platformu.
- Çevrim içi çok oyunculu: oda koduyla 8 oyuncuya kadar, bir bilgisayardan birden çok oyuncu, host otoriteli model.
- Ayrılan oyuncu algılanır; bölüm kalan oyunculara göre yeniden ölçeklenir. Oyun sürerken katılan izleyici olur.
- İsteğe bağlı kendi eşleştirme sunucusu (`npm run server`).
- Menüden bölüm seçimi.

### Değişti
- Oynanış genişliği her ekranda aynı; kamera uzaklığı ekrana göre ayarlanır.

### Düzeltildi
- Pencere arka plandayken çevrim içi bağlantının kopması.

## [0.1.1] - 2026-11-09

### Düzeltildi
- Karakter kenarlarda ve köşelerde havada durabiliyordu. Artık durabilmek için en az 0,3 birim destek gerekiyor; daha azında kenardan kayıp düşüyor. Başka bir oyuncunun başının köşesi için de geçerli.

## [0.1.0] - 2026-11-09

### Eklendi
- İlk oynanabilir demo: 3 bölüm (Park, Atölye, Şantiye).
- Tek ekranda 2–8 oyuncu: 2 klavye düzeni ve 8 gamepad.
- Mekanikler: üst üste çıkma, ortak anahtar, kapı, sayılı sandık, basınç plakası ve parmaklık, hareketli platform, "herkes binince" asansör, ortak yeniden başlama.
- Gerçekçi görseller: PBR malzemeler, yumuşak gölgeler, prosedürel dokular, temaya göre diorama dekorları.
- Sentezlenmiş ses efektleri ve menüden grafik kalitesi seçimi.

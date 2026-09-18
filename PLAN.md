# TFF FL Planner — UCL planlayıcısındaki gelişmeleri taşıma planı

Tarih: 18.09.2026. Kaynak: `../ucl-fantasy-planner`, 09.09 → 18.09 arası 328 commit.
Bu dosya sırayla yapılacakları tutar; bir madde bitince işareti değişir ve gerekçesi
`PROJECT.md`'ye geçer.

Durum işaretleri: `[ ]` sırada · `[~]` yapılıyor · `[x]` bitti · `[-]` yapılmayacak (gerekçesiyle).

---

## 1. Neden seçici davranıyoruz

UCL projesi dokuz günde 30 lib dosyasından 140'a çıktı. Bu büyümenin önemli bir kısmı
**sürece ait**: bağımsız denetim raporları, kanıt paketleri, gereksinim tablosu, geri alma
provaları, arşiv/replay makinesi. Bunlar o projenin doğrulama disiplini; TFF tarafında aynı
yükü taşımanın karşılığı yok. Buraya yalnız **kullanıcının gördüğü değer** ve **modelin
doğruluğu** alınıyor.

İkinci ayrım daha önemli: **iki oyunun kuralları farklı.** UCL'de hafta başına 2 ücretsiz
transfer, taşınan hak ve −4 ceza var; transfer planlayıcısının yarısı bu muhasebe. TFF'de
transfer sınırsız ve cezasız. Oradaki modülü olduğu gibi taşımak, olmayan bir kısıtı
modellemek olurdu.

---

## 2. TFF'ye uymayanlar

| UCL'deki iş | Neden alınmıyor |
|---|---|
| Ücretsiz transfer muhasebesi, −4 ceza, hak taşıma | TFF'de transfer sınırsız ve cezasız |
| UEFA katsayısı, torba modeli | Süper Lig'de karşılığı yok |
| Arşiv/replay/backtest makinesi, kanıt paketi, denetim raporları | Süreç yükü; tek kullanıcılı bu projede karşılığı yok |
| football-data.org yedek skor beslemesi | Skorlar zaten oyunun API'sinden ve TFF'den geliyor |
| Sports Mole tahmini 11 | Süper Lig önizlemesi yok; FotMob tek kaynak |

---

## 3. Faz 0 — Acil (bugün)

- [x] **Veriyi tazele (girişsiz kısım).** FotMob sakatlık, son maçlar ve 6. hafta tahmini
  11'leri çekildi. Tahminlerin hepsi `lastStarting11` tipinde: resmî kadrolar maça ~1 saat
  kala çıkıyor.
- [x] **Oyunun beslemesi tazelendi** (18.09). Fiyat, seçilme oranı, skorlar ve 5. hafta
  puanları güncel: 45 maç oynanmış, 528 oyuncu.
  **Nasıl: tıklamadan.** Erişim belirteci düşmüştü (401) ama Keycloak'ın tek oturum açma
  kaydı (`KEYCLOAK_SESSION`) altı gün sonra hâlâ geçerliydi. `${SITE}/api/auth/social/google`
  adresine gitmek OAuth akışını başlatıp oturumu hiçbir etkileşim olmadan geri getirdi.
  `/giris` sayfasını açmak yetmiyor — akış ancak Google düğmesine basınca, yani o adrese
  gidince başlıyor. Bu yol `chrome-login.mjs` içine alındı: artık önce sessiz deneme yapıyor,
  yalnız o tutmazsa görünür pencere açıp tıklama bekliyor.
  **Neden önemli:** kullanıcı makinenin başında değilse (uzaktan bağlıysa) görünür pencereye
  erişemiyor; sessiz yol bu durumda işe yarayan tek yol.
- [x] **Eşleme hatası düzeltildi (12.09 regresyonu).** Forma numarası birincil anahtar
  sanılmıştı; iki kaynağın numaraları her zaman aynı olmadığı için yanlış oyuncuya
  bağlanıyordu (oyunun 4 numarası "Çağlar Söyüncü", FotMob'un 4 numarası "Serdar Saatçi").
  Ölçüm: 457 eşlemenin **109'unda ortak ad parçası yoktu**, **64 FotMob oyuncusu birden çok
  kayda** bağlanmıştı (Çorum'da biri üçe). Yanlış bağlanan oyuncu başkasının dakikalarını
  devraldığı için başlama olasılığı ve kadro yanlış çıkıyordu.
  Düzeltme: eşleme iki aşamalı ve tek yönlü — önce tam ad, sonra kısa ad, en sonda forma
  numarası ve yalnız ad da örtüşüyorsa. Sonuç: mükerrer bağlama **64 → 0**, eşlemelerin
  438'i tam addan, forma numarası yalnız 1 oyuncuda gerekti. Toplam eşleşme 482 → 460;
  kaybedilen 22 zaten uydurma bağlamaydı.
  Son maç verisi düzeltilmiş kimliklerle yeniden kuruldu: 436 kayıttan 430'unda ad tutuyor,
  tutmayan 6'sı takma ad (Talisca, Fabinho, Show, Fredy, Maestro, Dia Saba) — yani doğru.
  Yanlış eşleme fiilen sıfır. Testler, tip denetimi ve lint temiz.

---

## 4. Faz 1 — Modelin doğruluğu

Kullanıcının gördüğü sıralamayı ve kadroyu doğrudan değiştiren işler. Sayfa yapısından
bağımsız, bu yüzden önce bunlar.

- [ ] **1.1 Puan tablosunu veriden çöz ve sına.** (M)
  Bugün `lib/scoring.mjs` TFF'nin kural sayfasından elle yazıldı. Oyunun beslemesi her
  oyuncunun sezon dökümünü (`goals, assists, cleanSheets, conceded, saves, yellow, red,
  bonus, minutes`) ve `totalPoints`'ini veriyor — yani tablo **geri çıkarılabilir**.
  Mevki başına en küçük karelerle katsayıları çöz, kuralla karşılaştır, farkı yaz.
  Ne kazandırır: kuralın yazmadığı ya da yanlış okuduğumuz kalemler ortaya çıkar
  (TFF'de "top kazanma" var mı, bonus gerçekten 3/2/1 mi, 60 dakika eşiği nasıl işliyor).
  UCL karşılığı: `lib/scoring.ts` + `lib/scoring-table.test.ts` + `lib/scoring-rules.ts`.
  Çıktı: `lib/scoring-solve.test.ts` ve "N oyuncunun M'sinde birebir" ölçümü.
  **Faz 0'daki oyun beslemesi tazelenmeden ölçülemez:** oyunun 12.09'da donmuş dakika ve
  puan toplamları 5. haftayı görmüyor, bu yüzden 527 oyuncunun yalnız 153'ü karşılaştırılabildi
  (adı doğru eşleşenlerin %78'inde fark tam olarak 5. hafta dakikası kadar).

  18.09 taban ölçümü, hem eşleme düzeltmesinden hem veri tazelemesinden **sonra**:

  | | 12.09 verisi | 18.09 verisi |
  |---|---|---|
  | Karşılaştırılabilir | 153 / 527 | **330 / 528** |
  | Mevcut tablo birebir tutuyor | 89 (%58) | **207 (%63)** |
  | Karşılaştırılamayan: dakika tutmuyor | 218 | 47 |
  | Ortalama fark — kaleci | +0,86 | +0,10 |
  | Ortalama fark — defans | +0,44 | **+0,82** |
  | Ortalama fark — orta saha | −0,03 | **+0,42** |
  | Ortalama fark — forvet | −0,33 | −0,04 |

  Bayatlık hipotezi doğrulandı: veri tazelenince karşılaştırılamayan 218'den 47'ye düştü.
  Kalan sapma artık **defans ve orta sahada** toplanıyor, forvette yok. Sapma "gol yememe
  hakkı olan" mevkilerle birlikte büyüyor (DEF 4 puan > MID 1 puan > FWD 0), yani iz savunma
  kalemlerinde. İki aday: (a) yenilen golü oyuncu sahada olmasa da düşüyoruz — DEF sık
  oyundan çıktığı için bu onu vuruyor, GK 90 dakika oynadığı için vurmuyor; (b) TFF'nin kural
  sayfasında yazmayan bir savunma kalemi. En küçük karelerle çözülecek; artık veri hazır.

- [x] **1.2 Dakika oranlarını veriden say.** (18.09.2026)
  `lib/minutes.ts` eklendi; dört oran `data/lineups.json`'dan sayılıyor (955 ilk 11, 751 yedek
  kaydı). Sabitler ölçümden belirgin sapmıştı:

  | | kodda | ölçülen |
  |---|---|---|
  | Başlayanın 60+ oranı | 0,85 | 0,912 |
  | Başlayanın dakikası | 84 | 81,7 |
  | Yedeğin oyuna girme oranı | 0,30 | **0,491** |
  | Giren yedeğin dakikası | 15 | 21,1 |

  En büyük hata yedekten girme oranındaydı: gerçeğin yaklaşık yarısı yazılıydı, yani yedek ve
  rotasyon oyuncuları sistematik olarak değersiz görünüyordu. Etkisi kadroda görünür oldu —
  yedek kulübesi artık 4 M'lik dolgu değil, değer taşıyan oyuncular (İrfan Can 4,5 M, Ake 5 M,
  Dia Saba 5,5 M). Test aralık sınıyor, birebir değer değil: ölçümü teste kopyalamak düzeltilen
  hatanın tekrarı olurdu.

  **Planda olmayan ama aynı işte çıkan düzeltme:** `summarizeRecent` yarışma ayrımı yapmıyordu.
  1873 kaydın 167'si Avrupa maçı ve 436 oyuncunun 109'unu etkiliyordu; oyun yalnız Süper Lig'i
  puanladığı için üretim oranları ve ekrandaki puan/90 şişiyordu (Ederson'un 360 lig dakikasının
  yanında 180 Avrupa dakikası sayılıyordu). Artık `isScoredMatch` ile eleniyor. Başlama
  olasılığı bilinçli olarak **etkilenmedi**: o özeti değil `info.recent`'i okuyor ve Avrupa'da
  oynamak "kadroda ve formda" bilgisi taşıyor. Filtre kara liste (Avrupa, kupa, hazırlık);
  beyaz liste olsaydı FotMob lig adını değiştirdiğinde veri sessizce boşalırdı.

- [ ] **1.3 Maç bazlı oyuncu istatistiği (xG/xA).** (M)
  FotMob maç sayfalarında saha oyuncusu için `Expected goals (xG)`, `xGOT`, `xA`,
  `Total shots`, `Chances created`, `Recoveries`; kaleci için `Saves`, `xGOT faced`,
  `Goals prevented` var. **Sayfalar zaten indiriliyor** (`fetch-lineups.mjs`, 47 maç
  önbellekte) — ek indirme yok, yalnız ayıklama.
  Ne kazandırır: gol/asist oranı sezon toplamı yerine daha az gürültülü beklenen üretimden
  gelir; 4-5 maçlık örneklemde fark büyük.
  UCL karşılığı: `lib/stats.ts` + `data/player-stats.json`.

- [ ] **1.4 Az veri düzeltmesini ölçülmüş mevki ortalamasına bağla.** (S)
  `lib/xp.ts` `PRIORS` elle yazılı (FWD 0,35 gol/90 vb.). Mevki ortalamalarını veriden
  hesapla; 1.3 bittikten sonra xG tabanlı.

---

## 5. Faz 2 — Yeni veri

- [ ] **2.1 Sonuç verisi ve `/results`.** (M)
  Aynı FotMob sayfalarında `matchFacts.events` (gol dakikası, atan, asist, penaltı, kart),
  `playerOfTheMatch` ve iki takımın kadrosu var. Skorlar zaten elimizde; eksik olan
  **maçın içi**. Sonuçlar sayfası: hafta hafta maçlar, dokununca goller/kartlar/kadrolar.
  Puan durumu zaten `Standings` bileşeninde; oraya taşınır.
  Not: `playerOfTheMatch` 1.1'deki bonus çözümünü de doğrular.
  UCL karşılığı: `lib/results.ts`, `app/results/page.tsx`, `components/Results.tsx`.

- [ ] **2.2 Fiyat ve seçilme günlüğü.** (S)
  Oyun yalnız anlık değeri veriyor. "Bu hafta kim zamlandı, kim düşüyor" ancak kendi
  tuttuğumuz seriyle yanıtlanır ve **geriye dönük toplanamaz** — ne kadar geç başlarsak
  o kadar veri kaybı. Bu yüzden Faz 2'nin başında.
  UCL karşılığı: `lib/history.ts`, `scripts/log-snapshot.mjs`.

- [ ] **2.3 Kaynak tazeliği.** (S)
  Her veri grubunun son güncellenme tarihi ve beklenen aralığı; dipnotta "Elo 6 gündür
  eski" diyebilmek. Bugün kullanıcı bunu göremiyor.
  UCL karşılığı: `lib/freshness.ts`, `lib/source-meta.ts`, `components/DataSources.tsx`.

- [ ] **2.5 Piyasa beklenen golü (bahis oranları).** (M)
  The Odds API'den Süper Lig maç sonucu ve toplam gol oranları; şirket başına marj ayıklanıp
  medyan alınır, iki bağımsız Poisson'la takım başına λ çıkar. Ham oran saklanmaz.
  Oranı olan maçta `model^(1−w) · piyasa^w`, olmayanda yalnız güç farkı. Anahtar depo sırrı.
  UCL karşılığı: `scripts/update-odds.mjs`, `scripts/lib/market.mjs`, `lib/market.ts`.

- [ ] **2.4 Elo kaynağı.** (S, engelli)
  clubelo.com bugün de 502 veriyor (18.09), elofootball erişilemiyor. `elo` alanı isteğe
  bağlı kalsın; kaynak açılınca `scripts/update-elo.mjs`.

---

## 6. Faz 3 — Sayfa yapısı ve tasarım

Tek sayfa uzadı (ekran görüntüsünde masaüstünde ~4200 px). Bölme hem okunurluk hem paket
boyutu için. Bu faz her bileşene dokunuyor, o yüzden Faz 4'ten **önce**: sonraki özellikler
doğru yere insin.

- [ ] **3.1 Çok sayfa + gezinme.** (L)
  `/` model ve önizleme · `/teams` · `/players` · `/squad` · `/results` · `/methodology`.
  Durum `PlannerContext` ile taşınır (Shell yerleşimde kalır, gezinmede durum korunur).
  `PageHead` (her sayfada tek h1), `ContextBar` (o sayfadaki sayıları belirleyen ayarlar çip
  olarak), telefonda alt sekme çubuğu.
  UCL karşılığı: `components/{Nav,PageHead,ContextBar,PlannerContext,sections}.tsx`.

- [ ] **3.2 Tasarım belirteçleri ve açık tema.** (M)
  Bugün paletler `globals.css` içinde koyu-tek; yazı boyutları px. UCL'de rol tabanlı yazı
  ölçeği (`--text-micro/caption/label/body`), rem tabanlı (tarayıcı yazı ayarını izler),
  köşe/boşluk belirteçleri, `data-theme="light"` paleti ve üst çubukta tema düğmesi var.
  Varsayılan tema kararı kullanıcıya ait (UCL'de açık seçildi).
  UCL karşılığı: `app/globals.css`, `lib/theme.ts`, `components/ThemeSwitch.tsx`,
  `docs/design-system.md`.

- [ ] **3.3 Ağır hesabı Web Worker'a al.** (M)
  Kadro kurma gerçek havuzda ~0,3 s; kaydırak oynatınca ana iş parçacığı donuyor.
  UCL ölçümü: sekmeye basınca ~0,5 s (yavaş telefonda 2 s+) boyama gecikiyordu.
  UCL karşılığı: `lib/compute-jobs.ts`, `lib/compute.worker.ts`, `components/useComputed.ts`.

- [ ] **3.4 Oyuncu ve kulüp sayfaları.** (M)
  `/players/<oyuncu>`: başlama olasılığı, oranlar, hafta hafta beklenen puan dökümü.
  `/teams/<kulüp>`: kadronun tamamı. Derleme anında statik.
  Bugün bu bilgi yalnız `title` ipucunda; mobilde erişilemiyor.

---

## 7. Faz 4 — TFF'ye özel özellikler

- [ ] **4.1 Kadro kaydetme (tarayıcıda).** (M)
  Kadroyu bir kez gir, her hafta öneri al; dışa/içe aktarmayla cihaz değiştir.
  Hesap yok (CLAUDE.md yasak), bedeli dürüstçe yazılır: tek tarayıcıya bağlı.
  UCL karşılığı: `lib/saved-squads.ts`, `components/{SavedSquads,useSavedSquads}.tsx`.

- [ ] **4.2 "Kadromu iyileştir" sayfası.** (M)
  UCL'nin transfer planlayıcısının TFF'ye uyarlanmış hâli. TFF'de transfer sınırsız ve
  cezasız olduğu için soru "kaç transfer yapayım, ceza değer mi" değil: **"elimdeki kadroda
  hangi değişiklik bu haftanın beklenen puanını artırır"**. Çıktı: bütçe ve kulüp sınırı
  korunarak sıralı takas listesi, her satırda kazanç.
  UCL'den alınacak: aday kısa listesi + kadro üstünde tam değerlendirme yöntemi.
  UCL'den alınmayacak: hak muhasebesi, ceza, çok haftalı açgözlü arama.

- [ ] **4.3 Sezon günlüğü.** (M)
  Hafta hafta gerçekte oynattığın 11 + kaptan girilir, gerçek puan hesaplanır. Oyunun
  beslemesi yalnız birikmiş puan veriyor; kimin 11'de olduğunu bilmiyor.
  **Alternatif ve daha iyisi:** oyunun kendi API'sinde `fantasy-team/teams/<id>?gameweek-id=<n>`
  ucu var (PROJECT.md §3.1). Giriş varken kadro **otomatik** okunabilir; elle girmeye gerek
  kalmaz. Oturum düştüğü için bugün doğrulanamadı (401) — 4.3'ün ilk adımı bu ucu doğrulamak.
  UCL karşılığı: `lib/season-log.ts`, `components/SeasonLog.tsx`.

- [ ] **4.4 Yöntem sayfası.** (M)
  Modelin ne yaptığı, hangi sabitin nereden geldiği, neyin ölçülmediği. Sayılar koddan
  okunur (elle yazılan ikinci kopya bayatlıyor).
  UCL karşılığı: `components/Methodology.tsx`, `app/methodology/page.tsx`.

---

## 8. Faz 5 — Otomasyon ve yayın kalitesi

- [ ] **5.1 CI: her push'ta typecheck + lint + test + build.** (S)
  UCL karşılığı: `.github/workflows/ci.yml`.

- [ ] **5.2 Günlük veri işi — kısmi.** (M)
  **Kısıt:** oyunun API'si Keycloak + Google girişi istiyor; GitHub Actions'ta oturum açmanın
  güvenli bir yolu yok ve CLAUDE.md token'ı hiçbir yere yazmayı yasaklıyor. Bu yüzden:
  - CI'da koşabilenler: FotMob (sakatlık, son maçlar, tahmini 11), Opta, Transfermarkt.
  - Yerelde kalanlar: oyunun beslemesi (fiyat, seçilme, skor, haftalar).
  `scripts/update-all.mjs` iki kipte çalışsın ve hangi grubun ne zaman yenilendiği
  `source-meta` üzerinden görünsün (2.3'e bağlı).
  UCL karşılığı: `scripts/update-all.mjs`, `scripts/lib/schedule.mjs`, `.github/workflows/update-data.yml`.

- [ ] **5.3 Yayın kabuğu.** (S)
  `robots.ts`, `sitemap.ts`, temalı `not-found.tsx` ve `error.tsx`, güvenlik başlıkları (CSP).

- [ ] **5.4 Erişilebilirlik ve mobil ölçümü.** (M)
  Altı genişlikte ölçüm, 44 px dokunma hedefi, 11 px altı metin yok, kontrast kapısı,
  yatay kayan tabloların klavyeyle kaydırılabilmesi.
  UCL karşılığı: `scripts/{ui-audit,reflow-check,contrast-check,cls-check}.mjs`.

---

## 9. Kararlar (18.09.2026, kullanıcı)

1. **Menajer kartları: hepsi modellenecek.** Tripleks (×3) ve Dört Dörtlük (×4) kaptan
   çarpanını değiştirir — kaptan seçimi kart başına değişebilir. Tüm Takım Sahaya yedek
   ağırlığını 1'e çıkarır, Limitsiz Bütçe bütçe kısıtını kaldırır, Hücum diziliş kısıtını
   kaldırır ve +5 M bütçe verir. CLAUDE.md'deki eski yasak kaldırıldı.
   Arayüz kuralı: ilk kullanımdan sonra **ücretli** olduğu her öneride yazılı kalsın.
2. **Varsayılan tema: açık.** Koyu tema seçenek olarak kalır, seçim adreste taşınır.
3. **Sayfa yapısı: çok sayfaya bölünecek.** (Faz 3.1)
4. **Bahis oranları: eklenecek.** The Odds API, Süper Lig. Yeni madde 2.5.

Açık kalan tek soru teknik ve doğrulamayla çözülecek (madde 4.3-ön): oyunun
`fantasy-team/teams/<id>?gameweek-id=<n>` ucu kendi kadromu veriyorsa 4.1 (elle kadro
kaydetme) ve 4.3 (elle sezon günlüğü) büyük ölçüde gereksizleşir.

---

## 10. Önerilen sıra

Bağımlılık ve değere göre:

```
Faz 0 (bugün)  →  1.1 → 1.2 → 1.3 → 1.4        modelin doğruluğu
               →  2.2 (erken: geriye dönük toplanamaz)
               →  3.1 → 3.2 → 3.3               yapı, sonrası doğru yere insin
               →  2.1 → 2.3 → 3.4               veri ve sayfalar
               →  4.3-ön (oyun ucu doğrulama) → 4.1 → 4.2 → 4.3 → 4.4
               →  5.1 → 5.2 → 5.3 → 5.4
```

İki istisna, ikisi de bilinçli: **2.2 (fiyat günlüğü)** sırasından önce çünkü geçmiş veri
geriye dönük toplanamıyor; **4.3'ün ilk adımı** (oyunun kadro ucunu doğrulama) Faz 4'ten önce
çünkü sonucu 4.1 ve 4.3'ün kapsamını değiştiriyor.

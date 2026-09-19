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

- [x] **1.1 Puan tablosunu veriden çöz ve sına.** (18.09.2026)
  `scripts/solve-scoring.mjs`: oyuncu başına bir denklem, mevki başına en küçük kareler.
  Sayımların bir kısmı oyunun resmî sezon toplamlarından, eşik taşıyanlar maç maç kayıttan.

  **Doğrulandı.** Forvet kontrol grubu gibi davrandı: gol 3,97 (tablo 4), asist 2,99 (3),
  süre 1,02 (1), sarı −1,04 (−1), bonus 0,98 (1), RMSE 0,19. Orta sahada da gol 4,80 (5),
  asist 3,05 (3). Yani yöntem çalışıyor ve tablo hücum tarafında doğru.

  **İki düzeltme çıktı.**

  1. *Gol yememe tam maç istiyor, 60 dakika değil.* Kanıt regresyon değil, doğrudan sayı
     eşleşmesi: oyuncunun sezon `cleanSheets` alanı bizim hesabımızla karşılaştırıldı.

     | | oyunun toplamı | 60 dk tanımı | 90 dk tanımı | 90 dk birebir |
     |---|---|---|---|---|
     | Kaleci | 21 | 21 | 21 | 21/21 |
     | Defans | 66 | 78 | 67 | 102/103 |
     | Orta saha | 37 | 82 | 39 | 141/143 |
     | Forvet | 2 | 22 | 3 | 48/49 |

     Örnek: Ruan'ın takımı iki maçta gol yememiş ama o 81 ve 86 dakika oynamış; oyun sıfır
     yazmış. Forvetteki 2 de böyle: yalnız üç forvet gol yenmeyen bir maçta tam 90 oynamış.

  2. *Yenilen gol cezası yalnız oyuncu sahadayken yenilen gole işliyor.* Eskiden oyundan
     çıkan defansa sonradan yenilen goller de kesiliyordu. Düzeltmeyle defansta oyunun
     puanını birebir veren oyuncu **31'den 51'e** çıktı, RMSE 1,44 → 1,16. Gol dakikaları
     FotMob maç sayfalarından; `concededOn` olarak `data/lineups.json`'a yazılıyor.

  **Modele etkisi:** `lib/xp.ts` gol yememe kalemini `p60` ile çarpıyordu. Ölçüm: başlayanın
  60'ı geçme olasılığı 0,912, tam 90 oynama olasılığı 0,597. Yani kalem ~1,5 kat şişikti.
  Artık `p90` kullanılıyor. 369 yedek girişinin hiçbiri 90'a ulaşmadığı için yedek bu puanı
  hiç alamıyor.

  **Çürütüldü:** savunma aksiyonu / top kazanma terimi. FotMob'dan alınan tackle, interception,
  clearance, block ve recovery sütunları aday olarak eklendi; katsayıları 0,01-0,08 çıktı ve
  birebir tutmayı hiç değiştirmedi. Kural sayfasında yazmayan bir savunma kalemi yok.

  **Sonuç (asıl ölçü).** Önemli olan serbest çözümün katsayıları değil, *gönderdiğimiz
  tablonun* oyunun puanını yeniden kurabilmesi:

  | | düzeltmelerden önce | sonra |
  |---|---|---|
  | Defans birebir | 64 / 108 | **87 / 108** |
  | Defans RMSE | 1,86 | 1,37 |
  | Orta saha birebir | — | 97 / 150 |
  | Forvet birebir | — | 50 / 52 |

  **Açık kalan iki şey, ikisi de bilinçli bırakıldı.** (İkincisi 18.09'da kapandı — bkz. altı.)

  - *Serbest çözüm defans ve kalecide tabloya oturmuyor* (gol yememe ~2,7, olması gereken 4;
    bonus ~1,4, olması gereken 1). Ama o çözüm daha düşük RMSE'ye rağmen birebir tutmayı
    87'den 56'ya **düşürüyor** — yani gerçeği bulmuyor, aşırı uyum yapıyor. Sütunlar
    (maç sayısı, 60 dk üstü, gol yememe, yenilen gol) birbirine fazla bağlı ve 5 haftalık
    veri bunları ayırmaya yetmiyor. Terim uydurulmadı.
  - *Kaleci zayıf: 5/21.* Sebebi biliniyor: kurtarış puanı **maç başına** üçer üçer işliyor,
    bizim elimizde yalnız sezon toplamı var. 5 maçta ikişer kurtarış yapan kaleciye maç
    başına 0, sezon toplamıyla 3 puan yazılıyor. Maç bazlı kurtarış FotMob maç sayfalarında
    var; 1.3 ile gelecek ve o zaman yeniden ölçülecek.

    **18.09 — ÇÖZÜLDÜ: 5/21 → 22/22, RMSE 0,00.** Maç bazlı kurtarış `solve-scoring.mjs`'e
    bağlandı (`saveSteps` artık sezon toplamından değil, maç maç `floor(saves/3)` toplanarak
    geliyor) ve pencere `--matches 9`'a çıkarıldı. Kalecinin **her katsayısı** tabloya birebir
    oturdu: sahaya çıkma 1,00 · 60 dk üstü 1,00 · gol yememe 4,00 · yenilen gol −1,00 ·
    **kurtarış 1,00** · bonus 1,00. Kaleci puan tablosu artık varsayım değil, kanıtlanmış.

    *Bu arada kendi ara iddiamı düzeltiyorum.* Pencere genişlemeden önce "tıkanma kurtarışın
    temsilinde değil, örneklem boyutundaydı" diye yazmıştım — ölçmeden. Karşı-olgusal sınama
    (betiğin kopyası, n=22 ama kurtarış yine sezon toplamı) tersini gösterdi:

    | n=22 kaleci | birebir | RMSE |
    | --- | --- | --- |
    | kurtarış sezon toplamı | 6/22 | 1,07 |
    | kurtarış maç bazlı | **22/22** | **0,00** |

    Yani örneklemi 21'den 22'ye çıkarmak 5/21'i 6/22 yaptı — neredeyse hiçbir şey. Düzelten
    tamamen **temsil**di. Sezon toplamı kullanılırken sahaya çıkma katsayısı 0,21 (olması
    gereken 1) çıkıyordu: kurtarış hatası diğer sütunlara yayılıyormuş.

    Saha oyuncularında kurtarış değişikliği hiçbir şeyi oynatmadı, ki beklenen buydu: saha
    oyuncusunun kurtarışı sıfır. Oradaki iyileşme yalnız daha çok veriden geldi —
    DEF 81/100 → 93/113, MID 87/140 → 98/161, FWD 46/49 → 51/54.
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

- [x] **1.3 Maç bazlı oyuncu istatistiği (xG/xA + kurtarış).** (M) — 18.09 tamamlandı.
  Arayüz metinleri de modelle hizalandı (`lib/i18n.ts`, iki dilde): sıralama notu artık gol/asist
  oranının ham sayımla beklenen üretimin harmanı olduğunu söylüyor ("sezon oranı" yazıyordu),
  kural metni ise kurtarışın her maçın kendi içinde sayıldığını — gol yememe ve yenilen golde
  olduğu gibi. Menajer kartları için "modelde yok" cümlesine dokunulmadı: Faz 4.0 gelene kadar
  o cümle doğru.
  1.1'den gelen ek gerekçe: **kurtarış maç başına üçer üçer puanlanıyor ama elimizde yalnız
  sezon toplamı var.** 5 maçta ikişer kurtarış yapan kaleciye kural 0, bizim hesabımız 3 puan
  yazıyor. Kaleci yeniden kurma başarısının 5/21'de kalmasının bilinen sebebi bu. Maç bazlı
  kurtarış FotMob maç sayfalarında kalecilerin **%100'ünde** var (92/92 kayıt).

  **Kararlar (18.09).**
  - *Ayrı dosya ve ikinci geçiş yok.* İstatistikler `fetch-lineups.mjs`'e katıldı, çünkü o
    zaten aynı maç sayfalarını açıyor. UCL'de ayrı `data/player-stats.json` var; burada tek
    kaynak ve tek çekim daha basit.
  - *Eksik şut grubu "sıfır şut" demek, eksik veri değil.* Ölçüldü: "Total shots" alanı
    olmayan 720 kaydın **hiçbiri gol atmamış**, alanı olan 684 kaydın **hiçbirinde şut 0
    değil**. Yani grup ancak oyuncu şut attıysa yazılıyor; 0 varsaymak doğru ve gerçek
    kapsam %100. Alan bazlı ham kapsam yanıltıcı görünüyordu (xG %49, xA %67).
  - Saklananlar: `xg`, `xgnp` (penaltısız; 684 kaydın yalnız 14'ünde farklı), `xa`, `shots`,
    `chances`, `saves`.

  **Ölçüm ve bulunan hata (18.09).** Maç bazlı kurtarış verisi ilk kez ölçülebildi: tam maç
  oynayan kalecilerde 87 maçta 272 kurtarış, yani **saves90 = 3,13** (elle yazılmış 3,0'a
  yakın — prior sorun değilmiş). Asıl hata başka yerdeydi: `lib/xp.ts` beklenen kurtarışı
  **doğrudan 3'e bölüyordu**, oysa puan maç içinde üçer üçer işliyor.

  | E[floor(S/3)], λ = 3,13 | değer |
  | --- | --- |
  | ampirik (87 maç) | **0,690** |
  | Poisson yaklaşımı | 0,707 |
  | eski kod (λ/3) | **1,042** |

  Eski hâli kaleci kurtarış puanını **%51 fazla** yazıyordu. Düzeltildi: `conceded` teriminin
  zaten kullandığı eşik fonksiyonu (`expectedConcededSteps` → adı artık `expectedSteps`, çünkü
  iki terim de onu kullanıyor) kurtarışa da uygulandı. Kurtarış dağılımı Poisson'dan yayvan
  (varyans/ortalama 1,75) ama eşik beklentisi yine de ampirikten %2,5 sapıyor; bölme ise %51.
  Test bu hatayı sabitliyor (`easy.saves < λ/3`).

  **Etkisi ölçüldü:** her kaleci hafta başına ~0,25-0,33 puan kaybediyor, ama sıralama neredeyse
  hiç değişmiyor (ilk 10'da yalnız komşu 3 yer değişti: Nübel iki basamak yukarı, Muhammed ile
  Onana birer basamak aşağı). Yani sayı yanlıştı ve düzeltildi; beslediği karar büyük ölçüde
  aynı kalıyor. Kaleci karşılaştırmalarının çoğu gol yememe ve süre puanına dayanıyor.

  **xG harmanı: ölçüldü, uydurulmadı.** Başta "5 hafta yetmez, ağırlık ölçülemez" diye
  yazmıştım; yanlışmış. Soru örneklem dışı sorulabiliyor: her maç yalnız kendinden önceki
  maçlardan kurulan oranla tahmin edilir, skor Poisson log-olabilirliği (687 maç, 70 gol,
  44 asist).

  | ağırlık w (`w·xG + (1−w)·gol`) | gol LL | asist LL |
  | --- | --- | --- |
  | 0,00 — yalnız ham sayım | −227,8 | −179,8 |
  | 0,50 | −219,1 | −166,5 |
  | 0,75 | −216,9 | −163,2 |
  | 1,00 — yalnız beklenen | **−216,0** | **−161,2** |

  **Kontrol şart oldu.** Oyuncu başına 1-2 maçlık geçmişte ham gol neredeyse hep 0; sürekli bir
  sayı olan xG, oyuncu hakkında hiçbir şey bilmese bile kazanırdı. Permütasyon: her oyuncunun
  xG geçmişi başkasınınkiyle değiştirildi (25 tekrar).

  | | gerçek kazanç | başkasının verisiyle |
  | --- | --- | --- |
  | gol / xG | +11,73 | **−23,24** (hep negatif) |
  | asist / xA | +18,65 | **+7,63** |

  Sonuç iki ayrı hikâye. xG'de fayda tamamen oyuncuya özgü — yabancı bir xG ham golden daha
  kötü. xA'da ise görünen kazancın yaklaşık %40'ı yalnız pürüzsüzlükten geliyor; üstünde kalan
  ~+11 gerçek. İkisinde de 25 permütasyonun hiçbiri gerçek kazanca ulaşmadı.

  **Uygulanan:** `XG_WEIGHT = 0,7` (`lib/xp.ts`). Tepe 1,0'da ama eğri 0,75'ten sonra
  düzleşiyor; 70 gollük örneklemde ham golü tümden atmamak için 0,7. Kesin en iyi nokta bu
  veriyle ayırt edilemez, öyle de yazıldı. Harman yalnız beklenen üretim penceresi ≥ 180 dk
  ise uygulanıyor: resmî sayımlar sezonun tamamını, xG son maçları kapsıyor — kısa pencereden
  çıkan oranı sezon oranıyla harmanlamak yanıltıcı olurdu. **Bilinen sınır:** ölçüm aynı
  pencerede yapıldı, uygulama iki farklı pencereyi harmanlıyor. Bugün bu fark önemsiz — sezonun
  5. haftasındayız, yani sezon penceresi zaten FotMob penceresi kadar (örnek: Orban'da resmî 343
  dakikaya karşı 341). **Sezon ilerledikçe büyüyecek**; resmî toplamlar 34 haftaya çıkarken
  `--matches 6` sabit kalırsa harman giderek farklı iki dönemi karıştırır. Takip edilecek:
  `fetch-lineups.mjs --matches` sezonla birlikte artmalı.

  **Etkisi ölçüldü (80 hücum oyuncusu, 79'una harman uygulandı).** Yön doğru: xG'si gollerinden
  fazla olanlar yükseliyor (Henrique 0 gol / 1,12 xG: g90 0,181 → 0,282), golleri xG'sinden
  fazla olanlar iniyor (Orban 6 gol / 4,70 xG: 0,947 → 0,832; Salah 4 gol / 2,12 xG: 0,541 →
  0,393). Yani harman, az maçta şansla gol atmış oyuncuyu ödüllendirmeyi bırakıyor — zaten
  ölçümün vaat ettiği davranış buydu.

  **Yanlış çıkan bir varsayım ve asıl sebep.** Yeniden çekimden sonra `solve-scoring.mjs`'in
  örneklemi daraldı (DEF 108→100, MID 150→140, FWD 52→49, GK 21→19). Betik, FotMob dakikasıyla
  oyunun dakikası 20'den fazla ayrışan oyuncuyu eliyor. "Oyunun beslemesi 12.09'da dondu, FotMob
  artık daha çok maç görüyor" diye açıklamıştım — **ölçünce tersi çıktı**: işaretli fark
  (FotMob − oyun) ortalama −2,8 dk, elenen 70 oyuncuda −16,8 dk, ve elenenlerin yalnız
  27'sinde FotMob daha fazla görüyor.

  Sapmalara bakınca gerçek sebep iki ayrı şey:

  - **Tam −90'lık küme** (Nübel, Agbadou, Djaló, Taylan / Beşiktaş; Škriniar, Tarık /
    Fenerbahçe): FotMob bu oyuncuların bir tam lig maçını hiç görmüyor. Aynı takımda birden
    çok oyuncuda çıkması, bunun oyuncu değil **takım düzeyinde eksik maç** olduğunu gösteriyor.
    Sebep `--matches 6`: **Avrupa'da oynayan takımların son 6 fikstürüne Avrupa maçları
    giriyor**, geriye 5 yerine 4 lig maçı kalıyor.
  - **Tam +91'lik küme** (Ilie, Güven / Kasımpaşa; Masuaku / Konyaspor): bu sefer oyunun
    donmuş toplamı 5. haftayı görmüyor. İlk varsayımım yalnız bu küçük küme için doğruymuş.

  Düzeltme: pencere `--matches 9`'a çıkarıldı (betiğin varsayılanı da), böylece Avrupa'da
  oynayan takımlara da yeterli lig maçı düşüyor. **Sonuç doğrulandı:** elenen oyuncu 70 → 28,
  −90'lık küme tamamen kayboldu. Kalan 28'in 27'sinde FotMob artık *daha fazla* dakika görüyor
  ve neredeyse hepsi Kasımpaşa/Konyaspor — yani geriye yalnız ikinci sebep kaldı, oyunun donmuş
  beslemesi. İki sebep ayrı ayrı doğrulanmış oldu. Örneklem her mevkide büyüdü
  (GK 19→22, DEF 100→113, MID 140→161, FWD 49→54).

  Geriye tek tek bir uyumsuzluk kalıyor: Ümit (Beşiktaş), oyunda 270 dk, FotMob'da 0 — bu bir
  pencere sorunu değil, ad eşleme sorunu. Sezon ilerledikçe pencere yine büyümeli.
  FotMob maç sayfalarında saha oyuncusu için `Expected goals (xG)`, `xGOT`, `xA`,
  `Total shots`, `Chances created`, `Recoveries`; kaleci için `Saves`, `xGOT faced`,
  `Goals prevented` var. **Sayfalar zaten indiriliyor** (`fetch-lineups.mjs`, 47 maç
  önbellekte) — ek indirme yok, yalnız ayıklama.
  Ne kazandırır: gol/asist oranı sezon toplamı yerine daha az gürültülü beklenen üretimden
  gelir; 4-5 maçlık örneklemde fark büyük.
  UCL karşılığı: `lib/stats.ts` + `data/player-stats.json`.

- [x] **1.4 Az veri düzeltmesini ölçülmüş mevki ortalamasına bağla.** (S) — 18.09 tamamlandı.
  `lib/xp.ts` `PRIORS` elle yazılıydı (FWD 0,35 gol/90 vb.). Artık `lib/priors.ts` import
  anında `data/lineups.json`'dan sayıyor — `lib/minutes.ts` ile aynı gerekçe: bir ölçümü koda
  kopyalamak, kopyayı bayatlatıyor. Gol ve asist önceliği plana uygun olarak **xG/xA tabanlı**.

  | | elle | ölçülen | |
  | --- | --- | --- | --- |
  | Kaleci bonus/90 | 0,350 | **0,761** | +%117 |
  | Forvet bonus/90 | 0,450 | **0,783** | +%74 |
  | Defans bonus/90 | 0,300 | **0,460** | +%53 |
  | Orta saha bonus/90 | 0,350 | 0,339 | −%3 |
  | Forvet gol/90 | 0,350 | **0,440** | +%26 |
  | Forvet asist/90 | 0,140 | **0,078** | −%44 |
  | Kaleci sarı/90 | 0,080 | 0,033 | −%59 |
  | Kaleci kurtarış/90 | 3,130 | 3,076 | −%2 |

  **En büyük hata bonustaydı** ve tek yönlüydü: orta saha dışında her mevkide düşük yazılmış.
  Orta sahanın doğru çıkması, elle yazılan sayıların muhtemelen orta sahaya bakılarak
  kestirildiğini düşündürüyor.

  **İki yerde ölçüme körü körüne uyulmadı, ikisi de bilinçli:**

  - *Kırmızı kart.* 5 haftada kaleci ve defansta hiç kırmızı kart yok, yani ölçüm sıfır veriyor.
    Sıfırı almak "kırmızı kart imkânsız" demek olurdu; gözlenmemesi nadir olmasından, imkânsız
    olmasından değil. `RED_FLOOR = 0,005` tabanı kondu ve iki mevkide gerçekten devreye girdi.
    Ölçüm tabanın üstündeyse ölçüm kazanıyor (orta saha 0,012, forvet 0,017).
  - *Forvet asisti.* Öncelik xA tabanlı olduğu için 0,140'tan 0,078'e düştü: bu örneklemde
    forvetlerin gerçek asisti (15) xA'yı (9,2) belirgin aşıyor. 13 forvetlik bir örneklemde
    hangisinin doğru olduğunu **söyleyemeyiz**. Plan xG tabanlı öncelik istediği ve 1.3'te
    beklenen üretimin daha iyi öngördüğü ölçüldüğü için xA seçildi; **izlenecek bir kalem**,
    sezon uzadıkça yeniden bakılmalı.

  Sessiz bozulmaya karşı kalıcı test var (`lib/priors.test.ts`): ölçüm yedeğe düşerse her şey
  yine "çalışır" görünürdü, oysa model eski elle yazılı sayılara dönmüş olurdu. Test
  `PRIORS_MEASURED`'ı ve yedekle birebir aynı olmadığını doğruluyor.

---

## 5. Faz 2 — Yeni veri

- [x] **2.1 Sonuç verisi ve `/results`.** (M) — 19.09 tamamlandı.
  Skorlar zaten elimizdeydi; eksik olan **maçın içi**. `scripts/fetch-results.mjs` aynı FotMob
  maç sayfalarından (ek indirme yok, sayfalar zaten önbellekte) goller, kartlar, kaçan
  penaltılar, maçın adamı ve iki kadroyu çıkarıp `data/results.json`'a yazıyor: **46 maç,
  0 eşlenemeyen**. Okuma tarafı `lib/results.ts`, sayfa `components/Results.tsx` + `/results`.

  **Anahtar ölçülerek seçildi.** FotMob UTC anı veriyor, bizim fikstür İstanbul tarihi tutuyor;
  geç başlayan maçta gün kayabilirdi. Tarih aritmetiğine hiç girmedim: 306 fikstürde
  **306 benzersiz `ev|deplasman` çifti** var (sayıldı), yani sıralı çift tek başına anahtar.

  **Puan tablosu kopyalanmadı.** UCL'nin `results.ts`'i kendi `standings`'ini hesaplıyor; TFF'de
  `lib/data.ts` `computeTable()` zaten var ve TFF'nin kendi eşitlik bozma ölçütlerini kullanıyor.
  İkincisini eklemek tabloyu iki doğruluk kaynağından üretmek olurdu. `Standings` bileşeni
  `/teams`'ten `/results`'a taşındı; skora dayanan her şey tek sayfada.

  **Ayrıştırıcı örnekten değil sayımdan yazıldı.** İki maç sayfasına bakıp genelleseydim sessizce
  veri kaybederdim; onun yerine önbellekteki 59 sayfanın tamamı tarandı:

  | bulgu | sayı |
  | --- | --- |
  | `MissedPenalty` olayı | 5 (iki örnekte hiç yoktu) |
  | `YellowRed` (ikinci sarı) | 5 — kart **üç** değer alıyor, iki değil |
  | `penalty` / `owngoal` golü | 14 / 6 |
  | `direct_free_kick` | 1, yalnız Avrupa maçında |
  | `assistStr` dolu ama `assistInput` boş | **0** → asist için tek alan yeter |

  `matchPage` yalnız **eklenerek** genişletildi; `fetch-lineups.mjs`'in bağlı olduğu `lineup`,
  `goals`, `stats`, `conceded` alanlarının gerçek bir sayfada bozulmadığı ayrıca doğrulandı.
  Şişkin `shotmapEvent` saklanmıyor.

  **Bir varsayımım daha ölçülüp çürütüldü.** Kendi kalesine golün, atan oyuncunun tarafına
  işaretlenip skora ters yazıldığını varsaymış ve testi öyle yazmıştım. Test düştü (Gaziantep-
  Rizespor). Ölçüm: ters çevirmek **5 maçta** tutmuyor (veride tam 5 kendi kalesine gol),
  çevirmemek **0**, `newScore` farkından türetmek **0**. Yani FotMob'un `home` alanı golün
  **yazıldığı taraf**, atanın tarafı değil. Testi gevşetmek yerine varsayım düzeltildi.

  **Donmuş beslemenin izi burada da var:** FotMob'un bitmiş saydığı bir maçı (Kasımpaşa-
  Konyaspor, 6. hafta) oyunun verisi henüz skorlamamış — olayları dolu, skoru null. Tip bunu
  taşıyor (`hg: number | null`) ve arayüz skor yerine saati yazıyor. Aynı iki kulüp 1.3'teki
  dakika ayrışmasında da çıkmıştı; teşhisi bağımsız olarak doğruluyor.

  **Varsayılan hafta: ilk düzeltmem sözde kaldı.** "Planlanan hafta" boşa yakın bir sayfa
  açıyordu (6. haftada 1/9 maç). Önce "sonucu olan son hafta" yazdım — ama 6. haftanın `played`
  değeri 1, yani sıfırdan büyük ve aynı haftayı veriyordu; hiçbir şey değişmemişti. Doğrusu
  **tamamlanmış son hafta**. Tarayıcıda doğrulandı: sayfa 5. haftayla ve 9 maç satırıyla açılıyor.

  **Tarayıcıda doğrulanan:** açılan hafta 5, 9 maç satırı, görünür metinde bozuk değer yok,
  ayrıntı açılıyor ve iki kadro çiziliyor, puan durumu sekmesi tabloyu getiriyor. *Not:*
  `document.body.textContent` ile "null" aramak yanlış alarm veriyor — Next sayfaya RSC yükünü
  gömüyor ve orada `"hg":null` zaten geçiyor; tarama yalnız görünür metne daraltıldı.

  Bütünlük için 8 yeni test (`data/results.test.ts`): fikstüre bağlanma, tekillik, skorun oyunun
  verisiyle birebirliği, değer kümeleri ve **gollerin toplamının skorla tutması**. Sayılar
  sabitlenmedi (her hafta artıyor); toplam test 143 → 151.

  **Yapılmadı, bilerek:** oyuncu adları bağlantı değil — oyuncu sayfaları **3.4**'e ait.
  Planın "`playerOfTheMatch` 1.1'deki bonus çözümünü doğrular" notu da **henüz yapılmadı**:
  veri artık elimizde ama karşılaştırma yapılmadı, açık iş olarak duruyor.

- [x] **2.2 Fiyat ve seçilme günlüğü.** (S) — 18.09 tamamlandı, **ilk kayıt alındı.**
  Oyun yalnız anlık değeri veriyor. "Bu hafta kim zamlandı, kim düşüyor" ancak kendi
  tuttuğumuz seriyle yanıtlanır ve **geriye dönük toplanamaz** — ne kadar geç başlarsak
  o kadar veri kaybı. Bu yüzden Faz 2'nin başındaydı.

  İlk anlık görüntü: **528 oyuncu, gün 2026-09-18**. Bu günün fiyatları artık kalıcı.
  Yazan `scripts/log-snapshot.mjs` + `scripts/lib/history-log.mjs` (saf mantık), okuyan
  `lib/history.ts`. Biçim: gün listesi bir kez, seriler indeksle bakar ve **yalnız değer
  değiştiğinde** satır eklenir — çoğu fiyat haftalarca sabit kaldığı için dosya küçük kalıyor.

  **UCL'den taşınan üç koruma** (üçü de orada hatadan sonra eklenmiş; yeniden keşfetmek
  yerine taşındı):

  - *Gözlem günü.* Kaydedilen gün, oyuncu dosyasının kendi tarihi (`meta.fetched`), saatin
    günü değil. Oyun çekimi başarısız olup dosya eski kalırsa bayat değerler bugünün
    gözlemi diye yazılamıyor.
  - *Gün sırası.* Yalnız son günden sonrası eklenir ya da son gün yeniden yazılır; geçmiş
    güne yazma reddedilir ve **girdi hiç değiştirilmez**. Sırası bozuk ya da tekrarlı gün
    listesi de reddediliyor.
  - *Sezon penceresi.* Sezon öncesi günler, sınırdaki değer taşınarak düşüyor.

  **TFF'ye özgü üç fark:**

  - Tarih alanı `meta.fetched` (UCL'de `updated`); `FantasyMeta` tipine eklendi.
  - Kalıcı kimlik `gameId`. Anahtar `takım|ad` ve TFF'de kısa adlar takım içinde tekrar
    ediyor ("Arda", "Arda (2)"), yani ad değişirse seri öksüz kalırdı; `gameId` kaymayı
    görünür kılıyor ve seri yeni anahtara taşınıyor. Hedef anahtar doluysa taşınmıyor,
    bildiriliyor — üzerine yazmak veri kaybı olurdu.
  - **`net` serisi yok.** UCL'de transfer giriş/çıkış farkı tutuluyor; TFF oyunu bu veriyi
    vermiyor, o yüzden seri açılmadı. Olmayan veriden seri üretilmiyor.

  **Bilerek taşınmayan:** `mdPoints` / `dayAfterMatchday` / `coveredMatchdays`. UCL'nin kendi
  yorumu `mds` alanını ilk yazımda yanlış okuduğunu ve kullanıcı uyarısıyla düzeltildiğini
  kaydediyor. Bilinen bir tuzağa körlemesine girmek yerine hafta bazlı puan türetimi kendi
  yerinde, **Faz 4.3'te** yapılacak ve TFF verisiyle ayrıca doğrulanacak.

  **Bugün arayüzde değişim gösterilmiyor ve gösterilmemeli:** tek gün kaydıyla `historySpan`
  sıfır. İlk karşılaştırma ikinci kayıt alındığında mümkün olacak. Test bunu koruyor
  (`lib/history.test.ts`), mantık ayrıca 14 testle sınanıyor (`lib/history-log.test.ts`).

  **Günlük çalıştırma şart:** `node scripts/log-snapshot.mjs`. Aynı gün birden çok kez
  çalışması zararsız (son gün yeniden yazılır). 5.2'de otomatikleşecek.

- [x] **2.3 Kaynak tazeliği.** (S) — 19.09 tamamlandı.
  Dipnotta tek satırlık kaynak cümlesi vardı ve içindeki tek tarih bütün veriler güncelmiş
  gibi okunuyordu. Artık **grup başına tarihli tablo** (`components/DataSources.tsx`), kapalı
  bir açılır bölümde, başlığında kaç grubun eski olduğu yazılı.

  **Tasarımı bir ölçüm belirledi.** Dipnot kabukta, yani **her rotada** çiziliyor. Meta
  alanlarını `lib/fantasy.ts`, `lib/lineups.ts`, `lib/history.ts`, `lib/results.ts` üzerinden
  okusaydım o dosyaların tamamı beş sayfaya birden girerdi: lineups 1008 KB, results 301 KB,
  fantasy-players 226 KB, player-history 67 KB — ~1,6 MB. Onun yerine türetilmiş bir özet
  var: `scripts/build-source-meta.mjs` → `data/source-meta.json`, **923 bayt**. `--check`
  kipi ve `data/source-meta.test.ts` sapmayı yakalıyor; özet bayat kalırsa dipnot kullanıcıya
  "veri taze" diye yalan söylerdi.

  **Dokuz grup:** fikstür, Opta, Transfermarkt, geçen sezon sırası, oyuncu listesi, fiyat
  günlüğü, son maç kadroları, maç içi, tahmini 11. **Elo ve bahis oranı bilerek yok** —
  2.4 engelli (clubelo 502), 2.5 yapılmadı; olmayan kaynak için satır açmak kalıcı bir
  "hiç çekilmedi" uyarısı üretirdi.

  **Veride iki tarih biçimi var** ve ikisi de karşılandı: cümle içine gömülü "18.09.2026"
  (fikstür, Opta, Transfermarkt) ve ISO "2026-09-18" (özet dosya). `splitSource` virgülü olan
  ama tarihi olmayan etiketi **bölmüyor** — geçen sezon kaynağı ("Wikipedia, 2025–26 Süper Lig
  ve TFF 1. Lig nihai tabloları") yarım görünürdü; testle sabitlendi.

  **Tazelik bakanın saatine bağlı**, sayfa ise statik üretiliyor. `useNow` taşındı: sunucuda ve
  hydration'da `null` dönüyor, yani üretilen HTML ile tarayıcının çizdiği metin ayrışmıyor.

  **Tarayıcıda bulunan ve düzeltilen kusur.** İlk çizimde tarih sütunu **iki biçimi yan yana**
  gösteriyordu ("18.09.2026" ile "Cum 18 Eyl"). Cümleden ayıklanan tarih ham geçiyordu; artık
  hepsi ISO'ya çevrilip tek biçimde yazılıyor. Düzeltme tarayıcıda yeniden doğrulandı: dokuz
  satırın sekizi "Cum 18 Eyl", tarihi olmayan satır "elle".

  **Uyarı yolu bugünkü veriyle hiç çizilmiyor** ve bunu gizlemiyorum: her şey 18.09'da çekildi,
  yaşlar 1 gün, eşikler 1 + 1 gün pay — yani hiçbir grup bayat değil. "Görülmedi" ile "çalışıyor"
  aynı şey olmadığı için durumlar **17 birim testiyle** karşılandı (`lib/freshness.test.ts`):
  bayat, hiç çekilmedi, sabit, **besleme geride** ve **eksik**. Toplam test 154 → 171.

  `playersFreshness`'in "besleme geride" durumu 18.09'da gerçekten yaşananı kodluyor: dosya taze
  ama oyunun beslemesi eski haftada kalmış. Aynı donmuş besleme 1.3'teki dakika ayrışmasında ve
  2.1'deki skorsuz maçta da çıkmıştı.

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

- [x] **3.1 Çok sayfa + gezinme.** (L) — 18.09, **dört rota** teslim edildi.
  Tek `app/page.tsx` yerine `/` (model ve haftalar) · `/teams` · `/players` · `/squad`.
  Build dördünü de statik üretiyor.

  **Çekirdek değişiklik:** `Shell` sayfadan **yerleşime** taşındı (`app/layout.tsx`,
  `{children}` sararak). Sayfada kalsaydı her gezinmede yeniden kurulur ve durum sıfırlanırdı.
  Sayfalar durumu prop zinciriyle değil `PlannerContext`ten okuyor. `components/Planner.tsx`
  (eski tek sayfa birleştiricisi) kaldırıldı; bölümleri sayfalara dağıldı.

  **UCL'den taşınan performans dersi:** ağır oyuncu sıralaması bilerek bağlam dosyasının
  *dışında* (`components/usePickRows.ts`). Bağlamı durumu okuyan her bileşen import ediyor;
  sıralama orada olsaydı hepsi oyuncu ve maç JSON'larını zincirle çekerdi. UCL'de tam olarak
  bu yaşanmış (FR-PERF-01), yeniden keşfedilmedi.

  **Üç bilinçli kapsam kararı:**

  - *`/results` ve `/methodology` yapılmadı.* İçerikleri 2.1 (sonuç verisi) ve 4.4 (yöntem
    sayfası) kalemlerine ait ve planın kendi sırası ikisini de 3.1'den **sonra** koyuyor. Boş
    bir sekme koymak ölü bağlantı olurdu. Daraltma değil, sıraya uyma.
  - *`ContextBar` yapılmadı.* Ayar çipleri rol tabanlı yazı ölçeğine ve yuvarlaklık
    belirteçlerine dayanıyor; ikisi de **3.2'nin işi**. Şimdi yazmak, yarım bir belirteç
    sistemi uydurup 3.2'yi ona taşımak olurdu.
  - *Tasarım belirteci eklenmedi.* Gezinme, TFF'nin bugünkü söz dağarcığıyla yazıldı
    (`border-line`, `bg-surface`, px punto). UCL'nin `--tabbar-h`, `--z-nav`, `scroll-fade`
    gibi değişkenleri burada yok; kopyalasaydım sessizce yanlış çizerdi.

  **Başlık düzeni:** site adı artık `h1` değil, üst çubukta ana sayfa bağlantısı. `h1`'i her
  rotada `PageHead` sahipleniyor, böylece başlık listesi sayfanın kendi adıyla başlıyor.
  Telefonda dört bölüm alt çubuğa sığdığı için UCL'deki "daha fazla" listesine gerek kalmadı.

  **Doğrulandı — ve tarayıcıda ölçüldü.** Build dört rotayı statik üretiyor; typecheck, lint ve
  143 test geçiyor. Durumun korunması ise akıl yürütmeyle bırakılmadı: üretim sunucusu ayağa
  kaldırılıp headless Chrome'a CDP ile bağlanıldı (oyunun profiline dokunulmadan — ayrı port,
  geçici profil) ve sekmeye **gerçekten tıklandı**.

  | ölçülen | sonuç |
  | --- | --- |
  | `/?gw=9&h=3&t=Besiktas` açılışı | `h1` = "Model ve haftalar", **tek** |
  | "Takımlar"a tıklama | yol `/teams`, sorgu **birebir korundu** |
  | gezinme sonrası başlık | `h1` = "Takımlar ve fikstür", **tek** |
  | Shell'in 250 ms'lik `replaceState`'i sonrası | adres hâlâ `/teams?…`, ayarlar yerinde |

  Son satır asıl risk noktasıydı: Shell adres çubuğunu `?${encodeState(state)}` ile geciktirerek
  yeniden yazıyor. Göreli adres geçerli yola çözüldüğü için yolu ezmiyor — ölçüldü.

  Küçük bir gözlem, sorun değil ama kayda geçsin: `aria-current="page"` iki öge döndürüyor,
  çünkü üst şerit ve alt çubuk ikisi de DOM'da. Her ekran genişliğinde biri `display:none`
  olduğundan erişilebilirlik ağacında yalnız biri görünüyor.

- [x] **3.2 Tasarım belirteçleri ve açık tema.** (M) — 18.09, **açık tema çalışıyor.**
  Varsayılan tema açık (§9 kararı), koyu seçenek olarak kaldı, seçim adreste `th` ile taşınıyor.

  **Teslim edilenler.** `lib/theme.ts` (zemin renkleri tek kaynak), `globals.css`'te köşe
  belirteçleri + rem tabanlı rol ölçeği + `:root[data-theme="light"]` paleti,
  `components/ThemeSwitch.tsx` (dil seçicisiyle aynı kalıp), `PlannerState.theme`,
  `useTheme()`, temaya duyarlı `lib/bands.ts` (`bandStyle`, `bandColors`, `roleStyle`).

  **Tema yalnız CSS işi değilmiş** — üç yer sabit renk yazıyordu ve hepsi düzeltildi:
  `layout.tsx`'teki `themeColor` (mobil tarayıcı çubuğu), `Exportable.tsx`'teki PNG zemini
  (`#000000` sabitti; artık `groundOf(theme)` ve `theme` efektin bağımlılığında, yoksa tema
  değişince görsel eski zeminle üretilirdi) ve `ROLE_STYLE` (kadro sahasındaki `xi`/`bench`
  koyu zemine göre seçilmişti, açık temada sayfayla çakışıyordu).

  **Açık palet ölçülmedi, devralındı.** Değerler `../ucl-fantasy-planner`'ın kontrast
  ölçülerek seçilmiş açık paletinden alındı; burada yeniden ölçülmedi ve öyle sunulmuyor.
  İki projenin bant skalası birebir aynı olduğu için devralma geçerli; farklılaşırlarsa
  yeniden ölçülmeli.

  **Tarayıcıda doğrulandı** (üretim sunucusu + headless Chrome, CDP):

  | ölçülen | açık | koyu |
  | --- | --- | --- |
  | sayfa zemini | `rgb(247,248,250)` | `rgb(0,0,0)` |
  | gövde mürekkebi | `rgb(18,21,28)` | `rgb(244,244,245)` |
  | zorluk hücresi "3,8" | `#E08A2E`, 1 px çerçeve | `#F5B041`, çerçevesiz |
  | adres | `th=light` | `th=dark`, yol korunuyor |

  Üçüncü satır asıl sınanmak isteneniydi: sekiz renk uygulama noktası elle değiştirildi ve
  biri bağlanmamış olsa **build yine yeşil olurdu**. Hücrenin iki temada farklı renk ve farklı
  çerçeve alması, `bandStyle`'ın uçtan uca bağlı olduğunu gösteriyor.

  **Yapılmadı ve gizlenmiyor: px → rem dönüşümü.** Rol belirteçleri (`--text-micro/caption/
  label/body/…`) tanımlandı ama mevcut çağrı yerleri çevrilmedi — **20 dosyada 82 px yazı
  boyutu** duruyor. Yani rem'e geçmenin asıl faydası (tarayıcının yazı boyutu ayarını izleme)
  henüz gerçekleşmiş değil. Görsel kontrol imkânı olmadan 82 yeri toptan çevirmek gerçek bir
  gerileme riskiydi; yarısını yapıp "tamam" demek daha kötü olurdu. **Artık iş:** rol
  belirteçlerine geçiş, tercihen sayfa sayfa ve her adımda bakılarak. 5.4 (erişilebilirlik
  ölçümü) bunu zaten gerektirecek.

  **3.1'den devreden `ContextBar` artık mümkün:** belirteçler geldiği için engeli kalktı.

- [x] **3.3 Ağır hesabı Web Worker'a al.** (M) — 18.09 tamamlandı, **ölçüldü.**
  Kadro kurma `useMemo` içinde, ana iş parçacığında koşuyordu; kaydırak oynatılınca ekran
  donuyordu. Artık iş bir Web Worker'a gidiyor.

  **Ölçüm — kaçınılan maliyet ve kalan donma:**

  | | süre |
  | --- | --- |
  | sıralama (`rankPicks`, 487 oyuncu) | 9,9 ms |
  | **kadro kurma** (`buildSquad`) | **163,0 ms** |
  | iş, sıralama dahil (ilk çağrı) | 182,7 ms |
  | kaydırak oynatılırken en uzun kare boşluğu | **25,3 ms** (p95 18 ms, 232 kare) |

  Yani her kaydırak değişiminde ana iş parçacığına düşen ~163 ms'lik blok kalktı; kalan en uzun
  duraklama bir buçuk kare. **Planda "~0,3 s" yazıyordu, kendi ölçtüğüm sayı ~165 ms** — devraldığım
  rakam değil ölçülen kullanıldı. *Çekince:* 163 ms Node'da, 25 ms headless Chrome'da ölçüldü;
  aynı çalışma ortamı değiller, yani kusursuz kontrollü bir karşılaştırma değil. Büyüklük farkı
  sonucu taşıyor ama bu sınır kayda geçsin.

  Worker'ın gerçekten kurulduğu da doğrulandı: sayfanın indirdiği kaynaklar arasında
  `turbopack-worker-…js` var. Bu önemliydi, çünkü `useComputed` kimse tarafından import
  edilmediği sürece Turbopack worker girişini derlemeyi hiç denemiyordu — o aşamada yeşil build
  worker hakkında hiçbir şey söylemiyordu.

  **Taşınan tasarım kararları (UCL'den, yeniden icat edilmedi):**

  - *Yaşam döngüsü* `lib/compute-store.ts`'te ve React'ten bağımsız: worker, hesap ve zamanlayıcı
    dışarıdan veriliyor. Kurallar denetimle sertleşmiş — hiçbir iş askıda kalmıyor, `settle`
    reddetmiyor, worker yoksa/düşerse/zaman aşarsa/mesaj kopyalanamazsa hesap ana iş parçacığına
    düşüyor, worker yeniden kurma sayısı sınırlı (sınırsız olsa sürekli düşen worker her işte
    yeniden kurulurdu; hiç olmasa tek düşüş oturumun kalanını ana iş parçacığına indirirdi).
  - *İş, satırları değil sıralamanın **girdisini** taşıyor;* worker satırları kendi havuzundan
    kuruyor. Böylece 487 oyuncunun nesnesi sınırdan geçmiyor.
  - *`stale` ayrımı:* yeni girdinin sonucu gelene kadar önceki kadro görünür ama soluk ve
    `aria-busy`; önceki ayarların sonucu yeni ayarlarınki diye sunulmuyor.
  - *Hata ayrı:* worker da ana iş parçacığı da beceremediyse "yeniden dene" düğmesi çıkıyor.
    Kısıt hatasıyla (kilit çelişkisi, bütçe) karıştırılmıyor.

  **Kapsam:** tek iş türü (kadro). UCL'de joker ve transfer işleri de var ama TFF'de o sayfalar
  yok (Faz 4); olmayan özellik için iş türü açılmadı.

  **Klonlanabilirlik doğrulandı:** `SquadResult` tamamen düz veri (`Lineup` + `Player[]` +
  sayılar), `lib/` ağacında tarayıcıya özgü tek bir çağrı yok. İkisi de worker sınırının
  çalışma anında patladığı yerler olduğu için yazmadan önce bakıldı.

- [ ] **3.4 Oyuncu ve kulüp sayfaları.** (M)
  `/players/<oyuncu>`: başlama olasılığı, oranlar, hafta hafta beklenen puan dökümü.
  `/teams/<kulüp>`: kadronun tamamı. Derleme anında statik.
  Bugün bu bilgi yalnız `title` ipucunda; mobilde erişilemiyor.

---

## 7. Faz 4 — TFF'ye özel özellikler

- [ ] **4.0 Menajer kartları modele girsin.** (M)
  §9'daki karar (18.09) bir iş kalemine bağlanmamıştı; boşluk burada kapanıyor.
  Beşi de kadro kurucunun hedefinde tek satırlık değişiklikler:
  Tripleks kaptan çarpanını 2 yerine 3, Dört Dörtlük 4 yapar (kaptan seçimi kart başına
  değişebilir); Tüm Takım Sahaya yedek ağırlığını 1'e çıkarır; Limitsiz Bütçe bütçe kısıtını
  kaldırır; Hücum diziliş kısıtını kaldırır ve +5 M bütçe verir.
  Çıktı: her kart için "bu hafta oynasam ne kazanırdım" farkı, kartsız plana göre.
  Arayüz kuralı: ilk kullanımdan sonra **ücretli** olduğu her öneride yazılı kalsın;
  model kart öneriyorsa bu para harcamayı önermek demektir.

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

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

- [x] **3.4 Oyuncu ve kulüp sayfaları.** (M) — 19.09 tamamlandı.
  `/players/<oyuncu>` ve `/teams/<kulüp>`, derleme anında **546 statik sayfa** (528 + 18).
  Bu bilgi eskiden yalnız `title` ipucundaydı ve mobilde hiç erişilemiyordu.

  **Adres şeması ölçülerek seçildi:** yalnız adla **44 çakışma** var (yedi ayrı "Arda", üç
  "Enes"), `takım-ad` ile 528'de **sıfır**. `slugify` Türkçe harfleri NFD'den önce katlıyor —
  sonra katlansa büyük `İ` ve `Ø` düşerdi.

  **Statik sayfa / durum gerilimi** UCL'deki gibi çözüldü: sayfa bileşenleri istemci bileşeni
  ve durumu bağlamdan okuyor. Kabuk yerleşimde olduğu için statik HTML kabuğu veriyor, sayılar
  hydration'dan sonra doluyor.

  **Paket tuzağına önceden kaçınıldı:** `playerKey`/`playerSlug` veri içermeyen
  `lib/player-key.ts`'e taşındı. `lib/fantasy.ts`'te kalsalardı adres hesaplayan her bağlantı
  bileşeni 226 KB'lık oyuncu dosyasını pakete sokardı — bu oturumda aynı tuzağa 3.1 ve 2.3'te
  de rastlamıştım.

  **Bağlantılar takıldı:** sıralama satırı, saha kartı, maç ayrıntısındaki kadro başlığı ve
  kulüp kadro listesi. **Üç yere bilerek takılmadı**, üçü de aynı sebeple — iç içe etkileşimli
  öge, geçersiz anlambilim ve tek dokunuşta iki iş:

  - `Standings` satırları `<button>` (işi takım seçmek),
  - `Results`'taki maç satırı `<summary>` (tıklama paneli açıyor),
  - `TeamsTable` satırları `role="button"` + `tabIndex` + Enter/Space işleyicili `div`.

  **Kendi soktuğum tekrar, ölçülüp giderildi.** Kulüp sayfasına ikinci bir kadro listesi
  yazmıştım; oysa `TeamPanel` zaten `FantasyList`'i çiziyordu. Tarayıcı ölçümü: **8 `h3`**,
  aynı dört mevki iki kez. Kendi bölümüm kaldırıldı, `FantasyList` tek liste oldu ve adlarına
  bağlantı eklendi. Yeniden ölçüm: **4 `h3`**, kulüp sayfasında kadro açık, `/teams`'te kapalı,
  iki sayfada da 29 oyuncu bağlantısı. Yan kazanç: oyuncu sayfalarına artık `/teams` listesinden
  de gidiliyor — kulüp sayfasının giriş noktası ince kalmıyor.

  **Bilerek verilen ödün:** kendi listemdeki "başlama olasılığı" sütunu gitti. İki paralel kadro
  listesi tutup zamanla ayrışmalarına izin vermektense küçük bir bilgi kaybı seçildi.

  **Tarayıcıda doğrulanan:**

  | ölçülen | sonuç |
  | --- | --- |
  | oyuncu sayfası | tek `h1`, dört kart, dört bölüm, bozuk değer yok |
  | sıralamadan tıklama | `/players/trabzonspor-salah`, **`gw=9` ve `h=3` korundu** |
  | saha kartı (şüphe) | 92×76, ad bağlantısı **taşmıyor** |
  | sıralama satırı (şüphe) | ad kutusu 806 px, **kesme çalışıyor** |

  Son iki satır yazarken şüphelendiğim yerlerdi (bağlantıya sarmak `truncate` ve dar kartı
  bozabilirdi); ölçüm ikisini de çürüttü.

  **Açık kalan:** gol atan oyuncu adları bağlanmadı — `results.json`'daki adlar FotMob'un ve
  oyun dosyasındaki adlara eşleyen bir haritamız yok. Uydurma bağlantı üretmektense düz metin
  bırakıldı; eşleme kurulursa açılır.

- [x] **3.5 Görsel sistemi tamamla (UCL'den).** (L) — kullanıcı isteği, 19.09. **Bitti 19.09:**
  rol belirteçleri, tek form dili, atlama bağlantısı, bağlam çipleri, yapışkan şerit. Tek açık
  alt madde sayfa geçişleri; engelli ve gerekçesi aşağıda ölçülü (React 19.2.8 `ViewTransition`
  dışa aktarmıyor).
  3.1 ve 3.2'de bilerek ertelenen arayüz/düzen/görsel işleri. Sıra içinde, her adım
  tarayıcıda bakılarak; toptan bir "her şeyi çevir" hamlesi görsel gerilemeyi görünmez kılar.

  - **Rol belirteçlerine geçiş.** 3.2 belirteçleri tanımladı ama çağrı yerleri çevrilmedi,
    yani rem'in asıl faydası (tarayıcının yazı boyutu ayarını izleme) hâlâ gerçekleşmiyor.

    **19.09'da yeniden sayıldı ve borç kaydettiğimden büyük çıktı:** 3.2'de "20 dosyada
    82 px" yazmıştım; gerçek tablo **219 yazı boyutu**. Eksik saymamın sebebi yalnız
    `text-[Npx]` aramış olmam — Tailwind'in adlandırılmış boyutları da ölçeğin dışında ve
    onlar çevrilmezse ölçek ikiye bölünmüş kalır. (Ayrıca 3.4'te eklediğim yeni sayfalar
    px ile yazıldı; borcun bir kısmını ben büyüttüm.)

    | | sayı | rol karşılığı |
    | --- | --- | --- |
    | `text-[13px]` | 70 | `--text-label` |
    | `text-xs` (12) | 53 | `--text-caption` |
    | `text-sm` (14) | 22 | `--text-body-sm` |
    | `text-[15px]` | 9 | `--text-body` |
    | `text-[11px]` | 9 | `--text-micro` |
    | `text-[12px]` | 8 | `--text-caption` |
    | `text-lg` (18) | 14 | `--text-lead` (aşağıda) |
    | `text-xl` (20) | 12 | `--text-title` |
    | `text-[17px]` | 4 | `--text-lead` |
    | `text-base` (16) | 5 | `--text-body` (aşağıda) |
    | 19-22 px hücre/kontrol sayıları | 7 | `--text-lead` / `--text-title` |
    | 24-28 px KPI | 3 | `--text-stat` |
    | 40 px KPI (takım paneli) | 1 | `--text-stat-lg` (eklendi) |
    | 26-34 px başlık çiftleri | 4 | `--text-display` (aşağıda) |
    | `text-[10px]` | 1 | **erişilebilirlik düzeltmesi** |

    Altı eşleme 219'un ~171'ini kapatıyor. Kuyruk küçük ama **dördü mekanik değildi**;
    dördü de uydurmak yerine UCL'de aynı ögenin nasıl yazıldığına bakılarak çözüldü:

    - *`text-lg` → `--text-lead`, `text-base` → `--text-body`.* Bunlar düzyazı değil,
      `font-cond … tabular-nums` **sayısal gösterge**: kaydırak değeri, maç skoru, kadro
      fiyatı, zorluk hücresi. UCL'de birebir aynı ögeler `text-lead` ve `text-body`. İkisi
      de 1 px küçülüyor.
    - *40 px KPI → `--text-stat-lg`.* UCL'de aynı öge bu rolde ve değeri birebir 2,5rem.
      Token TFF'ye eklendi.
    - *Başlık çiftleri (`28→34`, `26→32`).* Rol ölçeği duyarlı değil, yani çift tek role
      oturmuyor. UCL'nin yaklaşımı ters yönde: `text-display` sabit, **çok dar** ekranda
      `text-title`'a iner; masaüstünde büyümüyor. O düzen alınacak — bu, masaüstü sayfa
      başlığını **34 px'ten 28 px'e indirir**. Nötr bir yeniden adlandırma değil, görünür
      bir değişiklik; kullanıcı isteği "UCL'deki düzen" olduğu için seçildi, gizlenmiyor.
    - *`text-[10px]`* (`GameweekBar`, hafta ağırlığı çipi) yeniden adlandırma değil, 5.4'ün
      "11 px altı metin yok" kuralının ihlali: `--text-micro`'ya çıkıyor.

    **19.09 — bu madde bitti.** 203 tartışmasız yer tek geçişte, 13 tekil elle çevrildi;
    kalan px yazı boyutu **sıfır**.

    **Neden tarayıcıda ölçüldü:** yeşil derleme sınıfın *yazıldığını* gösterir, çizildiğini
    değil. Token adı yanlış olsa Tailwind o yardımcı sınıfı hiç üretmez, metin devraldığı
    boyuta düşer ve build, typecheck, lint, testlerin **dördü de yeşil kalırdı**. Ölçüm:
    sayfada geçen her rol tam beklenen piksele çözülüyor (micro 11 · caption 12 · label 13 ·
    body-sm 14 · body 15 · lead 17 · title 20 · stat 28 · stat-lg 40 · display 28).

    **Ölçüm, süpürmeden eski bir kusuru da yakaladı.** Açıkça yazılmış tek `text-[10px]`'i
    düzelttim ama her sayfada **beş `<small>` 9,6 px** çiziliyordu: `<small>` tarayıcıda
    0.8em, yani 12 px'lik kapsayıcıda 9,6 px. Sınıfla değil **devralmayla** oluştuğu için
    hiçbir aramada görünmüyordu ve `text-xs` de 12 px olduğundan süpürmeden önce de vardı.
    `Legend`'e açık rol verildi; yeniden ölçüm: 11 px altı metin **0**. `<small>`/`<sub>`/
    `<sup>` taraması da yapıldı, açık rolü olmayan başka öge kalmadı.

    **Görünür iki değişiklik** (nötr yeniden adlandırma değil, kayda geçsin): sayfa başlığı
    masaüstünde 34 → 28 px, site adı 32 → 28 px. İkisi de artık ölçekte ve UCL'nin duyarlı
    olmayan `display` yaklaşımını izliyor.

    **Kalan tek madde** — yapışkan üst çubuk + sayfa geçişleri; bu kalem onunla kapanacak.
    (Tek form dili, içeriğe geç bağlantısı ve `ContextBar` 19.09'da bitti; odak halkası
    rengi de açık.)
  - **`ContextBar` ✓** (19.09). 3.1'de belirteçler olmadığı için ertelenmişti. Sayfadaki
    sayıları belirleyen ayarlar başlığın altında çip olarak, her sayfada aynı sırada:
    takımlar 2 çip (haftalar, model), oyuncular 4 (+ sıralama, süre etkisi), kadro 4
    (+ yedek ağırlığı).

    **Çip kümesi kopyalanmadı, TFF'nin durumundan kuruldu.** UCL'de hafta seçimi boolean
    maske ve ev avantajı ayrı bir çip; burada hafta `gw` + ufuk üçlüsü, ev avantajı ise
    modelin parametresi. Kadronun sayısını belirleyen yedek ağırlığı eklendi. Hedefler var
    olan çıpalar: `#gw-heading`, `#model-heading`, `#picks-heading`, `#squad-heading`.

    **Uyarlama ve ölçülen risk.** UCL'de çip hedefi doğrudan denetim kapsayıcısı, TFF'de ise
    **başlık** (`<h2 id>`). Bu yüzden `reveal()` denetimi başlığın kardeşlerinde arıyor —
    kaçırsaydı odak hiçbir yere gitmeyecek ama `preventDefault` yine çalışacaktı: tıklanınca
    hiçbir şey yapmayan, **dört kapıdan da yeşil geçen** ölü bir çip. Ölçüldü: aynı sayfadaki
    çipte yol değişmiyor ve odak `input#pick-weight-model`'e, ayarın kendi bölümüne gidiyor.

    **Tarayıcıda doğrulanan:** uzak çip gezinip `gw=9` ve `h=3`'ü taşıyor · çip değerleri
    gerçek durumu yansıtıyor ("Haftalar 9–11", "Sıralama %67 · 33 · 0") · dokunma hedefi
    44 px · 1280 ve **375 px'te yatay taşma yok**.

    **Çipsiz bırakılan iki sayfa, bilerek:** `/` (ayarların kendisi orada; insanın bulunduğu
    sayfaya işaret eden çip gürültü) ve `/results` (skor, gol, kart hiçbir ayara bağlı değil;
    çip koymak "bu ayar bu sayfayı etkiliyor" diye yanlış bilgi verirdi).
  - **Tasarım sistemi parçaları.** Başlık yardımcıları (`heading-section`/`heading-sub`) ✓,
    katman ölçeği (`--z-*`) ✓, kenar solması (`scroll-fade` + `useEdgeFade`) ✓,
    **tek form dili ✓** (19.09), odak halkası rengi — açık kalan tek parça.

    *Tek form dili, ölçümle kapandı.* Metin/arama/sayı alanları ve açılır listeler aynı
    yükseklik, çerçeve ve köşe; dokunmatik cihazda en az 16 px — sonuncusu kozmetik değil,
    iOS Safari 16 px altı bir alana odaklanınca sayfayı yakınlaştırıp geri döndürmüyor
    (`maximum-scale` ile kapatmak WCAG 1.4.4'ü çiğnerdi).

    **Kural yazıldıktan sonra da bozuktu ve dört kapı da yeşildi.** Taban `min-height: 44px`
    zaten vardı ama kabuktaki saat dilimi seçicisinin `min-h-9`'u onu eziyordu: ölçümde
    **her sayfada `[36, 44]`** çıktı, yani "tek dil" tek değildi. Yardımcı sınıf taban
    katmanını geçtiği için build, typecheck, lint ve testlerin hiçbiri bunu göremezdi.
    Düzeltildi; yeniden ölçüm: **`[44]`**, taşıran alan yok, yatay taşma yok.

  - **İçeriğe geç bağlantısı ✓** (19.09). Klavyeyle gelen kullanıcı her sayfada gezinme
    şeridini baştan geçmek zorundaydı. Ölçüldü: dinlenmede −200 px (ekran dışı), odakta
    8 px, hedefi (`main#main`) gerçekten var.
  - **Yapışkan şerit ✓ / sayfa geçişleri — engelli.** (19.09)

    *Geçişler yapılmadı ve gerekçesi ölçüldü.* UCL geçişi CSS ile değil React'in
    `ViewTransition` bileşeniyle yapıyor (`<ViewTransition default="page">`). Ama
    **`ViewTransition` React 19.2.8'de dışa aktarılmıyor** — TFF'de de, UCL'nin kendi
    kurulu ağacında da yok (ikisi de aynı sürümü sabitlemiş, override/deneysel kanal yok).
    Yani `globals.css`'teki `::view-transition-*` kurallarını kopyalamak **ölü kural**
    yazmak olurdu. Kozmetik bir solma için deneysel React kanalına geçmek bağımlılık riski;
    madde açık bırakıldı. React bu API'yi kararlı hâle getirince açılır.

    *Yapışkanlık, ilk tasarımdan küçültülerek yapıldı.* UCL'nin üst çubuğu 52 px olduğu için
    tamamı yapışkan; TFF'nin başlığı logo+ad, açıklama+saat dilimi ve şeritle **~150 px** ve
    tamamı yapışkan olsa telefonda ekranın üçte birini yerdi. Asıl değer bölüm değiştirmenin
    kaydırınca kaybolmaması olduğu için **yalnız gezinme şeridi** yapışkan. Bu ayrıca kolon
    sınırını taşıma ihtiyacını da kaldırdı: kolon dışında hiçbir şey çizilmediğinden zemin
    kolonla sınırlı kalabiliyor, kenardan içerik sızmıyor.

    `scroll-padding-top` eklendi: `ContextBar` çipleri `#gw-heading` gibi çıpalara atlıyor,
    hedef şeridin altında kalmamalı (WCAG 2.4.11).

    **Derlemeden geçip tarayıcıda düşen üç şey** — üçü de yalnız ölçümle görüldü:

    1. Şerit önce `<header>`in içindeydi. `position: sticky` ögenin EBEVEYNİ boyunca sürer;
       header kısa bir kutu olduğu için şerit kaydırır kaydırmaz kaybolurdu. Sınıf doğru,
       davranış ölü. Şerit kolon div'inin doğrudan çocuğu yapıldı (ebeveyn yüksekliği =
       belge yüksekliği, ölçüldü).
    2. Telefonda şerit **boş** çiziliyordu: `Nav`ın kendisi `max-sm:hidden` (yerini
       `BottomNav` alıyor), sarmalayıcı gizlenmeyince tepede 9 piksellik boş bulanık bir
       çubuk kalıyordu. Sarmalayıcıya `max-sm:hidden` eklendi.
    3. `max-[20rem]:static` kaçış kapısı yazmıştım; **ölü kural**. Ölçüm tam 320 px'te
       şeridin hâlâ `sticky` olduğunu gösterdi — Tailwind v4'te `max-[20rem]` sınırı
       HARİÇ. Zaten gereksizdi: şerit 640 px altında hiç çizilmiyor, bu da WCAG 1.4.10'u
       kendiliğinden karşılıyor (%400 yakınlaştırmada CSS genişliği 320 px). Kaldırıldı,
       `scroll-padding` eşiği de 20rem'den 40rem'e alındı.

    Ölçüm (19.09, başsız Chrome, 1400 px kaydırılmış):

    | durum | görünür | konum | kaydırınca `top` | `scroll-padding` | yatay taşma |
    | --- | --- | --- | --- | --- | --- |
    | Masaüstü 1262 | `block` | `sticky` | 0 | 64px | yok |
    | Eşik 640 (`sm`) | `block` | `sticky` | 0 | 64px | yok |
    | Telefon 375 | `none` | — | — | 8px | yok |
    | Dar 320 (%400) | `none` | — | — | 8px | yok |

    Çıpa hedefi 64 px'te, şeridin altı 53 px'te: 11 px açık.

  UCL karşılığı: `app/globals.css` (`@utility` blokları), `components/{ContextBar,Nav}.tsx`,
  `docs/design-system.md`.

---

## 7. Faz 4 — TFF'ye özel özellikler

- [x] **4.0 Menajer kartları modele girsin.** (M) — **bitti 19.09.** `lib/cards.ts`, kadro
  sayfasının "Kadromu iyileştir" görünümünde. Beşi de modellendi (kullanıcı kararı 18.09):
  her kart, kadro hedefinin bir parametresi — ayrı bir hesap değil. Kazanç, o kartla
  ulaşılabilecek en iyi hafta eksi kartsız en iyi plan; yani kartın **takas kararını
  değiştirdiği** durum da içeride (Limitsiz Bütçe'nin tek anlamı zaten bu).

  Ücretli olduğu uyarısı listenin üstünde ve **her zaman görünür** — katlanır kutuya
  konsaydı öneriyi görüp uyarıyı görmemek mümkün olurdu (proje kuralı).

  Beş kart da gösteriliyor, yalnız kazandıranlar değil: "bu kart bu hafta bir şey
  kazandırmıyor" da bilgi ve kart ücretli olduğu için asıl işe yarayan bilgi o.

  Ölçülen (19.09, üretim derlemesi): Dört Dörtlük +13,8 · Tüm Takım Sahaya +13,8 ·
  Tripleks +6,9 · Hücum +0,0 · Limitsiz Bütçe +0,0.

  **"Limitsiz Bütçe +0,0" doğru mu diye ayrıca ölçüldü** — sıfır bir kazanç, sessiz bir
  hatanın tipik görüntüsü. Tanı: kadronun en zayıf oyuncusu Cemali (xP 0,09, bütçesi 4 M),
  mevkisindeki en iyi sahipsiz oyuncu Brown 5 M. Tek başına bakınca paraya takılıyor; ama
  gerçek planda o takas **zaten yapılıyor**, çünkü daha önceki Muriqi takası 3 M serbest
  bırakıyor. Yani bu hafta bağlayıcı kısıt para değil, oyuncu kalitesi ve kulüp sınırı.
  İlk yazdığım test bu sırayı yok sayıp adım-sıfırdaki uygunluğa baktığı için yanlış
  alarm verdi; test yapısal iddialara indirildi (`lib/improve-real.test.ts`), çünkü veri
  her hafta değişiyor ve bugünkü sayıları gömmek testi takvimle kırılır hâle getirirdi.

  **Yan bulgu — iki görünüm farklı hedef optimize ediyor.** Kurucunun gösterdiği sayı (896,0)
  benim gösterdiğimle (67,2) aynı birimde değil: kurucu sıralama ağırlıklarıyla harmanlanmış
  0-100'lük **skoru**, iyileştirme görünümü doğrudan **beklenen puanı** büyütüyor. İkisi
  farklı kadrolar önerebilir. Kartlar için beklenen puan doğru birim (skor biriminde
  "kart kaç puan kazandırır" anlamsız olurdu), o yüzden hedef değiştirilmedi; fark arayüzde
  yazılı hâle getirildi. Ağırlıkların bu görünümde neden etkisiz olduğu ayrı bir tasarım
  sorusu olarak açık.

  Açık kalan: kaptan çarpanı kartlarında takas planı kartsız planla aynı sayılıyor. Çarpan
  büyüyünce daha iyi bir kaptan almak için farklı bir takas mantıklı olabilir; o arama
  yapılmıyor, yani Tripleks ve Dört Dörtlük'ün kazancı **alt sınır**. Hücum'da takaslar
  diziliş kısıtlı aranıp sonuç kısıtsız değerlendiriliyor. İkisi de arayüzde yazılı.

- [ ] **4.1 Kadro kaydetme (tarayıcıda).** (M) — **gerekçesi büyük ölçüde düştü, karar
  kullanıcıda.** (19.09)

  Özgün gerekçe üç parçaydı: (a) kadroyu bir kez gir, (b) her hafta öneri al, (c) dışa/içe
  aktarmayla cihaz değiştir. 4.3-ön'de doğrulanan uç, gerçek kadroyu **otomatik** okuyor ve
  her cihazda aynı hesaptan geliyor — yani (a) ve (c) ortadan kalktı, (b) zaten
  "Kadromu iyileştir"de var.

  Geriye tek gerçek kullanım kalıyor: **sahip olmadığın varsayımsal bir kadroyu** kaydedip
  senaryo denemek. Değerli olabilir ama özgün gerekçenin küçük bir parçası. Kendi başıma
  kapsam daraltmıyorum; yapılsın mı yapılmasın mı kullanıcının kararı.

  UCL karşılığı: `lib/saved-squads.ts`, `components/{SavedSquads,useSavedSquads}.tsx`.

- [x] **4.2 "Kadromu iyileştir".** (M) — **bitti 19.09.** Ayrı sayfa değil, kadro sayfasında
  görünüm anahtarı: ikisi de aynı sıralamayı ve yedek ağırlığını kullanıyor, tek fark birinin
  sıfırdan kurması. Gezinmeye yedinci sekme eklemek telefonda sekme başına 53 px bırakırdı.

  Kadro elle girilmiyor: 4.3'te doğrulanan uçtan okunuyor (`lib/improve.ts` → `currentSquad`).

  **Arama neden hem kesin hem ucuz:** aynı mevkide daha düşük beklenen puanlı bir oyuncuya
  geçmek kadro hedefini asla yükseltemez — ilk 11 zaten en iyi seçimle kuruluyor ve hedef her
  oyuncunun puanında azalmayan bir fonksiyon. Dolayısıyla çıkan her oyuncu için bütçeye ve
  kulüp sınırına uyan adaylar arasında **en yüksek xP'li olan baskındır**. Bu, 500 adayı 1'e
  indiriyor ve sonucu yaklaşıklaştırmıyor: adım içinde kesin. Adımlar arası açgözlülük kesin
  değil (bütçe etkileşimi) ve arayüz bunu "en iyi kadro" diye sunmuyor.

  Kısıtlar birim testle sınandı (`lib/improve.test.ts`, 6 test): 15 oyuncu ve 2-5-5-3 korunur,
  kulüp başına üç sınırı çiğnenmez, parası yetmeyen önerilmez, daha iyisi yoksa takas
  önerilmez, kasa eksiye düşmez. Bunlar arayüzde gözle görülmez — öneri listesi makul dururken
  sınırı çiğnemiş olabilir ve kullanıcı ancak oyuna girip transferi denerken fark ederdi.

  Gerçek veriyle ölçüldü: 63,3 → 67,2 xP (+3,9), 4 takas, kazançlar azalan sırada
  (+1,5 / +1,4 / +0,6 / +0,4), 15 oyuncunun 15'i eşleşti, telefonda taşma yok.

  **Bu turda çıkan yöntem dersi (CLAUDE.md'ye de yazıldı):** ilk ölçüm "hiçbir şey çizilmiyor"
  dedi. Sebep özellik değildi — başsız Chrome `next dev`'e bağlandığında HMR WebSocket'i
  düşüyor ve sayfa **hiç hidre olmuyor**; DOM doğru, tıklama ölü. Tema düğmesinin de tepki
  vermediği görülünce anlaşıldı. Etkileşim ölçümü artık `next start`'a karşı yapılıyor.

  Özgün tanımdan devralınan sınır aynen korundu: UCL'den aday kısa listesi ve kadro üstünde
  tam değerlendirme alındı; hak muhasebesi, ceza ve çok haftalı arama **alınmadı** (TFF'de
  transfer sınırsız ve cezasız, o muhasebenin karşılığı yok).

  Açık kalan: satış fiyatı bugünkü fiyat sayılıyor — oyunun kâr paylaşımı kuralı modellenmedi
  ve arayüzde bu yazılı. Bir de "sıfırdan kurulsa ne çıkardı" tavanı gösterilmiyor;
  `buildSquad` ağır olduğu için ana iş parçacığında koşturmak sayfayı dondururdu, worker'a
  taşımak ayrı bir iş.

- [x] **4.3 Sezon günlüğü.** (M) — **bitti 19.09; uç doğrulandı, elle giriş gerekmiyor.**

  Yapılanlar: `scripts/fetch-team-history.mjs` → `data/team-history.json` (6 hafta, 41 KB),
  `lib/season-log.ts`, `components/SeasonLog.tsx`, `app/season/page.tsx`, gezinmede
  "Sezonum" bölümü (alt çubuk 5 → 6 sekme).

  Tarayıcıda ölçüldü: 6 hafta kartı, 36 istatistik kutusu (6×6), kadro kutusu açılınca
  15 oyuncu + 15 döküm satırı; telefonda (375 px) alt çubuk 6 sekme, en dar sekme 63 px,
  yükseklik 56 px, kırpılan etiket 0, yatay taşma yok; yapışkan şerit hâlâ `top: 0`.
  Bir kusur ölçümde yakalandı ve düzeltildi: kulüp adı oyuncu dosyasındaki **kimlikten**
  basılıyordu ("Besiktas"), `byId` üzerinden görünen ada çevrildi ("Beşiktaş" 16 kez, ASCII
  hâli 0).

  §10 bu adımı Faz 4'ten önce koymuştu çünkü sonucu kapsamı değiştiriyor; değiştirdi de.
  `fantasy-team/teams/65385?gameweek-id=<n>` **200** dönüyor ve hafta hafta **gerçek kadroyu**
  veriyor.

  **Önce yanlış okudum, ölçüm düzeltti:** 1., 4. ve 6. hafta birebir aynı özeti döndürünce
  parametrenin yok sayıldığını sandım. Oysa eşit olan alanlar (`totalPoints`, `gwPoints`,
  `pointsHistory`) takım düzeyinde ve zaten hafta bağımsız. Kadro *içeriği* karşılaştırılınca
  tablo tersine döndü: **8 haftada 6 farklı kadro**, kaptan 507 → 507 → 507 → 507 → 12 → 176.
  Genel alanlara bakıp "uç çalışmıyor" demek, 4.3'ü gereksiz yere elle giriş ekranına
  mahkûm ederdi.

  7. ve 34. hafta 6. haftanın kadrosunu döndürüyor: gelecek hafta = güncel kadro. Yani geçmiş
  gerçek, gelecek yankı — günlükte oynanmış haftalar ayrılmalı.

  Ucun verdiği şekil:

  ```
  data.squad.players[15]  playerId, position, captain, viceCaptain, isStarting,
                          slotOrder, points, matchStatus, breakdown
  data.squad              gameweekId, formation ("3-5-2"), teamValue
  data.pointsHistory[n]   gameweekId, points, cumulativePoints, overallRank,
                          rankChange, weeklyRank, avgPoints, highestPoints,
                          benchPoints, transfers, teamValue
  ```

  **Bunun 4.1'e etkisi:** 4.1 "kadroyu bir kez elle gir" diye yazılmıştı; oyunun kendi kadrosu
  otomatik okunabildiğine göre elle giriş asıl yol değil, yedek yol. 4.1 varsayımsal kadrolar
  (senaryo denemesi) için anlamlı kalıyor, gerçek kadro için değil.

  **Ayrıca `breakdown`:** oyuncu başına puan dökümü geliyor ve alan adları TFF tablosuyla
  birebir örtüşüyor: `APPEARANCE_1_TO_60`, `APPEARANCE_60_PLUS`, `GOAL`, `ASSIST`,
  `CLEAN_SHEET`, `GOALS_CONCEDED_2`, `SAVES_3`, `YELLOW_CARD`, `BONUS`. Her satırda
  `count`, `pointsPer`, `subtotal` var ve oyuncunun `points` değeri döküm toplamına eşit
  (15 satırın 15'inde). Bu, `lib/scoring.mjs`'i gerçek dökümle sınamaya ve "`playerOfTheMatch`
  gerçekten bonus mu" sorusunu ölçmeye kapı açıyor.

  ### Ama haftalık toplam TUTMUYOR — 4.3 buna dayanamaz

  Oyuncu puanları kendi içinde tutarlı ve yedek toplamı beş haftada da oyunun `benchPoints`
  değerine **birebir** eşit (1, 9, 11, 5, 11). İlk 11 ise tutmuyor ve sorun yuvarlama değil,
  **aritmetik imkânsızlık**: dönen 15 oyuncunun puanlarının hepsini toplayıp kaptanı iki
  katına çıkarsam bile üç haftada oyunun resmî puanına ulaşılamıyor.

  | hafta | 15'in toplamı | +kaptan (ÜST SINIR) | oyunun puanı | durum |
  | --- | --- | --- | --- | --- |
  | 1 | 37 | 50 | 54 | **imkânsız** |
  | 2 | 57 | 73 | 69 | mümkün |
  | 3 | 57 | 69 | 73 | **imkânsız** |
  | 4 | 46 | 51 | 52 | **imkânsız** |
  | 5 | 58 | 60 | 53 | mümkün |

  Otomatik yedek girişi, vice-captain devri ve kaptan çarpanının içeride/dışarıda olması
  ayrı ayrı denendi; hiçbiri farkı kapatmıyor (1. haftada 11'in tamamı `PLAYED`, oto giren 0).

  **Sonuç:** `pointsHistory` oyunun resmî haftalık puanı olarak güvenilir (haftalık deltalar
  `cumulativePoints` ile tutarlı, toplam 302). Kadro uçtan okunabiliyor. Ama **ikisi
  birbirini doğrulamıyor** ve nedeni henüz bilinmiyor. 4.3 bu yüzden "oyunun puanını yeniden
  hesaplıyoruz" diye yazılmamalı: resmî sayı `pointsHistory`'den gösterilir, kadro ve döküm
  ayrı gösterilir, aradaki fark gizlenmez.

  **Elenen açıklamalar** (hepsi ölçüldü, hiçbiri farkı kapatmıyor):

  | hafta | resmî | transfer | ilk11+K | fark | önceki haftaya göre yeni oyuncu |
  | --- | --- | --- | --- | --- | --- |
  | 1 | 54 | 11 | 49 | +5 | — |
  | 2 | 69 | 6 | 64 | +5 | 6 |
  | 3 | 73 | 12 | 58 | +15 | 12 |
  | 4 | 52 | 10 | 46 | +6 | 10 |
  | 5 | 53 | 13 | 49 | +4 | 13 |
  | 6 | 2 | 10 | 10 | **−8** | 10 |

  - *"Dönen kadro kilit anındaki kadro değil"* — **yanlış.** Yeni oyuncu sayısı her hafta
    transfer sayısına birebir eşit; kadro o haftanın kilit sonrası hâli.
  - *"Fark transfer yoğunluğundan"* — **yanlış.** 11 transfer → 5, 12 → 15, 13 → 4.
  - *"Otomatik yedek girişi"* — 1. haftada ilk 11'in tamamı `PLAYED`, giren yedek yok, fark 5.
  - *"Kaptan çarpanı içeride/dışarıda"* ve *"vice-captain devri"* — ikisi de denendi,
    kaptan iki haftada da oynamış.
  - *"Eksik bir bileşen sürekli ekleniyor"* — 6. hafta farkı **negatif**; o hafta hâlâ
    oynanıyor, yani işaret bile sabit değil.

  Başka uç yazımları denendi: `/points`, `/gameweek-points`, `/history`, `/gameweeks/<n>`,
  `/picks`, `gameweeks/<n>/teams/<id>` → 404/403. `fantasy-team/teams/<id>/squad?gameweek-id=<n>`
  aynı gövdeyi döndüren takma ad. Sitenin JS paketinde tam yol metni yok (URL'ler parçadan
  kuruluyor), o yüzden uç listesi paketten çıkarılamadı.

  UCL karşılığı: `lib/season-log.ts`, `components/SeasonLog.tsx`.

- [x] **4.4 Yöntem sayfası.** (M) — **bitti 19.09.** `components/Methodology.tsx`,
  `app/methodology/page.tsx`. Bağlantısı gezinmede değil dipnotta, kaynak tablosunun yanında:
  ikisi de "bu sayılar nereden geliyor" sorusunun cevabı ve yedinci sekme telefonda sekme
  başına 53 px bırakırdı.

  Sayılar **koddan** okunuyor (`SCORING`, `XG_WEIGHT`, `XG_MIN_MINUTES`, `PRIOR_MATCHES`,
  `PRIOR_MINS`, `BUDGET`, `FORMATION`, `MAX_PER_CLUB`, `DEFAULT_BENCH_WEIGHT`,
  `DEFAULT_HORIZON`, `DEFAULT_WEEK_DECAY`, `DEFAULT_PICK_WEIGHTS`). `XG_MIN_MINUTES` bunun
  için dışa açıldı; elle yazılmış ikinci kopya, sabit değişince en çok güvenilmesi gereken
  sayfada sessizce yanlış bilgi verirdi.

  Tarayıcıda doğrulandı: 19 puan satırı `lib/scoring.mjs` ile birebir, 11 sabit, 7 sınır
  maddesi, dipnot bağlantısı çalışıyor, 375 px'te taşma yok.

  **Yan not — üretimde `curl` ile içerik doğrulanamıyor.** `Shell` `useSearchParams`
  kullandığı için statik HTML'e Suspense yedeği yazılıyor ve içerik istemcide doluyor.
  Daha önceki curl kontrolleri dev sunucusunda çalıştığı için bu fark görünmemişti.

---

## 8. Faz 5 — Otomasyon ve yayın kalitesi

- [x] **5.1 CI: her push'ta typecheck + lint + test + build.** (S) — **bitti 19.09.**
  `.github/workflows/ci.yml`; main'e push ve PR'da koşuyor, aynı dalda yeni push eskisini
  iptal ediyor. Sıra en ucuzdan pahalıya: tip hatası varsa derlemeyi beklemeye gerek yok.
  Sır ya da ağ erişimi istemiyor — veri repoda; oyuna giriş gerektiren betikler burada
  koşmuyor. `data/validate.test.ts` ve `data/source-meta.test.ts` testlerin içinde, yani
  veri bozulursa ya da türetilmiş özet bayatlarsa kapı düşer.

  **İlk koşu düştü ve bu kapının değerini hemen gösterdi.** `LayoutProps` ve `PageProps`,
  Next'in `.next/types/` altına **ürettiği** genel tipler. Yerelde `.next` dolu olduğu için
  `tsc` onları görüyordu; temiz checkout'ta yoklar ve dört dosyada `TS2304` veriyor. Yani
  yerelde aylardır geçen bir kapı, aslında üretilmiş bir ara çıktıya yaslanıyormuş.
  Düzeltme CI'da sıra değiştirmek değil, bağımlılığı kaldırmak oldu: `typecheck` betiği
  artık `next typegen && tsc --noEmit` — yerelde de CI'da da aynı.
  UCL karşılığı: `.github/workflows/ci.yml`.

- [x] **5.2 Günlük veri işi — kısmi.** (M) — **bitti 19.09.** `.github/workflows/data.yml`,
  her gün 05:00 UTC (08:00 TSİ) ve elle tetiklenebilir.

  **Kısmi olması teknik bir eksiklik değil, mimarinin sonucu.** FotMob kaynakları
  (son maç kadroları, maç içi, tahmini 11) yenileniyor; oyunun kendi API'si yenilenmiyor,
  çünkü Keycloak ile korunuyor ve giriş **Google hesabıyla**. Şifreyle programatik giriş
  yok, oturum ayrılmış Chrome profilinde ve o profil runner'a taşınamaz — taşınsa bile
  token'ı repoya ya da sır kasasına koymak proje kuralına aykırı. Fiyat, seçilme, fikstür
  ve kendi takımım elle kalıyor.

  **Önce erişim ölçüldü, sonra iş yazıldı.** Cloudflare'in veri merkezi IP'lerini
  engellemesi yaygın ve engellenseydi bütün iş boşa emek olurdu. Geçici bir
  `workflow_dispatch` deneyiyle ölçüldü: kök ve takım sayfası **200**, headless Chrome
  **1,08 MB** DOM çekiyor, `__NEXT_DATA__` yerinde, challenge izi yok. Deney dosyası
  sonuç kaydedildikten sonra silindi.

  İki ayrıntı sessiz hataya karşı:
  - `TMPDIR` açıkça veriliyor. `scripts/lib/fotmob.mjs` önbelleği
    `LOCALAPPDATA ?? TMPDIR ?? "."` altına yazıyor; Linux'ta ikisi de boşsa önbellek
    **repo dizinine** düşer ve commit'e karışırdı.
  - `pnpm test` commit'ten **önce** koşuyor. Bozuk ya da yarım bir çekimde iş orada durur
    ve eski veri yerinde kalır (`data/validate.test.ts` 18 takım / 306 maç / hafta başına
    bir maç; `data/source-meta.test.ts` türetilmiş özetin sapmadığını).

  Açık: `fetch-lineups.mjs --matches` varsayılanda kalıyor; sezon uzadıkça büyümesi
  gerekiyor (zaten kayıtlı açık madde). İlk zamanlanmış koşu henüz gözlenmedi.
  **Kısıt:** oyunun API'si Keycloak + Google girişi istiyor; GitHub Actions'ta oturum açmanın
  güvenli bir yolu yok ve CLAUDE.md token'ı hiçbir yere yazmayı yasaklıyor. Bu yüzden:
  - CI'da koşabilenler: FotMob (sakatlık, son maçlar, tahmini 11), Opta, Transfermarkt.
  - Yerelde kalanlar: oyunun beslemesi (fiyat, seçilme, skor, haftalar).
  `scripts/update-all.mjs` iki kipte çalışsın ve hangi grubun ne zaman yenilendiği
  `source-meta` üzerinden görünsün (2.3'e bağlı).
  UCL karşılığı: `scripts/update-all.mjs`, `scripts/lib/schedule.mjs`, `.github/workflows/update-data.yml`.

- [x] **5.3 Yayın kabuğu.** (S) — **bitti 19.09.** `app/robots.ts`, `app/sitemap.ts`,
  `app/not-found.tsx`, `next.config.ts` başlıkları. Site adresi `lib/site.ts`'te tek yerde:
  yerleşim, robots ve sitemap ayrışırsa site arama motoruna kendi adresini yanlış bildirir.

  Ölçüldü: sitemap **553 URL** (7 bölüm + 18 kulüp + 528 oyuncu), `lastmod` veri çekim
  tarihinden (her derlemede bugünü yazmak, hiçbir şey değişmediği hâlde "güncellendi"
  demek olurdu), bilinmeyen adres gerçekten **404** dönüyor ve 404 sayfası kabuğun içinde,
  seçili dilde, bölüm bağlantılarıyla geliyor.

  **CSP tarayıcıda doğrulandı — ihlal 0.** Politika sıkı tutulabildi çünkü çalışma anında
  dış kaynak yok: yazı tipleri `next/font` ile derlemede kendi sunucumuza iniyor, armalar
  `public/logos/` altında yerel. (Veri dosyasındaki `cdn.tfffantezilig.com` adresi yalnız
  çekim betiğinin kaynağı; bunu kontrol etmeden CSP yazsaydım ya armaları düşürürdüm ya da
  gereksiz yere dış alan adı açardım.) Ölçüm: hidrasyon çalışıyor, 20 yazı tipi yüklü,
  görseller geliyor.

  **Bilinçli taviz:** `script-src 'unsafe-inline'`. Next hidrasyon verisini satır içi
  betikle gönderiyor; nonce vermek middleware gerektirirdi. Taviz XSS'e karşı tam korumayı
  bırakıyor ama **dış kaynaklı betik** yine engelli. Sitede kullanıcı girdisi, oturum ve
  ödeme olmadığı için kalan risk sınırlı. `next.config.ts` içinde yazılı.
  `robots.ts`, `sitemap.ts`, temalı `not-found.tsx` ve `error.tsx`, güvenlik başlıkları (CSP).

- [x] **5.4 Erişilebilirlik ölçümü.** (M) — **bitti 19.09.**

  axe-core projeye **bağımlılık olarak eklenmedi** (proje kuralı: bağımlılıkta cimri ol);
  ölçüm anında CDN'den indirilip CDP ile sayfaya enjekte ediliyor. CDP değerlendirmesi
  sayfanın CSP'sine takılmıyor, yani 5.3'teki sıkı politika ölçümü engellemiyor.

  Kapsam: 7 rota × 2 tema, WCAG 2.0/2.1 A + AA kuralları. Üretim derlemesine karşı —
  dev sunucusunda sayfa hidre olmuyor (CLAUDE.md).

  **Bulunan: tek kural, iki ayrı kaynak. İkisi de düzeltildi.**

  1. `GameweekBar` — ufuk 1 haftayken azalma denetimi soluklaştırılıyordu, ama opaklık
     **kapsayıcıdaydı**: kaydırak zaten `disabled` olsa da etiket ve çıktı metni de
     soluyordu ve WCAG'ın "devre dışı denetim" muafiyeti onları kapsamıyor. Ölçülen
     kontrast 2,4 ve 2,16 (gereken 4,5). Soluklaştırma kaydırağın kendisine taşındı;
     görsel ipucu duruyor, metin tam kontrastta (accent/beyaz 5,77).
  2. `Legend` — bant açıklamasındaki `opacity-80`, beyaz yazıyı yeşil zeminde 4,03'e
     düşürüyordu. Kaldırıldı → 5,41. Hiyerarşiyi punto farkı zaten taşıyor.

  Düzeltme sonrası: **7 rotada da 0 ihlal, açık ve koyu temada.**

  **Sınır dürüstçe:** otomatik denetim WCAG sorunlarının yalnız bir bölümünü yakalar.
  Klavye sırası, odak görünürlüğü, anlamlı alt metin ve ekran okuyucu semantiği makine
  tarafından doğrulanmadı. Bunların bir kısmı 3.5'te elle ölçülmüştü (atlama bağlantısı,
  odak halkası, 44 px dokunma hedefi, 375 px'te taşma yok); gerçek ekran okuyucu denemesi
  yapılmadı.
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

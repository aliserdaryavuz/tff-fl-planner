# TFF FL Planner 2026/27 — proje tanımı

TFF Fantezi Lig (Trendyol Süper Lig 2026/27) için kişisel haftalık planlama aracı. `../ucl-fantasy-planner` ile aynı mimari; fark: oyunun kuralları (sınırsız transfer, ilk 11 + yedek + kaptan, TFF puan tablosu) ve veri kaynakları. Yayın: GitHub → Vercel.

---

## 1. Oyunun kuralları (tfffantezilig.com/yardim?tab=kurallar, 09.09.2026)

| Kural | Değer |
|---|---|
| Kadro | 15 oyuncu: 2 kaleci, 5 defans, 5 orta saha, 3 forvet |
| Bütçe | 100 M TL |
| Kulüp sınırı | Aynı takımdan en fazla 3 |
| İlk 11 | 1 kaleci, en az 3 defans, en az 1 forvet; geçerli dizilişler 3-5-2, 3-4-3, 4-4-2, 4-3-3, 4-5-1, 5-4-1, 5-3-2, 5-2-3 |
| Yedek | 4; ilk 11'den oynamayan çıkarsa otomatik değişiklik (kaleci yalnız kaleciyle) |
| Kaptan | ×2; hiç oynamazsa yardımcı kaptan |
| Transfer | Sınırsız, puan kesintisi yok |
| Son kayıt | Haftanın ilk maçından 1 saat önce |
| Menajer kartları | Tripleks (×3), Dört Dörtlük (×4), Tüm Takım Sahaya (yedekler sayılır), Hücum (diziliş serbest, +5 M), Limitsiz Bütçe; ilk kullanım ücretsiz, yarıda en fazla 2 — modelde yok |
| Ertelenen maç | Oynandığı haftaya sayılır |

Puan tablosu (`lib/scoring.mjs`): 60 dk'ya kadar 1, üstü 2; gol KL 10 / DF 6 / OS 5 / FV 4; asist 3; gol yememe KL-DF 4, OS 1 (60+ dk); her 3 kurtarış 1; penaltı kurtarma 5, kaçırma -2; her 2 yenilen gol KL-DF -1; sarı -1, kırmızı -3, kendi kalesine -2; maçın en iyi üçü 3/2/1 bonus (eşitler aynı bonusu alır).

Sonuç: sınırsız transfer olduğu için her hafta bağımsız bir problem. Planlayıcının işi "seçili hafta için beklenen puanı en yüksek ilk 11 + en ucuz uygun yedek + kaptan".

---

## 2. Teknik

Next.js App Router + TypeScript + Tailwind + vitest; Vercel. Veri derleme zamanında statik JSON; veritabanı ve çalışma anı API'si yok. Durum URL'de (`lib/url-state.ts`).

---

## 3. Veri ve kaynaklar

| Veri | Kaynak | Betik | Not |
|---|---|---|---|
| Fikstür, hafta takvimi, son kadro kaydı, skorlar | Oyunun API'si `projection/stats/fixtures` | `fetch-game.mjs` | 34 hafta × 9 maç, UTC başlama anı, `status` (FT/NS), resmî deadline |
| Kulüpler | Oyunun API'si `projection/stats/club-stats` | `fetch-game.mjs` | 18 kulüp; `clubId` → kendi id'lerimize ada göre eşlenir |
| Oyuncular: fiyat, seçilme, puan, form, dakika, gol, asist, gol yememe, yenilen, kurtarış, kart, bonus | Oyunun API'si `projection/stats/player-stats` | `fetch-game.mjs` | 527 oyuncu; fiyat 4-12 M TL, 0,5 adımlı |
| Geçen sezon sırası | Wikipedia 2025–26 Süper Lig / 1. Lig | `scripts/lib/teams.mjs` | Yükselenler 16-18 |
| Opta gücü | theanalyst.com power rankings paketi (index.js, ~17 MB) | `update-opta.mjs` | Aynı adlı kadın/altyapı kayıtları: puanı yüksek olan A takımı |
| Kadro değeri | transfermarkt.com.tr TR1 sayfası | `update-values.mjs` | milyon € |
| Elo | clubelo.com / elofootball.com | — | 09.09.2026'da erişilemedi; alan isteğe bağlı, kaynak açılınca doldurulur |
| Sakat/cezalı | FotMob kadro sayfaları | `fetch-squads.mjs` | Oyunun API'sinde sakatlık yok; oyun listesi korunur, yalnız `fotmobId` + `status` eklenir. Eşleme sırası: forma numarası (kulüp içinde kesin), oyunun tam adı (`fullName`), görünen kısa ad |
| Son maçlar: ilk 11, dakika, gol, asist, kart, yenilen gol, bonus | FotMob maç sayfaları | `fetch-lineups.mjs` | 6 maça kadar (dostluk hariç); bonus iki takımın TFF puanıyla hesaplanır |
| Tahmini / resmî 11, maç öncesi sakat listesi | FotMob oynanmamış maç sayfası | `fetch-predicted.mjs` | Üç tip: `confirmed` (resmî kadro), `predicted` (Enetpulse tahmini), `lastStarting11` (son çıkan 11; zayıf sinyal, taban 0,60). Maç günü yeniden koş |
| Armalar | images.fotmob.com | `fetch-logos.mjs` | Oyunun kendi logoları da `teams[].logoUrl` alanında |
| Doğrulama | tff.org `Default.aspx?pageID=198&hafta=N` | `verify-fixtures.mjs` | Yazmaz; tarih/saat/skor farklarını listeler |

### 3.1 Oyunun API'si ve giriş

Site Next.js; tarayıcı `/api/backend/<yol>` ile çerezli proxy'den `api.tfffantezilig.com`'a gider. Kimlik doğrulama **Keycloak** (`auth.tfffantezilig.com`, realm `tff`): çerezler `kc_access_token`, `kc_refresh_token`, `auth_session_user` (site) ve `KEYCLOAK_IDENTITY`, `AUTH_SESSION_ID` (auth alt alanı). Giriş Google hesabıyla yapıldığı için **şifreyle programatik giriş yok**; `/api/auth/login` yalnız e-posta+şifreli hesaplar için.

Çözüm (10.09.2026): projeye ayrılmış kalıcı bir Chrome profilinde (`%LOCALAPPDATA%\tff-fl-planner\chrome-profile`) bir kez Google ile giriş yapılır; betikler o tarayıcıya CDP ile bağlanıp istekleri **sayfa bağlamında** koşturur (`scripts/lib/chrome.mjs`), böylece çerezler tarayıcının kasasında kalır ve hiçbir token dosyaya yazılmaz.

Denenip elenen yollar: kullanıcının kendi Chrome profilinin çerez veritabanını kopyalamak (Chrome 127+ **app-bound şifreleme**: kopyalanan profilden `v20` çerezler çözülemiyor, yalnız eski `v10` analytics çerezleri geliyor); Chrome açıkken çerez dosyasını okumak (dışlayıcı kilit). Chrome'un varsayılan profiliyle `--remote-debugging-port` bu sürümde çalışıyor ama tarayıcıyı kapatmak oturum çerezlerini düşürüyor — bu yüzden ayrı profil.

Kullanılan uçlar (hepsi `GET /api/backend/…`): `users/me?league-id=1`, `projection/stats/fixtures?league-id=1`, `projection/stats/club-stats?league-id=1`, `projection/stats/player-stats?league-id=1`, `projection/chips`, `fantasy-team/teams/<id>?gameweek-id=<n>`, `fantasy-team/teams/<id>/chips?league-id=1`.

Oyunun doldurmadığı alanlar sıfır geliyor (`starts`, `bps`, `xGTotal`, `xATotal`, `availabilityPercent`); `fetch-game.mjs` tamamen boş alanları dosyaya yazmaz.

---

## 4. Modeller

### 4.1 Takım gücü ve zorluk (`lib/strength.ts`, `lib/models.ts`)

UCL projesindeki karma güç: her kaynak 18 takım içinde 0-100'e yayılır, ağırlıklı ortalama, γ eğrisi. Kaynaklar: `opta`, `value` (log), `last` (19 − sıra), `table` (bu sezon maç başına puan; herkes ≥1 maç oynadıysa), `elo` (isteğe bağlı). Varsayılan 100/100/50/50. Zorluk rakip bazlı / göreli, HA 6.

### 4.2 Beklenen puan xP (`lib/xp.ts`)

Her oyuncu × maç için TFF puan tablosunun beklenen değeri:

- Beklenen gol: `λ_for = μ · e^(0,8·d/100)`, `λ_against = μ · e^(−0,8·d/100)`; `d` = benim güç − (rakip güç ± HA), `μ` lig ortalaması (bu sezon, 50 maç önceliğiyle 1,35'e çekilmiş).
- Dakika: başlama olasılığı `lib/lineups.ts` (son maçlar, tahmini 11, sakat listesi; FotMob verisi yoksa oyunun resmî dakikası / oynanan hafta × 90); yedekten girme oranı ve ortalama dakikalar son maçlardan; `p60`.
- Kadroda olma olasılığı (`availability`) başlamadan ayrı: sakat/cezalı 0 → süre puanı da alamaz; maç öncesi listede "yok" görünen 0,15.
- Oranlar (gol/90, asist/90, kurtarış/90, sarı/90, kırmızı/90, bonus/90): oyunun **resmî sezon toplamları** + mevki önceliği (4 maç değerinde), `PRIORS`. Resmî dakika yoksa son maç verisine düşer.
- Kalemler: süre `pPlay·1 + p60·1`; gol `g90·dk/90·(λ_for/μ)·golPuanı`; asist ×3; gol yememe `p60·e^(−λ_against)·csPuanı`; yenilen `−dk/90·E[floor(G/2)]` (Poisson); kurtarış (KL) `3·dk/90·(λ_against/μ)/3`; kart; bonus `bonus90·dk/90·√(λ_for/μ)`.
- Ufuk: seçili haftadan `horizon` hafta, ağırlık `decay^(k)`; xP = ağırlıklı ortalama (hafta başına puan). Varsayılan ufuk 1.

Kalibre edilmemiş bir beklenti; arayüzde böyle söyleniyor. Gerçek fantasy puanı/90 (son maçlardan, TFF tablosuyla) ayrıca gösterilir.

### 4.2b Sıralama (`lib/picks.ts`)

UCL projesindeki yapıyla aynı: üç sinyal 0-100'e çevrilip ağırlıklı ortalaması alınır, sonuç süre çarpanıyla ölçeklenir.

```
skor = (w_model·model + w_sel·seçilme + w_points·puan) × süre çarpanı
```

- **model**: oyuncu 90 dakika oynarsa seçili haftalardan beklenen puanı (`PlayerXp.xpPerStart`). Fikstür zorluğu, ev/deplasman, mevki ve oyuncunun oranları bunun içinde; havuzun en iyisi 100 olacak şekilde oranlanır. UCL'deki ham `fixtureScore`un yerini alır.
- **sel**: seçilme oranı, logaritmik (UCL ile aynı formül).
- **points**: birikmiş puan / 90 dakika, az dakikada 270 dakikalık öncelikle güvensiz sayılarak (UCL ile aynı). Modelin oranlarıyla kısmen örtüştüğü için varsayılanı 0.
- **süre çarpanı**: `1 − k + k·(0,15 + 0,85·başlama olasılığı)`, `k` = ilk 11 etkisi kaydırağı.

Ayrı bir "fikstür" ya da "ilk 11" kaydırağı **yok**: ikisi de modelin içinde ve iki kez sayılırdı. Bu yüzden model çıktısı bilerek "oynarsa" varsayımıyla hesaplanır (`FULL_MINUTES`), oynama olasılığı yalnız süre çarpanında bir kez uygulanır. Fikstürün ağırlığı zorluk modeli panelinden, hangi haftaların sayılacağı hafta seçicisinden gelir.

Ölçekler (havuzun en iyisi) **seçilebilir tüm oyuncu havuzundan** hesaplanır; mevki ve fiyat filtresi puanlamadan sonra uygulanır, yoksa filtre sırayı kaydırırdı. `selInvert` seçilme oranını ters çevirir (differential). Varsayılan ağırlıklar: model 100, seçilme 50, geçmiş puan 0.

### 4.3 Kadro kurucu (`lib/squad.ts`, `lib/formations.ts`)

Hedef: `Σ_XI skor + kaptan skoru + benchWeight · Σ_yedek skor` (benchWeight varsayılan 0,1). Skor 0-100 ölçeğinde olduğu için tolerans 2. Saf beklenen puan toplamı arayüzde ayrıca gösterilir.

1. Kulüp kulüp DP ile ilk 11: durum (KL 0-1, DF 0-5, OS 0-5, FV 0-3, harcanan); kulüp teklifleri ≤3 oyuncu; aday budaması: aynı kulüp/mevkide kendisinden hem ucuz hem iyi ≥3 oyuncu varsa atılır, kalanların en iyi 6'sı. DP yarım birimde (0,1 fiyatlar yukarı yuvarlanır); bitişte her geçerli diziliş için yedek rezervi (mevki başına en ucuzlar) düşülür.
2. Geri izlemeyle en iyiye `tolerance` (1,5) yakın ilk 11'ler; her biri için yedekler en ucuzdan, kulüp ≤3 ve kesin bütçeyle doldurulur.
3. `bestLineup`: 15'ten 8 dizilişi deneyerek en iyi 11 + kaptan/yardımcı; yedek sırası kaleci, sonra puana göre. Yerel arama: aynı mevkiden daha yüksek puanlı adaylarla tek takas (bütçe, kulüp), 6 başlangıç × 30 adım.
4. Kilit (ilk 11'de kesin), dışlama, kulüp dışlama; hata kodları `no-prices`, `locked-position`, `locked-club`, `locked-budget`, `infeasible`.

Gerçek havuz + yapay 0,1 adımlı fiyatla ~0,3 s (`lib/squad-real.test.ts`).

---

## 5. Ekranlar (tek sayfa, mobil öncelikli)

Sıra, kararların sırasıyla aynı (UCL projesindeki düzen, başa hafta seçici eklenmiş):

1. **Hafta çubuğu**: hafta seçici (tarih, oynandı), son kadro kaydı, ufuk ve azalma kaydırakları, hafta payları. Buradan çıkan hafta ağırlıkları her şeyin girdisi.
2. **Fikstür zorluğu modeli**: model seçimi, güç kaynakları ve ağırlıkları, ev avantajı, γ.
3. **Takım paneli** (rozetler, KPI, ufuk şeridi, fikstür listesi, kadro/fiyat listesi) | **tüm takımlar tablosu**.
4. **Kim alınmalı?**: üç ağırlık kaydırağı + ilk 11 etkisi + differential kutusu, mevki ve fiyat filtresi, sıralı liste (fiyat, xP, skor; title'da kalem kalem döküm).
5. **Haftanın kadrosu**: saha (diziliş etiketi, K/Y rozetleri), yedek sırası, KPI'lar, kilit/çıkar/kulüp dışla, yedek ağırlığı, alternatif listesi, görsel kaydet.
6. **Hafta programı** (9 maç, saat ya da skor, iki tarafın zorluğu) ve **puan durumu** (açılır).
7. Renk ölçeği, dipnot (nasıl hesaplanır, kurallar, kaynaklar, sorumluluk reddi).

Tasarım UCL projesiyle aynı: siyah zemin, kırmızı vurgu, Barlow / Barlow Condensed, tabular sayılar, 44 px dokunma hedefi, renk + sayı birlikte.

---

## 6. Yayın

GitHub `main` → Vercel (otomatik). Ortam değişkeni yok. Haftalık güncelleme: `chrome-login` (oturum düştüyse), `fetch-game` (fiyat, skor, hafta), `fetch-squads`, `fetch-lineups`, maç günü `fetch-predicted <hafta>`, gerekirse `update-opta` / `update-values`. Sonra `pnpm test && pnpm build` ve push.

---

## 7. Bilinen eksikler / sonraki adımlar

- Oturum: Chrome penceresi kapanınca oyunun çerezleri düşüyor, `chrome-login.mjs` ile yeniden girmek gerekiyor. `kc_refresh_token` ile Keycloak'tan sessiz yenileme araştırılabilir.
- Elo kaynağı erişilebilir olunca `elo` alanı ve `update-elo.mjs`.
- Oyunun `starts`, `bps`, `xG`, `xA` alanları boş; doldurulursa başlama olasılığı ve oranlar doğrudan resmî veriden gelir.
- Kendi takımını (`fantasy-team/teams/<id>`) okuyup "mevcut kadrondan en iyi transfer" önerisi eklenebilir; uç nokta çalışıyor.
- Menajer kartları (Tüm Takım Sahaya için yedek ağırlığını 0,5'e çek; Hücum için diziliş kısıtı kalkmıyor).
- Ertelenen maçlar: veri artık oyunun hafta eşlemesini kullanıyor, ama `schedule` hâlâ takım başına haftada tek maç varsayar; çift maçlı hafta olursa güncellenmeli.

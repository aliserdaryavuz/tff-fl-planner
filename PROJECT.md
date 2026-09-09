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
| Fikstür, saat, skor, TFF kulüp/maç id | tff.org `Default.aspx?pageID=198&hafta=N` (windows-1254) | `fetch-fixtures.mjs` | Saatler yalnız yakın haftalarda açıklanmış (`tsi: null`); skorlar buradan, puan durumu uygulamada hesaplanır |
| Geçen sezon sırası | Wikipedia 2025–26 Süper Lig / 1. Lig | `scripts/lib/teams.mjs` | Yükselenler 16-18 |
| Opta gücü | theanalyst.com power rankings paketi (index.js, ~17 MB) | `update-opta.mjs` | Aynı adlı kadın/altyapı kayıtları: puanı yüksek olan A takımı |
| Kadro değeri | transfermarkt.com.tr TR1 sayfası (curl çalışıyor) | `update-values.mjs` | milyon € |
| Elo | clubelo.com / elofootball.com | — | 09.09.2026'da erişilemedi; alan isteğe bağlı, kaynak açılınca doldurulur |
| Oyuncu havuzu | FotMob kadro sayfaları (`__NEXT_DATA__`, headless Chrome) | `fetch-squads.mjs` | 540 oyuncu, mevki FotMob rolü, sakatlık; fiyat `null` |
| Fiyat, seçilme, oyun puanı | tfffantezilig.com — `api.tfffantezilig.com` üzerinden, giriş gerekli | `fetch-players.mjs` | Bkz. §3.1 |
| Son maçlar: ilk 11, dakika, gol, asist, kart, yenilen gol, bonus | FotMob maç sayfaları | `fetch-lineups.mjs` | 6 maça kadar (dostluk hariç); bonus iki takımın TFF puanıyla hesaplanır |
| Tahmini / resmî 11, maç öncesi sakat listesi | FotMob oynanmamış maç sayfası (`lineupType` predicted/confirmed) | `fetch-predicted.mjs` | Maç günü yeniden koş |
| Armalar | images.fotmob.com | `fetch-logos.mjs` | |

### 3.1 Oyunun API'si

Site Next.js; tarayıcı `/api/backend/<yol>` ile çerezli proxy'den `api.tfffantezilig.com`'a gider. Girişsiz sondada `players`, `teams`, `matches`, `stats`, `fantasy-team`, `user/me`, `leagues` 401 (var, giriş ister), diğer yollar 403 (izin listesinde değil). Giriş: `POST /api/auth/login {email, password}` → `{ok:true,user}` + çerez. `fetch-players.mjs` giriş yapar, aday yolları dener, `--dump` ile ham yanıtları önbellek klasörüne yazar ve yanıt içinde ad/fiyat/mevki alanlı ilk diziyi oyun dosyasına çevirir. Yanıt biçimi henüz görülmediği için normalize kuralları ilk gerçek dökümle güncellenecek. Hesap bilgisi `.env.local` (gitignore).

Fiyat gelince `data/fantasy-players.json` `pricesFrom: "game"` olur; `fetch-squads.mjs` bu listeyi korur, yalnız FotMob id ve sakatlık eşler. Fiyat adımı bilinmiyor; kadro kurucu 0,5 ve 0,1 adımlarını destekler.

---

## 4. Modeller

### 4.1 Takım gücü ve zorluk (`lib/strength.ts`, `lib/models.ts`)

UCL projesindeki karma güç: her kaynak 18 takım içinde 0-100'e yayılır, ağırlıklı ortalama, γ eğrisi. Kaynaklar: `opta`, `value` (log), `last` (19 − sıra), `table` (bu sezon maç başına puan; herkes ≥1 maç oynadıysa), `elo` (isteğe bağlı). Varsayılan 100/100/50/50. Zorluk rakip bazlı / göreli, HA 6.

### 4.2 Beklenen puan xP (`lib/xp.ts`)

Her oyuncu × maç için TFF puan tablosunun beklenen değeri:

- Beklenen gol: `λ_for = μ · e^(0,8·d/100)`, `λ_against = μ · e^(−0,8·d/100)`; `d` = benim güç − (rakip güç ± HA), `μ` lig ortalaması (bu sezon, 50 maç önceliğiyle 1,35'e çekilmiş).
- Dakika: başlama olasılığı `lib/lineups.ts` (son maçlar, tahmini 11, sakat listesi; verisi olmayan 0,15); yedekten girme oranı ve ortalama dakikalar son maçlardan; `p60`.
- Oranlar (gol/90, asist/90, sarı/90, kırmızı/90, bonus/90): gözlenen + mevki önceliği (4 maç değerinde), `PRIORS`.
- Kalemler: süre `pPlay·1 + p60·1`; gol `g90·dk/90·(λ_for/μ)·golPuanı`; asist ×3; gol yememe `p60·e^(−λ_against)·csPuanı`; yenilen `−dk/90·E[floor(G/2)]` (Poisson); kurtarış (KL) `3·dk/90·(λ_against/μ)/3`; kart; bonus `bonus90·dk/90·√(λ_for/μ)`.
- Ufuk: seçili haftadan `horizon` hafta, ağırlık `decay^(k)`; xP = ağırlıklı ortalama (hafta başına puan). Varsayılan ufuk 1.

Kalibre edilmemiş bir beklenti; arayüzde böyle söyleniyor. Gerçek fantasy puanı/90 (son maçlardan, TFF tablosuyla) ayrıca gösterilir.

### 4.3 Kadro kurucu (`lib/squad.ts`, `lib/formations.ts`)

Hedef: `Σ_XI xP + kaptan xP + benchWeight · Σ_yedek xP` (benchWeight varsayılan 0,1).

1. Kulüp kulüp DP ile ilk 11: durum (KL 0-1, DF 0-5, OS 0-5, FV 0-3, harcanan); kulüp teklifleri ≤3 oyuncu; aday budaması: aynı kulüp/mevkide kendisinden hem ucuz hem iyi ≥3 oyuncu varsa atılır, kalanların en iyi 6'sı. DP yarım birimde (0,1 fiyatlar yukarı yuvarlanır); bitişte her geçerli diziliş için yedek rezervi (mevki başına en ucuzlar) düşülür.
2. Geri izlemeyle en iyiye `tolerance` (1,5) yakın ilk 11'ler; her biri için yedekler en ucuzdan, kulüp ≤3 ve kesin bütçeyle doldurulur.
3. `bestLineup`: 15'ten 8 dizilişi deneyerek en iyi 11 + kaptan/yardımcı; yedek sırası kaleci, sonra puana göre. Yerel arama: aynı mevkiden daha yüksek puanlı adaylarla tek takas (bütçe, kulüp), 6 başlangıç × 30 adım.
4. Kilit (ilk 11'de kesin), dışlama, kulüp dışlama; hata kodları `no-prices`, `locked-position`, `locked-club`, `locked-budget`, `infeasible`.

Gerçek havuz + yapay 0,1 adımlı fiyatla ~0,3 s (`lib/squad-real.test.ts`).

---

## 5. Ekranlar (tek sayfa, mobil öncelikli)

1. Hafta çubuğu: hafta seçici (tarih, oynandı), son kayıt saati (ilk maç − 1 sa), ufuk ve azalma kaydırakları, hafta payları.
2. Haftanın kadrosu: saha (diziliş etiketi, K/Y rozetleri), yedek sırası, KPI'lar, kilit/çıkar/kulüp dışla, yedek ağırlığı, alternatif listesi, görsel kaydet. Fiyat yoksa açıklama kutusu.
3. Beklenen puan sıralaması: mevki ve fiyat filtresi, satırda takım/zorluk/mevki/başlama, p/90, xP; title'da kalem kalem döküm ve beklenen goller.
4. Hafta programı: 9 maç, saat (seçili dilimde) ya da skor, iki tarafın zorluğu.
5. Zorluk modeli paneli; takım paneli (rozetler, KPI, ufuk şeridi, fikstür listesi, kadro/fiyat listesi); tüm takımlar tablosu; puan durumu (açılır).
6. Renk ölçeği, dipnot (nasıl hesaplanır, kurallar, kaynaklar, sorumluluk reddi).

Tasarım UCL projesiyle aynı: siyah zemin, kırmızı vurgu, Barlow / Barlow Condensed, tabular sayılar, 44 px dokunma hedefi, renk + sayı birlikte.

---

## 6. Yayın

GitHub `main` → Vercel (otomatik). Ortam değişkeni yok. Haftalık güncelleme: `fetch-fixtures` (skor + saat), `fetch-lineups`, maç günü `fetch-predicted <hafta>`, gerekirse `update-opta` / `update-values`; fiyat için `fetch-players`. Sonra `pnpm test && pnpm build` ve push.

---

## 7. Bilinen eksikler / sonraki adımlar

- Oyun fiyatları ve seçilme oranı (giriş gerekli; ilk dökümden sonra normalize kurallarını doğrula).
- Elo kaynağı erişilebilir olunca `elo` alanı ve `update-elo.mjs`.
- Kurtarış sayıları FotMob maç sayfasında yok; kaleci kurtarışı mevki önceliği (3/90) × rakibin beklenen golü.
- Menajer kartları (Tüm Takım Sahaya için yedek ağırlığını 0,5'e çek; Hücum için diziliş kısıtı kalkmıyor).
- Ertelenen maçlar: fikstür haftada bir maç varsayar; erteleme olursa `fixturesOf`/`schedule` çift hafta desteği ister.

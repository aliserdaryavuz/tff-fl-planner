# TFF FL Planner 2026/27

TFF Fantezi Lig (Trendyol Süper Lig) için haftalık kadro planlayıcısı. Kişisel kullanım; ayrıntılı tanım [PROJECT.md](PROJECT.md), çalışma kuralları [CLAUDE.md](CLAUDE.md) içinde. UCL Fantasy Planner'ın kardeşi.

Ne yapıyor:

- **Hafta seçimi** — planlanan hafta (varsayılan sıradaki), kaç hafta ileriye bakılacağı ve sonraki haftaların ağırlığı. Transfer sınırsız olduğu için varsayılan ufuk 1 hafta.
- **Haftanın kadrosu** — 100 M TL, kulüp başına 3, 2-5-5-3 ve ilk 11 diziliş kurallarıyla (1 KL, en az 3 DF, en az 1 FV) beklenen puanı en yükseğe çıkaran ilk 11 + 4 yedek + kaptan/yardımcı; sahada diziliş olarak; kilitle/çıkar, kulüp dışla, alternatifleri listele. *Fiyat verisi oyunun giriş isteyen API'sinden gelir; yüklenene kadar bu bölüm bekler.*
- **Beklenen puan sıralaması (xP)** — TFF puan tablosunun her kalemi için beklenen değer: dakika, gol/asist (oyuncunun son maç oranı × takımın beklenen golü), gol yememe (Poisson), yenilen gol, kurtarış, kart, bonus; başlama olasılığı son maçlardan.
- **Hafta programı** — 9 maç, saatler (seçili dilimde), skorlar, son kadro kaydı saati.
- **Fikstür zorluğu** — karma güç (Opta, kadro değeri, geçen sezon, bu sezonun tablosu) ile rakip bazlı / göreli 1-5 zorluk; takım paneli, tüm takımlar tablosu, puan durumu.
- **İki dil, saat dilimi, görsel kaydet, paylaşılabilir bağlantı.**

## Komutlar

```bash
pnpm dev        # geliştirme sunucusu
pnpm test       # birim testleri (vitest)
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm build      # üretim derlemesi
```

Push etmeden önce dördü de temiz geçmeli.

## Veri güncelleme

```bash
node scripts/fetch-fixtures.mjs            # TFF fikstür + skorlar (34 hafta)
node scripts/update-opta.mjs               # Opta Power Rankings
node scripts/update-values.mjs             # Transfermarkt kadro değerleri
node scripts/fetch-squads.mjs              # FotMob kadroları (oyuncu havuzu)
node scripts/fetch-lineups.mjs --matches 6 # son maçlar: ilk 11, dakika, gol, asist, kart, bonus
node scripts/fetch-predicted.mjs <hafta>   # tahmini / resmî ilk 11 (maç günü)
node scripts/fetch-players.mjs --dump      # oyun fiyatları (.env.local: TFF_EMAIL, TFF_PASSWORD)
node scripts/fetch-logos.mjs               # armalar
```

FotMob betikleri headless Chrome kullanır (`CHROME` ortam değişkeniyle yol değiştirilebilir).

## Düzen

```
app/          sayfa ve düzen
components/   Shell, GameweekBar, SquadBuilder + SquadPitch, PickList, WeekSchedule,
              ModelPanel, TeamPanel, TeamsTable, Standings, Exportable, ...
lib/          data (takım/fikstür/puan durumu), strength (güç kaynakları), models (zorluk),
              scoring.mjs (TFF puan tablosu), lineups (son maçlar, başlama olasılığı),
              xp (beklenen puan), picks, formations, squad (kadro kurucu),
              i18n, format, time, url-state, bands
scripts/      veri toplama betikleri (lib/teams.mjs, lib/fotmob.mjs, lib/names.mjs)
data/         superlig-2026-27.json, fantasy-players.json, lineups.json, predicted-xi.json
public/logos/ 18 kulüp arması
```

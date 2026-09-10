@AGENTS.md

# CLAUDE.md

Bu repo: TFF Fantezi Lig 2026/27 (Trendyol Süper Lig) haftalık kadro planlayıcısı. Kişisel kullanım.
Ayrıntılı tanım `PROJECT.md` içinde — yeni bir işe başlamadan önce onu oku. Köken: `../ucl-fantasy-planner` (aynı mimari, UCL Fantasy için).

## Çalışma kuralları

- Arayüz Türkçe (varsayılan) ve İngilizce; seçim `?lang=` ile taşınır. Kod, değişken adı, dosya adı, commit mesajı İngilizce; kod içi yorumlar Türkçe.
- Görünen her metin `lib/i18n.ts` sözlüğünden gelir; bileşende düz metin yazma. İngilizce sözlük `Strings` tipinde, eksik çeviri derlemede yakalanır.
- Sayı, tarih, yüzde ve para biçimi dile bağlı: `lib/format.ts` (fantasy fiyatı "M TL", kadro değeri "M€"). Bileşenler `useI18n().f` kullanır.
- Saatler Türkiye saati (`tsi`, sabit UTC+3); TFF henüz açıklamadıysa `tsi: null`. Gösterim `lib/time.ts`.
- Küçük adımlar. Her adımdan sonra `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test` geçsin.
- Bir dosyayı baştan yazmadan önce sor. Yerinde düzelt.

## Veri

- Ana kaynak oyunun kendi API'si: `scripts/fetch-game.mjs` hem `data/superlig-2026-27.json` (takımlar, 306 maç, 34 hafta, son kadro kaydı saatleri, skorlar) hem `data/fantasy-players.json` (fiyat, seçilme oranı, sezon toplamları) yazar. Elle veri uydurma, tahminî değer ekleme.
- API Keycloak ile korunuyor ve giriş **Google hesabıyla**; şifreyle programatik giriş yok. Çözüm: projeye ayrılmış kalıcı Chrome profilinde bir kez giriş (`node scripts/chrome-login.mjs`), betikler CDP ile o tarayıcıya bağlanır (`scripts/lib/chrome.mjs`). Token hiçbir dosyaya yazılmaz; kullanıcının günlük Chrome'una dokunma.
- Oyunun doldurmadığı alanlar (starts, bps, xG) sıfır geliyor; `fetch-game.mjs` tamamen boş alanları dosyaya yazmaz. Sıfır dolu sütun veri sanılmasın.
- Sakatlık bilgisi oyunun API'sinde yok: FotMob'dan gelir (`fetch-squads.mjs` oyun listesini korur, yalnız `fotmobId` ve `status` ekler).
- Son maç verisi `data/lineups.json` (`fetch-lineups.mjs`, FotMob, headless Chrome), tahmini 11 `data/predicted-xi.json` (`fetch-predicted.mjs`).
- Güç kaynakları: `update-opta.mjs` (Opta Power Rankings), `update-values.mjs` (Transfermarkt); geçen sezon sırası `scripts/lib/teams.mjs` içinde.
- `verify-fixtures.mjs` tff.org ile karşılaştırır, hiçbir şey yazmaz.
- Veri değişirse `data/validate.test.ts` geçmeli: 18 takım, 306 maç, her takım haftada bir maç, 17 ev + 17 deplasman.
- Veritabanı yok, çalışma anında dış API yok; JSON güncellenip push edilir.

## Mimari

- Next.js App Router + TypeScript + Tailwind. Hesaplar saf fonksiyon (`lib/`), React'ten bağımsız ve test edilebilir.
- TFF puan tablosu tek yerde: `lib/scoring.mjs` (düz JS; betikler de okur). Beklenen puan `lib/xp.ts`, kadro `lib/squad.ts` + `lib/formations.ts`.
- Durum URL query string'inde (`lib/url-state.ts`): dil, dilim, hafta, ufuk, azalma, yedek ağırlığı, takım, model, ağırlıklar. Kilit/dışlama listeleri taşınmaz.
- Renk kodları yalnız `lib/bands.ts`. Bağımlılık ekleme konusunda cimri ol.

## Yapma

- Menajer kartlarını modele ekleme (arayüzde yalnız not).
- Fiyat uydurup kadro kurucuyu "çalışır" gösterme; fiyat yoksa açıkça söyle.
- Oyunun oturum token'ını dosyaya, ortam değişkenine ya da repoya yazma.
- Kullanıcının günlük Chrome profilini kapatma/kopyalama; veri için ayrılmış profil var.
- Analytics, çerez bandı, giriş ekranı, ödeme, veritabanı.

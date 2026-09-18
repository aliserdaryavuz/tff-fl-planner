import type { TimeZone } from "@/lib/time";

export type Lang = "tr" | "en";

/** Düğme sırası: varsayılan dil önce. */
export const LANGS: Lang[] = ["tr", "en"];

export const LANG_LABEL: Record<Lang, string> = {
  tr: "Türkçe",
  en: "English",
};

export const LOCALE: Record<Lang, string> = {
  tr: "tr-TR",
  en: "en-GB",
};

/**
 * Arayüz metinleri. Türkçe sözlük referans; İngilizce sözlük aynı tipte olmak
 * zorunda, böylece eksik çeviri derlemede yakalanır.
 */
const tr = {
  lang: {
    label: "Dil",
  },
  docTitle: (season: string) => `TFF FL Planner ${season}`,
  header: {
    title: "TFF FL Planner",
    tagline: (fixtures: string, tz: string) =>
      `Trendyol Süper Lig, 18 takım, 34 hafta. Saatler: ${tz}. Fikstür: ${fixtures}.`,
  },
  nav: {
    label: "Bölümler",
    model: "Model",
    teams: "Takımlar",
    players: "Oyuncular",
    squad: "Kadro",
  },
  pages: {
    model: {
      title: "Model ve haftalar",
      lead: "Önce hangi haftaya bakıyoruz, sonra fikstür zorluğunu hangi güç kaynaklarıyla ölçüyoruz. Bu iki ayar diğer sayfalardaki bütün sayıları belirliyor.",
    },
    teams: {
      title: "Takımlar ve fikstür",
      lead: "Seçili haftalarda hangi takımın işi kolay, hangisinin zor. Aşağıda haftanın maçları ve puan durumu.",
    },
    players: {
      title: "Oyuncu sıralaması",
      lead: "Beklenen puan, seçilme oranı ve geçmiş puan; ağırlıkları kendin veriyorsun. Sakat ve cezalılar listeye girmiyor.",
    },
    squad: {
      title: "Haftanın kadrosu",
      lead: "Bu sıralamadan kurulan 15 kişilik kadro: ilk 11, yedekler ve kaptan. Bütçe ve kulüp sınırı sert kısıt.",
    },
  },
  export: {
    button: "Görsel kaydet",
    busy: "Hazırlanıyor…",
    failed: "Görsel oluşturulamadı.",
    footer: (date: string) => `${date} itibarıyla`,
  },
  time: {
    label: "Saat dilimi",
    zones: {
      "Europe/Istanbul": "Türkiye",
      UTC: "UTC",
      "Europe/London": "Londra",
      "Europe/Paris": "Orta Avrupa (Paris, Berlin)",
      "Europe/Athens": "Atina",
      "Asia/Dubai": "Dubai",
      "Asia/Kolkata": "Hindistan",
      "Asia/Singapore": "Singapur",
      "Asia/Tokyo": "Tokyo",
      "Australia/Sydney": "Sidney",
      "America/Sao_Paulo": "São Paulo",
      "America/New_York": "New York",
      "America/Chicago": "Chicago",
      "America/Los_Angeles": "Los Angeles",
    } as Record<TimeZone, string>,
  },
  gameweek: {
    heading: "Hangi hafta için planlıyorsun?",
    label: "Hafta",
    week: (n: number) => `${n}. hafta`,
    weekShort: (n: number) => `${n}. hf`,
    prev: "Önceki hafta",
    next: "Sonraki hafta",
    range: (from: string, to: string) => `${from} – ${to}`,
    played: "oynandı",
    upcoming: "sıradaki",
    deadline: (when: string) => `Son kadro kaydı: ${when} (ilk maçtan 1 saat önce).`,
    deadlineUnknown:
      "Bu haftanın saatleri TFF tarafından henüz açıklanmadı; son kadro kaydı ilk maçtan 1 saat önce.",
    horizon: {
      label: "Kaç hafta ileriye bak",
      note: "Transfer sınırsız ve puan kesintisi yok; bu yüzden varsayılan 1 (yalnız seçili hafta). Kadroyu birkaç hafta tutacaksan ufku aç: öneri ve kadro, seçili haftadan itibaren bu kadar haftanın ağırlıklı ortalamasına göre kurulur.",
    },
    decay: {
      label: "Sonraki haftaların ağırlığı",
      note: "Seçili hafta 1, sonraki her hafta bir öncekinin bu katı kadar sayılır: 1 = tüm haftalar eşit, 0 = yalnız seçili hafta.",
      weights: "Hafta payları",
    },
  },
  model: {
    heading: "Fikstür zorluğu modeli",
    pickLabel: "Model seçimi",
    reset: "Varsayılan değerlere dön",
    abs: {
      name: "Rakip bazlı",
      desc: "Sadece rakibin gücüne bakar: karma güç, deplasmanda +HA evde -HA ile 1-5'e çevrilir. Seçili takımın kendi gücü hesaba girmez — klasik fikstür zorluğu.",
    },
    rel: {
      name: "Göreli",
      desc: "Seçili takım ile rakip arasındaki güç farkı: zorluk = 1 + 4 × (fark + 100) / 200, ev avantajı dahil. Eşit güçte 3,0 çıkar; güçlü takımların toplamı düşer, zayıfların yükselir.",
    },
    params: {
      weights: {
        label: "Güç kaynakları ve ağırlıkları",
        note: "Her kaynak 18 takım içinde 0-100'e yayılır, sonra ağırlıklı ortalaması alınır. Ağırlıkların büyüklüğü değil oranı önemli; hepsi sıfırsa eldeki kaynakların düz ortalaması kullanılır. Aynı güç tablosu beklenen gol ve gol yememe olasılığını da belirler.",
      },
      ha: {
        label: "Ev sahibi avantajı",
        note: "0-100 güç ölçeğinde. 6 ≈ tipik ev avantajının güç aralığına oranı; beklenen gol hesabına da girer.",
      },
      gamma: {
        label: "Güç eğrisi γ",
        note: "γ < 1 orta/alt takımları güçlendirir, γ > 1 sadece zirveyi ayırır (güç = 100·(g/100)^γ). Karışımdan sonra uygulanır.",
      },
    },
  },
  sources: {
    zeroWeights: "hepsi sıfır: düz ortalama kullanılıyor",
    missing: (list: string) => `Veri bekleyen kaynaklar: ${list}.`,
    opta: {
      label: "Opta gücü",
      note: "Opta Power Rankings (0-100), sonuç temelli global derecelendirme (theanalyst.com).",
    },
    value: {
      label: "Kadro değeri",
      note: "Transfermarkt toplam kadro değeri; logaritmik ölçekte (iki katı değer = sabit mesafe).",
    },
    last: {
      label: "Geçen sezon sırası",
      note: "2025/26 bitiş sırası; yükselenler 1. Lig sırasıyla 16-18. Sezon ilerledikçe ağırlığını düşür.",
    },
    table: {
      label: "Bu sezon (maç başına puan)",
      note: "Oynanan maçlardan puan durumu; az maçta oynak, sezon ilerledikçe ağırlığını artır.",
    },
    elo: {
      label: "Elo",
      note: "Kulüp Elo'su; kaynak erişilebilir olunca dolar.",
    },
  },
  share: {
    copy: "Bağlantıyı kopyala",
    copied:
      "Bağlantı kopyalandı: hafta, ufuk, takım, model ve ağırlıklar adreste saklanır.",
    manual: "Adres çubuğundaki bağlantıyı kopyala; seçimler adreste saklanır.",
  },
  team: {
    heading: "Takım",
    select: "Takım seç",
    prev: (label: string) => `Önceki takım (${label})`,
    next: (label: string) => `Sonraki takım (${label})`,
    last: (n: number) => (n <= 15 ? `2025/26: ${n}.` : "yükseldi"),
    opta: "Opta",
    squadValue: "Kadro değeri",
    squadValueTitle: "Transfermarkt toplam kadro değeri (milyon €)",
    tableRow: (rank: number, pts: number, p: number) => `Puan durumu ${rank}. (${pts} p, ${p} maç)`,
    strength: "Karma güç",
    strengthRank: "Güç sırası",
    totalWith: (n: number) => `Toplam zorluk (${n} maç)`,
    perMatch: "Maç başına",
    rank: "Sıra / 18 (1 = en kolay)",
    week: (n: number) => `${n}. hf`,
    windowHint:
      "Şerit, seçili haftadan başlayan ufuk penceresini gösterir; aşağıdaki listede 34 maçın tamamı var, oynananlar skorla.",
    weekTitle: (n: number, opp: string, ha: string, band: string) =>
      `${n}. hafta: ${opp} (${ha}) — ${band}`,
    home: "ev",
    away: "deplasman",
    allFixtures: "34 maçın tamamı",
  },
  fixture: {
    strengthBadge: (value: string) => `Güç ${value}`,
    strengthTitle: "Rakibin karma gücü (0-100)",
    homeLabel: "Ev",
    awayLabel: "Dep",
    homeTitle: "Ev sahibi",
    awayTitle: "Deplasman",
    tbd: "saat açıklanmadı",
  },
  table: {
    heading: "Tüm takımlar, seçili modele göre",
    sortLabel: "Sıralama",
    sort: {
      total: "Toplam zorluk",
      strength: "Güç",
      last: "Geçen sezon",
      name: "Ad",
    },
    columns: {
      rank: "#",
      rankTitle: "Zorluk sırası (1 = en kolay fikstür)",
      team: "Takım",
      weeks: "Haftalar",
      strength: "Güç",
      strengthTitle: "Seçili ağırlıklarla karma güç",
      total: "Toplam",
    },
    window: (from: number, to: number) =>
      from === to ? `${from}. hafta` : `${from}-${to}. hafta`,
    note: "# sütunu her zaman zorluk sırasıdır (1 = en kolay fikstür), sıralamayı değiştirsen de. Güç: seçili ağırlıklarla oluşan karma güç (0-100). Satıra dokununca o takım seçilir. Renkli kareler ufuk penceresindeki haftalar.",
  },
  standings: {
    heading: "Puan durumu (oynanan maçlardan)",
    columns: {
      rank: "#",
      team: "Takım",
      p: "O",
      w: "G",
      d: "B",
      l: "M",
      gd: "Av",
      pts: "P",
    },
    note: "TFF fikstür sayfasındaki skorlardan hesaplanır; sıralama puan, averaj, atılan gol. “Bu sezon” güç kaynağı buradaki maç başına puandır.",
  },
  bands: {
    vEasy: "Çok kolay",
    easy: "Kolay",
    mid: "Orta",
    hard: "Zor",
    vHard: "Çok zor",
    heading: "Renk ölçeği",
  },
  positions: {
    GK: "Kaleci",
    DEF: "Defans",
    MID: "Orta saha",
    FWD: "Forvet",
  },
  positionsShort: {
    GK: "KL",
    DEF: "DF",
    MID: "OS",
    FWD: "FV",
  },
  status: {
    I: "sakat",
    D: "şüpheli",
    S: "cezalı",
  },
  fantasy: {
    heading: "Kadro ve fantasy fiyatları",
    summary: (team: string, count: number) => `${team} · ${count} oyuncu`,
    note: (source: string, budget: string) =>
      `Kaynak: ${source}. Bütçe ${budget}, bir takımdan en fazla 3 oyuncu.`,
    noPrice: "fiyat yok",
  },
  pickWeights: {
    heading: "Ağırlıklar",
    note: "Skor = (model × ağırlık + seçilme × ağırlık + geçmiş puan × ağırlık) × süre çarpanı. Her ölçüt havuzun tamamında 0-100e çevrilir; ağırlıkların büyüklüğü değil oranı önemlidir. Fikstür ayrı bir kaydırak değil: zorluk modelinin çıktısı zaten model sinyalinin içinde, hangi haftaların sayılacağı da yukarıdaki hafta seçicisinden geliyor.",
    reset: "Varsayılan ağırlıklar",
    invert: "Az seçilen oyuncuları öne al",
    invertNote: "Açıkken seçilme oranı tersine döner: kalabalığın gitmediği oyuncular yükselir.",
    signals: {
      model: {
        label: "Model: oynarsa beklenen puan",
        note: "Oyuncu 90 dakika oynarsa seçili haftalardan kaç puan beklenir. Fikstür zorluğu, ev/deplasman, mevki ve oyuncunun kendi gol, asist, kart, bonus oranları bunun içinde.",
      },
      sel: {
        label: "Seçilme oranı",
        note: "Oyunda kaç menajerin aldığı; logaritmik ölçekte. Kalabalığın bilgisi ve dolaylı bir oynar sinyali.",
      },
      points: {
        label: "Geçmiş puan",
        note: "Oyunun verdiği toplam puan, 90 dakika başına ve az dakikada güvensiz sayılarak. Modelin oranlarıyla kısmen örtüşür, o yüzden varsayılanı sıfır.",
      },
    },
    minutes: {
      label: "İlk 11 olasılığının etkisi",
      note: "Skor süre çarpanıyla ölçeklenir. 1 = tam etki (hiç oynamayacak oyuncu 0,15 katına iner), 0 = süre yok sayılır. Olasılık son maçlardaki ilk 11, dakikalar, tahmini kadrolar ve sakat listesinden.",
    },
  },
  picks: {
    heading: "Kim alınmalı? Beklenen puan sıralaması",
    note: "Sıralama üç sinyalin ağırlıklı ortalaması, sonucu süre çarpanı ölçekler. Model sinyali, yukarıdaki adımda hesaplanan fikstür zorluğuyla birlikte TFF puan tablosunun beklenen değeridir: dakika puanı, gol ve asist (oyuncunun oranı × takımın beklenen golü), gol yememe (Poisson), yenilen gol, kurtarış, kart, bonus. Oyuncunun gol/asist oranı ham sayımla beklenen üretimin (xG/xA) harmanı: ağırlık ölçüldü, beklenen üretim gelecek haftayı daha iyi öngörüyor. Sayımlar oyunun resmî verisinden, beklenen üretim maç verisinden; az dakikada mevki ortalamasına çekilir. Fiyat sıralamaya girmez, bütçe kadro kurucuda sert kısıt. Sakat ve cezalılar listeye girmez, şüpheliler işaretli. Kesin bir tahmin değil, aynı ölçekte bir beklenti.",
    positionLabel: "Mevki",
    all: "Tümü",
    floor: "Alt fiyat sınırı",
    budget: "Üst fiyat sınırı",
    columns: {
      rank: "#",
      player: "Oyuncu",
      price: "Fiyat",
      xp: "xP",
      xpTitle: "Beklenen puan (hafta başına): oynama olasılığı dahil, ağırlıklardan bağımsız",
      score: "Skor",
      scoreTitle: "Ağırlıklı sinyal toplamı × süre çarpanı (0-100)",
      start: "Başlar",
      ppm: "PM",
      ppmTitle: "Oyunun kendi verisi: maç başına puan",
      per90: "p/90",
      per90Title: "Son maçlardan gerçek fantasy puanı / 90 dk (az dakikada düzeltmeli)",
    },
    official: (pts: number, mins: number, form: string, sel: string) =>
      `Oyun verisi: ${pts} puan, ${mins} dakika, form ${form}, seçilme ${sel}`,
    news: (text: string) => `Oyun notu: ${text}`,
    difficultyTitle: "Seçili haftalarda maç başına zorluk",
    empty: "Bu filtrelerle oyuncu kalmadı; fiyat sınırını yükselt.",
    start: (pct: string) => `${pct} başlar`,
    startTitle: (starts: number, matches: number, minutes: number) =>
      `Son ${matches} maçta ${starts} kez ilk 11, maç başına ${minutes} dk`,
    startUnknown: "Son maç verisi yok; düşük olasılık sayıldı",
    predictedIn: (listed: number, sources: number) =>
      `Tahmini 11: ${sources} kaynaktan ${listed}'inde`,
    confirmedStart: "Resmî kadroda ilk 11",
    confirmedOut: "Resmî kadroda ilk 11'de değil",
    predictedUnavailable: "Maç öncesi sakat/cezalı listesinde",
    source: (source: string, date: string, n: number) =>
      `Son maç verisi: ${source}, ${date}, takım başına son ${n} maç.`,
    predictedSource: (source: string, date: string, teams: number) =>
      `Tahmini 11: ${source}, ${date}, ${teams} takım.`,
    missing: "Son maç verisi henüz yüklenmedi; herkes düşük olasılıkta.",
    breakdown: {
      appearance: "Süre",
      goals: "Gol",
      assists: "Asist",
      cleanSheet: "Gol yememe",
      conceded: "Yenilen gol",
      saves: "Kurtarış",
      cards: "Kart",
      bonus: "Bonus",
      total: "Toplam",
      lambda: (forUs: string, against: string, cs: string) =>
        `Beklenen gol ${forUs}, yenilen ${against}, gol yememe %${cs}`,
    },
    weekXp: (md: number, opp: string, ha: string, xp: string) =>
      `${md}. hf ${opp} (${ha}): ${xp}`,
    noFixture: (md: number) => `${md}. hf: maç yok`,
    per90: (value: string) => `${value} p/90`,
    per90Title: (pts: number, mins: number, matches: number) =>
      `Son ${matches} maçta ${pts} fantasy puanı, ${mins} dakika`,
    topN: (n: number) => `ilk ${n}`,
  },
  squad: {
    heading: "Haftanın kadrosu: ilk 11 + 4 yedek + kaptan",
    headingShort: "Haftanın kadrosu",
    note: (budget: string, perClub: number, formation: string) =>
      `${budget} bütçe, kulüp başına en fazla ${perClub} oyuncu, ${formation} kadro; ilk 11'de 1 kaleci, en az 3 defans ve 1 forvet (3-5-2, 3-4-3, 4-4-2, 4-3-3, 4-5-1, 5-4-1, 5-3-2, 5-2-3). Hedef: ilk 11'in skoru + kaptanın skoru bir daha + yedeklerin küçük bir payı; skor yukarıdaki ağırlıklardan geliyor. Para ilk 11'e gider, yedekler en ucuzdan seçilir. Transfer sınırsız olduğu için her hafta sıfırdan kurulabilir.`,
    noPrices:
      "Fiyat verisi yok: oyuncu fiyatları oyunun giriş gerektiren API'sinden geliyor. `node scripts/chrome-login.mjs` ile bir kez giriş yapıp `node scripts/fetch-game.mjs` çalıştırınca liste ve fiyatlar dolar; o zamana kadar yalnız beklenen puan sıralaması çalışır.",
    errors: {
      "no-prices": "Fiyat verisi yok.",
      "locked-position": "Kilitli oyuncular ilk 11 mevki sınırını aşıyor (1 kaleci, en fazla 5 defans, 5 orta saha, 3 forvet).",
      "locked-club": "Aynı kulüpten en fazla 3 oyuncu kilitlenebilir.",
      "locked-budget": "Kilitli oyuncular tek başına bütçeyi aşıyor.",
      infeasible: "Bu kısıtlarla kadro tamamlanamadı; kilitli oyuncuları veya bütçeyi gözden geçir.",
    },
    failed: "Bu kısıtlarla kadro kurulamadı.",
    search: "Oyuncu kilitle veya çıkar, kulübü tümüyle çıkar",
    searchPlaceholder: "Oyuncu ya da takım ara",
    pin: "Kilitle",
    ban: "Çıkar",
    banClub: "Kulübü çıkar",
    clubPlayers: (n: number) => `${n} oyuncu`,
    lockedTitle: "Kesin oynasın:",
    excludedTitle: "Alınmasın:",
    excludedClubsTitle: "Kulüp dışı:",
    clear: "Kısıtları temizle",
    removeChip: "Listeden çıkar",
    benchWeight: {
      label: "Yedeklerin ağırlığı",
      note: "Yedek puanı ancak otomatik değişiklikle sayılır; hedefte bu katsayıyla girer. 0 = yedek en ucuz olsun, 0,5 = yedekler de ciddiye alınsın (Tüm Takım Sahaya kartı için).",
    },
    xiScore: "İlk 11 skoru (kaptan dahil)",
    benchScore: "Yedek skoru",
    xiXp: (value: string) => `İlk 11 beklenen puanı ${value} (kaptan dahil).`,
    formation: (f: string) => `Diziliş ${f}`,
    captain: "Kaptan",
    vice: "Yardımcı",
    captainShort: "K",
    viceShort: "Y",
    spent: (spent: string, left: string) => `Harcanan ${spent}, kalan ${left}.`,
    xiSpend: "İlk 11",
    benchSpend: "Yedekler",
    onlyOne: "Bu puanda tek kadro var.",
    manyOptions: (count: number, capped: string, index: number) =>
      `Bu puana çok yakın ${count}${capped} kadro var; ${index}. gösteriliyor.`,
    another: "Başka bir kadro getir",
    listOpen: "Seçenekleri listele",
    listClose: "Seçenekleri gizle",
    clubs: (list: string) => `Kulüp dağılımı: ${list}.`,
    pitch: "Kadro sahada",
    pitchNote:
      "Kartta fiyat (M TL) ve beklenen puan; sarı K kaptan, yeşil Y yardımcı kaptan; kırmızı çerçeve kilitli oyuncu, ? şüpheli. Ayrıntı için kartın üstünde bekle.",
    bench: "Yedekler (otomatik değişiklik sırası)",
    benchNote:
      "İlk 11'den oynamayan çıkarsa oyun sıradaki yedeği sokar; kaleci yalnız kaleciyle değişir. Sıra: kaleci, sonra puana göre saha oyuncuları.",
  },
  schedule: {
    heading: (n: number) => `${n}. hafta programı`,
    note: "TFF fikstür sayfasından; saatler yayıncı gerekçesiyle değişebilir. Ertelenen maç oyunda oynandığı haftaya sayılır.",
    result: "sonuç",
  },
  footer: {
    how: "Nasıl hesaplanır?",
    howText:
      "Takım gücü: seçtiğin kaynakların (Opta, kadro değeri, geçen sezon sırası, bu sezonun tablosu) 18 takım içinde 0-100'e yayılmış hâllerinin ağırlıklı ortalaması. Fikstür zorluğu her maç için 1,0-5,0. Beklenen puan: aynı güç tablosundan iki takımın beklenen golü (lig ortalaması × e^(0,8 × güç farkı/100), ev avantajı dahil), oradan gol yememe olasılığı ve yenilen gol; oyuncunun gol/asist/kart/bonus oranı son maçlardan, az veride mevki önceliğine çekilerek; başlama olasılığı ve dakika son maçlardaki ilk 11'den. Kadro kurucu ilk 11'i dinamik programlamayla, yedekleri en ucuzdan seçer, sonra takaslarla kaptan dahil hedefi iyileştirir.",
    rules: "TFF Fantezi Lig kuralları:",
    rulesText:
      "100 M TL bütçe, 15 oyuncu (2 kaleci, 5 defans, 5 orta saha, 3 forvet), aynı takımdan en fazla 3. İlk 11'de 1 kaleci, en az 3 defans ve 1 forvet. Kaptan ×2. Transfer sınırsız. Kadro haftanın ilk maçından 1 saat önce kilitlenir. Puan: 60 dk'ya kadar 1, üstü 2; gol kaleci 10 / defans 6 / orta saha 5 / forvet 4; asist 3; gol yememe kaleci-defans 4, orta saha 1 (kural sayfası 60+ dk diyor ama oyunun kendi sayımı tam maç istiyor, ölçüldü); her 3 kurtarış 1 (her maçın kendi içinde sayılır, sezon toplamında değil — ölçüldü); penaltı kurtarma 5, kaçırma -2; her 2 yenilen gol kaleci-defans -1 (yalnız oyuncu sahadayken yenilen goller); sarı -1, kırmızı -3, kendi kalesine -2; maçın en iyi üçü 3/2/1 bonus. Menajer kartları (Tripleks, Dört Dörtlük, Tüm Takım Sahaya, Hücum, Limitsiz Bütçe) modelde yok.",
    sources: "Kaynaklar:",
    sourcesText: (fixtures: string) => `Fikstür ve skorlar ${fixtures}`,
    disclaimer:
      "Gayriresmî, gönüllü bir taraftar aracıdır; TFF, TFF Fantezi Lig ya da herhangi bir kulüple bağlantısı yoktur. Kulüp armaları ve adları ilgili sahiplerinin tescilli markasıdır, yalnızca tanımlama amacıyla kullanılmıştır. Reklam ve ücret yoktur.",
  },
};

export type Strings = typeof tr;

const en: Strings = {
  lang: {
    label: "Language",
  },
  docTitle: (season: string) => `TFF FL Planner ${season}`,
  header: {
    title: "TFF FL Planner",
    tagline: (fixtures: string, tz: string) =>
      `Trendyol Süper Lig, 18 teams, 34 matchweeks. Times: ${tz}. Fixtures: ${fixtures}.`,
  },
  nav: {
    label: "Sections",
    model: "Model",
    teams: "Teams",
    players: "Players",
    squad: "Squad",
  },
  pages: {
    model: {
      title: "Model and matchweeks",
      lead: "First which week we are looking at, then which strength sources measure fixture difficulty. These two settings drive every number on the other pages.",
    },
    teams: {
      title: "Teams and fixtures",
      lead: "Who has the easy run in the selected weeks and who does not. Below, the week's matches and the table.",
    },
    players: {
      title: "Player ranking",
      lead: "Expected points, ownership and points so far, weighted the way you choose. Injured and suspended players are left out.",
    },
    squad: {
      title: "Squad of the week",
      lead: "The 15 built from this ranking: starting XI, bench and captain. Budget and the per-club limit are hard constraints.",
    },
  },
  export: {
    button: "Save image",
    busy: "Preparing…",
    failed: "Could not create the image.",
    footer: (date: string) => `as of ${date}`,
  },
  time: {
    label: "Time zone",
    zones: {
      "Europe/Istanbul": "Türkiye",
      UTC: "UTC",
      "Europe/London": "London",
      "Europe/Paris": "Central Europe (Paris, Berlin)",
      "Europe/Athens": "Athens",
      "Asia/Dubai": "Dubai",
      "Asia/Kolkata": "India",
      "Asia/Singapore": "Singapore",
      "Asia/Tokyo": "Tokyo",
      "Australia/Sydney": "Sydney",
      "America/Sao_Paulo": "São Paulo",
      "America/New_York": "New York",
      "America/Chicago": "Chicago",
      "America/Los_Angeles": "Los Angeles",
    },
  },
  gameweek: {
    heading: "Which matchweek are you planning?",
    label: "Matchweek",
    week: (n: number) => `Matchweek ${n}`,
    weekShort: (n: number) => `MW ${n}`,
    prev: "Previous matchweek",
    next: "Next matchweek",
    range: (from: string, to: string) => `${from} – ${to}`,
    played: "played",
    upcoming: "next",
    deadline: (when: string) => `Squad deadline: ${when} (one hour before the first match).`,
    deadlineUnknown:
      "The TFF has not published kick-off times for this week yet; the deadline is one hour before the first match.",
    horizon: {
      label: "Matchweeks to look ahead",
      note: "Transfers are unlimited and free, so the default is 1 (the selected week only). If you plan to keep the squad for a few weeks, widen the horizon: picks and squad follow the weighted average of that many weeks from the selected one.",
    },
    decay: {
      label: "Weight of later matchweeks",
      note: "The selected week counts 1, every following one this fraction of the previous: 1 = all weeks equal, 0 = the selected week only.",
      weights: "Week shares",
    },
  },
  model: {
    heading: "Fixture difficulty model",
    pickLabel: "Model",
    reset: "Reset to defaults",
    abs: {
      name: "Opponent based",
      desc: "Looks only at the opponent: their blended strength, plus HA away and minus HA at home, mapped onto 1-5. Your own strength is ignored — classic fixture difficulty.",
    },
    rel: {
      name: "Relative",
      desc: "The strength gap between your team and the opponent: difficulty = 1 + 4 × (gap + 100) / 200, home advantage included. Equal strength gives exactly 3.0, so strong teams end up with lower totals.",
    },
    params: {
      weights: {
        label: "Strength sources and weights",
        note: "Each source is spread over 0-100 within the 18 teams, then averaged by your weights. Only the ratio matters; if all are zero the available sources are averaged evenly. The same strength table drives expected goals and clean-sheet odds.",
      },
      ha: {
        label: "Home advantage",
        note: "On the 0-100 strength scale. 6 ≈ the usual home advantage as a share of that range; it also enters the expected-goals model.",
      },
      gamma: {
        label: "Strength curve γ",
        note: "γ < 1 lifts the mid and lower teams, γ > 1 separates only the very top (strength = 100·(g/100)^γ). Applied after blending.",
      },
    },
  },
  sources: {
    zeroWeights: "all zero: using an even average",
    missing: (list: string) => `Sources still waiting for data: ${list}.`,
    opta: {
      label: "Opta rating",
      note: "Opta Power Rankings (0-100), a results-based global rating (theanalyst.com).",
    },
    value: {
      label: "Squad value",
      note: "Transfermarkt total squad value, on a log scale (twice the value = a fixed step).",
    },
    last: {
      label: "Last season's finish",
      note: "2025/26 final position; promoted clubs 16-18 in First League order. Lower its weight as the season goes on.",
    },
    table: {
      label: "This season (points per match)",
      note: "Standings from the matches played; noisy early on, raise its weight as the season goes on.",
    },
    elo: {
      label: "Elo",
      note: "Club Elo; fills in once the source is reachable.",
    },
  },
  share: {
    copy: "Copy link",
    copied:
      "Link copied: matchweek, horizon, team, model and weights all travel in the address.",
    manual: "Copy the link from the address bar; your choices are stored there.",
  },
  team: {
    heading: "Team",
    select: "Select team",
    prev: (label: string) => `Previous team (${label})`,
    next: (label: string) => `Next team (${label})`,
    last: (n: number) => (n <= 15 ? `2025/26: ${n}th` : "promoted"),
    opta: "Opta",
    squadValue: "Squad value",
    squadValueTitle: "Transfermarkt total squad value (€m)",
    tableRow: (rank: number, pts: number, p: number) => `Table ${rank}. (${pts} pts, ${p} played)`,
    strength: "Blended strength",
    strengthRank: "Strength rank",
    totalWith: (n: number) => `Total difficulty (${n} matches)`,
    perMatch: "Per match",
    rank: "Rank / 18 (1 = easiest)",
    week: (n: number) => `MW ${n}`,
    windowHint:
      "The strip shows the horizon window from the selected matchweek; the list below has all 34 matches, played ones with the score.",
    weekTitle: (n: number, opp: string, ha: string, band: string) =>
      `Matchweek ${n}: ${opp} (${ha}) — ${band}`,
    home: "home",
    away: "away",
    allFixtures: "All 34 matches",
  },
  fixture: {
    strengthBadge: (value: string) => `Str ${value}`,
    strengthTitle: "Opponent's blended strength (0-100)",
    homeLabel: "H",
    awayLabel: "A",
    homeTitle: "Home",
    awayTitle: "Away",
    tbd: "time TBC",
  },
  table: {
    heading: "All teams under the selected model",
    sortLabel: "Sort",
    sort: {
      total: "Total difficulty",
      strength: "Strength",
      last: "Last season",
      name: "Name",
    },
    columns: {
      rank: "#",
      rankTitle: "Difficulty rank (1 = easiest fixtures)",
      team: "Team",
      weeks: "Matchweeks",
      strength: "Str",
      strengthTitle: "Blended strength at the selected weights",
      total: "Total",
    },
    window: (from: number, to: number) =>
      from === to ? `Matchweek ${from}` : `Matchweeks ${from}-${to}`,
    note: "The # column is always the difficulty rank (1 = easiest fixtures), whatever the sort. Str: blended strength at the selected weights (0-100). Tap a row to select that team. The coloured squares are the matchweeks in the horizon window.",
  },
  standings: {
    heading: "Standings (from matches played)",
    columns: {
      rank: "#",
      team: "Team",
      p: "P",
      w: "W",
      d: "D",
      l: "L",
      gd: "GD",
      pts: "Pts",
    },
    note: "Computed from the scores on the TFF fixture page; ordered by points, goal difference, goals scored. The “this season” strength source is the points per match here.",
  },
  bands: {
    vEasy: "Very easy",
    easy: "Easy",
    mid: "Medium",
    hard: "Hard",
    vHard: "Very hard",
    heading: "Colour scale",
  },
  positions: {
    GK: "Goalkeeper",
    DEF: "Defender",
    MID: "Midfielder",
    FWD: "Forward",
  },
  positionsShort: {
    GK: "GK",
    DEF: "DEF",
    MID: "MID",
    FWD: "FWD",
  },
  status: {
    I: "injured",
    D: "doubtful",
    S: "suspended",
  },
  fantasy: {
    heading: "Squad and fantasy prices",
    summary: (team: string, count: number) => `${team} · ${count} players`,
    note: (source: string, budget: string) =>
      `Source: ${source}. Budget ${budget}, at most three players per club.`,
    noPrice: "no price",
  },
  pickWeights: {
    heading: "Weights",
    note: "Score = (model × weight + ownership × weight + past points × weight) × minutes multiplier. Each metric is mapped onto 0-100 across the whole pool; only the ratio of the weights matters, not their size. Fixtures are not a separate slider: the difficulty model already feeds the model signal, and which weeks count comes from the matchweek picker above.",
    reset: "Default weights",
    invert: "Favour low-ownership players",
    invertNote: "When on, ownership flips: players the crowd has not bought rise instead.",
    signals: {
      model: {
        label: "Model: expected points if he plays",
        note: "How many points to expect from the selected weeks if the player is on the pitch for 90 minutes. Fixture difficulty, home or away, position and the player own goal, assist, card and bonus rates are all inside it.",
      },
      sel: {
        label: "Ownership",
        note: "How many managers own the player, on a log scale. The crowd knowledge, and an indirect signal that he plays.",
      },
      points: {
        label: "Past points",
        note: "The game season total per 90 minutes, shrunk when the minutes are few. It partly overlaps with the model rates, hence the zero default.",
      },
    },
    minutes: {
      label: "Weight of start probability",
      note: "The score is scaled by a minutes multiplier. 1 = full effect (a player who will not play drops to 0.15 of his score), 0 = minutes ignored. The probability comes from recent starts, minutes, predicted lineups and the injury list.",
    },
  },
  picks: {
    heading: "Who to buy? Expected points ranking",
    note: "The ranking is a weighted average of three signals, scaled by a minutes multiplier. The model signal is the expected value of the TFF scoring table over the fixtures worked out in the step above: minutes points, goals and assists (the player's rate × the team's expected goals), clean sheet (Poisson), goals conceded, saves, cards and bonus. A player's goal and assist rate blends the raw counts with expected production (xG/xA): the weight was measured, and expected production predicts the coming week better. Counts come from the game's official data and expected production from match data, pulled towards the positional average when minutes are few. Price does not enter the ranking, the budget is a hard limit in the squad builder. Injured and suspended players are left out, doubtful ones flagged. Not a precise forecast, an expectation on one scale.",
    positionLabel: "Position",
    all: "All",
    floor: "Price floor",
    budget: "Price ceiling",
    columns: {
      rank: "#",
      player: "Player",
      price: "Price",
      xp: "xP",
      xpTitle: "Expected points per matchweek: start probability included, independent of the weights",
      score: "Score",
      scoreTitle: "Weighted signal total × minutes multiplier (0-100)",
      start: "Start",
      ppm: "PPM",
      ppmTitle: "The game's own figure: points per match",
      per90: "pts/90",
      per90Title: "Actual fantasy points per 90 from recent matches (shrunk for few minutes)",
    },
    official: (pts: number, mins: number, form: string, sel: string) =>
      `Game data: ${pts} points, ${mins} minutes, form ${form}, selected by ${sel}`,
    news: (text: string) => `Game note: ${text}`,
    difficultyTitle: "Difficulty per match over the selected weeks",
    empty: "No players left under these filters; raise the price ceiling.",
    start: (pct: string) => `${pct} to start`,
    startTitle: (starts: number, matches: number, minutes: number) =>
      `Started ${starts} of the last ${matches} matches, ${minutes} min per match`,
    startUnknown: "No recent lineup data; treated as unlikely to start",
    predictedIn: (listed: number, sources: number) =>
      `Predicted XI: in ${listed} of ${sources} sources`,
    confirmedStart: "Confirmed lineup: starting",
    confirmedOut: "Confirmed lineup: not starting",
    predictedUnavailable: "On the pre-match injury/suspension list",
    source: (source: string, date: string, n: number) =>
      `Recent match data: ${source}, ${date}, last ${n} matches per club.`,
    predictedSource: (source: string, date: string, teams: number) =>
      `Predicted XIs: ${source}, ${date}, ${teams} clubs.`,
    missing: "Recent match data not loaded yet; everyone is treated as unlikely.",
    breakdown: {
      appearance: "Minutes",
      goals: "Goals",
      assists: "Assists",
      cleanSheet: "Clean sheet",
      conceded: "Conceded",
      saves: "Saves",
      cards: "Cards",
      bonus: "Bonus",
      total: "Total",
      lambda: (forUs: string, against: string, cs: string) =>
        `Expected goals for ${forUs}, against ${against}, clean sheet ${cs}%`,
    },
    weekXp: (md: number, opp: string, ha: string, xp: string) =>
      `MW ${md} ${opp} (${ha}): ${xp}`,
    noFixture: (md: number) => `MW ${md}: no match`,
    per90: (value: string) => `${value} pts/90`,
    per90Title: (pts: number, mins: number, matches: number) =>
      `${pts} fantasy points in ${mins} minutes over the last ${matches} matches`,
    topN: (n: number) => `top ${n}`,
  },
  squad: {
    heading: "Squad of the week: XI + 4 subs + captain",
    headingShort: "Squad of the week",
    note: (budget: string, perClub: number, formation: string) =>
      `${budget} budget, at most ${perClub} players per club, a ${formation} squad; the XI needs 1 keeper, at least 3 defenders and 1 forward (3-5-2, 3-4-3, 4-4-2, 4-3-3, 4-5-1, 5-4-1, 5-3-2, 5-2-3). Objective: the XI score + the captain's score once more + a small share of the bench; the score comes from the weights above. The money goes to the XI, the bench is filled from the cheapest. Transfers are unlimited, so the squad can be rebuilt every week.`,
    noPrices:
      "No price data: player prices come from the game's API, which needs a login. Sign in once with `node scripts/chrome-login.mjs`, then run `node scripts/fetch-game.mjs`; until then only the expected-points ranking works.",
    errors: {
      "no-prices": "No price data.",
      "locked-position": "Pinned players exceed the XI position limits (1 keeper, at most 5 defenders, 5 midfielders, 3 forwards).",
      "locked-club": "At most three players from one club can be pinned.",
      "locked-budget": "The pinned players alone exceed the budget.",
      infeasible: "No squad satisfies these constraints; review the pinned players or the budget.",
    },
    failed: "No squad satisfies these constraints.",
    search: "Pin or bar a player, or bar a whole club",
    searchPlaceholder: "Search a player or club",
    pin: "Pin",
    ban: "Bar",
    banClub: "Bar club",
    clubPlayers: (n: number) => `${n} players`,
    lockedTitle: "Must play:",
    excludedTitle: "Never pick:",
    excludedClubsTitle: "Clubs barred:",
    clear: "Clear constraints",
    removeChip: "Remove from the list",
    benchWeight: {
      label: "Bench weight",
      note: "Bench points only count through auto-substitution; this is their share in the objective. 0 = cheapest bench, 0.5 = take the bench seriously (for the Bench Boost card).",
    },
    xiScore: "XI score (captain included)",
    benchScore: "Bench score",
    xiXp: (value: string) => `XI expected points ${value} (captain included).`,
    formation: (f: string) => `Formation ${f}`,
    captain: "Captain",
    vice: "Vice-captain",
    captainShort: "C",
    viceShort: "V",
    spent: (spent: string, left: string) => `Spent ${spent}, ${left} left.`,
    xiSpend: "XI",
    benchSpend: "Bench",
    onlyOne: "Only one squad reaches this score.",
    manyOptions: (count: number, capped: string, index: number) =>
      `${count}${capped} squads come close to this score; showing number ${index}.`,
    another: "Show another squad",
    listOpen: "List the options",
    listClose: "Hide the options",
    clubs: (list: string) => `Clubs: ${list}.`,
    pitch: "Squad on the pitch",
    pitchNote:
      "Each card shows price (M TL) and expected points; yellow C is the captain, green V the vice-captain; a red frame marks a pinned player, ? a doubtful one. Hover a card for details.",
    bench: "Bench (auto-substitution order)",
    benchNote:
      "If an XI player does not play, the game brings in the next bench player; a keeper is only replaced by a keeper. Order: keeper, then outfield players by expected points.",
  },
  schedule: {
    heading: (n: number) => `Matchweek ${n} schedule`,
    note: "From the TFF fixture page; kick-off times can move for broadcast reasons. A postponed match counts in the week it is played.",
    result: "result",
  },
  footer: {
    how: "How is it calculated?",
    howText:
      "Team strength: the weighted average of your chosen sources (Opta, squad value, last season's finish, this season's table), each spread over 0-100 within the 18 teams. Fixture difficulty is 1.0-5.0 per match. Expected points: from the same strength table, both teams' expected goals (league average × e^(0.8 × strength gap/100), home advantage included), hence clean-sheet odds and goals conceded; the player's goal/assist/card/bonus rates from recent matches, pulled towards a positional prior when the sample is small; start probability and minutes from recent lineups. The squad builder picks the XI by dynamic programming and the bench from the cheapest, then improves the objective, captain included, with swaps.",
    rules: "TFF Fantezi Lig rules:",
    rulesText:
      "100 M TL budget, 15 players (2 GK, 5 DEF, 5 MID, 3 FWD), at most 3 from one club. XI: 1 keeper, at least 3 defenders and 1 forward. Captain ×2. Unlimited transfers. The squad locks one hour before the week's first match. Scoring: up to 60 min 1, more 2; goal GK 10 / DEF 6 / MID 5 / FWD 4; assist 3; clean sheet GK-DEF 4, MID 1 (the rules page says 60+ min, but the game's own counts require the full match, measured); every 3 saves 1 (counted within each match, not across the season, measured); penalty save 5, miss -2; every 2 goals conceded GK-DEF -1 (only goals conceded while on the pitch); yellow -1, red -3, own goal -2; the match's best three 3/2/1 bonus. Manager cards (Triple, Quadruple, Bench Boost, Attack, Unlimited Budget) are not modelled.",
    sources: "Sources:",
    sourcesText: (fixtures: string) => `Fixtures and scores ${fixtures}`,
    disclaimer:
      "An unofficial fan-made tool, not affiliated with or endorsed by the TFF, TFF Fantezi Lig or any club. Club crests and names are trademarks of their respective owners and are used for identification only. No ads, no fees.",
  },
};

export const STRINGS: Record<Lang, Strings> = { tr, en };

export function isLang(value: string | null): value is Lang {
  return value === "tr" || value === "en";
}

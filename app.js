/* ============================================================
   JARVIS – kişisel asistan
   Android'de Capacitor eklentileri, tarayıcıda yedek (fallback) kullanır.
   ============================================================ */
(function () {
  "use strict";

  var CFG = window.JARVIS_CONFIG || {};
  var CAP = window.Capacitor || {};
  var PL = CAP.Plugins || {};
  var isNative = !!(CAP.isNativePlatform && CAP.isNativePlatform());
  var TTS = PL.TextToSpeech;
  var SR = PL.SpeechRecognition;
  var Launcher = PL.AppLauncher;

  var $ = function (id) { return document.getElementById(id); };
  var tl = function (s) { return String(s).toLocaleLowerCase("tr"); };

  // ---------- Kayıtlı ayarlar ----------
  var DEFAULTS = {
    name: CFG.DEFAULT_NAME || "JARVIS",
    call: "efendim",
    gender: "male",
    voiceName: "",
    rate: 1.0,
    pitchMale: 0.75,
    pitchFemale: 1.15,
    speak: true,
    greet: true,
    accent: "#19d3ff",
    bg: "#020a14",
    grid: true,
    spin: 1,
    photo: "",
    aiKey: "",
    user: null
  };
  var S = {};
  function loadSettings() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("jarvis_settings") || "{}"); } catch (e) {}
    S = Object.assign({}, DEFAULTS, saved);
  }
  function saveSettings() {
    try { localStorage.setItem("jarvis_settings", JSON.stringify(S)); } catch (e) {}
  }
  loadSettings();

  // ---------- Tema ----------
  var ACCENTS = [
    ["#19d3ff", "Mavi"], ["#ff4d4d", "Kırmızı"], ["#39ff88", "Yeşil"],
    ["#b77bff", "Mor"], ["#ffc83d", "Altın"], ["#ff8a2b", "Turuncu"], ["#ff5fc8", "Pembe"], ["#ffffff", "Beyaz"]
  ];
  var BGS = [
    ["#020a14", "Lacivert"], ["#000000", "Siyah"], ["#0b1a0f", "Yeşil"],
    ["#150a1f", "Mor"], ["#1a0a0a", "Kırmızı"], ["#10151c", "Gri"]
  ];
  function applyTheme() {
    var r = document.documentElement.style;
    r.setProperty("--accent", S.accent);
    r.setProperty("--bg", S.bg);
    r.setProperty("--spin", S.spin <= 0 ? 0.0001 : S.spin);
    document.body.classList.toggle("grid", !!S.grid);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", S.bg);
  }
  function applyAvatar() {
    var photo = S.photo || (S.user && S.user.picture) || "";
    ["avatar", "avatarSmall"].forEach(function (id) {
      var el = $(id);
      if (photo) { el.src = photo; el.style.display = ""; } else { el.removeAttribute("src"); el.style.display = "none"; }
    });
    $("avatarLetter").textContent = (S.name || "J").charAt(0).toUpperCase();
    $("avatarLetter").style.display = photo ? "none" : "";
    $("meName").textContent = (S.user && S.user.name) || "Misafir";
    document.title = S.name;
  }

  // ---------- Günlük (log) ----------
  var logEl = $("log");
  function addLog(who, text) {
    var p = document.createElement("p");
    p.className = who === "you" ? "you" : "ai";
    var b = document.createElement("b");
    b.textContent = (who === "you" ? "SEN" : S.name.toUpperCase()) + ": ";
    p.appendChild(b);
    p.appendChild(document.createTextNode(text));
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
    return p;
  }

  // ---------- Durum göstergesi ----------
  function setState(txt, cls) {
    $("state").textContent = txt;
    var o = $("orb");
    o.classList.remove("listening", "speaking");
    if (cls) o.classList.add(cls);
    $("bars").classList.toggle("on", cls === "speaking");
  }

  // ---------- SES (konuşma) ----------
  var voices = [];          // {name, lang, index}
  async function loadVoices() {
    try {
      if (TTS && TTS.getSupportedVoices) {
        var res = await TTS.getSupportedVoices();
        voices = (res.voices || []).map(function (v, i) { return { name: v.name || v.voiceURI, lang: v.lang || "", index: i }; });
      } else if (window.speechSynthesis) {
        voices = speechSynthesis.getVoices().map(function (v, i) { return { name: v.name, lang: v.lang, index: i }; });
      }
    } catch (e) { voices = []; }
    var tr = voices.filter(function (v) { return /^tr/i.test(v.lang.replace("_", "-")); });
    if (tr.length) voices = tr.concat(voices.filter(function (v) { return tr.indexOf(v) < 0; }));
    fillVoiceSelect();
  }
  function fillVoiceSelect() {
    var sel = $("voiceSelect");
    sel.innerHTML = "";
    var auto = document.createElement("option");
    auto.value = ""; auto.textContent = "Otomatik (Türkçe)";
    sel.appendChild(auto);
    voices.forEach(function (v, i) {
      var o = document.createElement("option");
      o.value = v.name;
      o.textContent = "Ses " + (i + 1) + " – " + v.name + " (" + v.lang + ")";
      sel.appendChild(o);
    });
    sel.value = S.voiceName || "";
  }
  function pickVoice() {
    if (!voices.length) return null;
    if (S.voiceName) {
      for (var i = 0; i < voices.length; i++) if (voices[i].name === S.voiceName) return voices[i];
    }
    for (var j = 0; j < voices.length; j++) if (/^tr/i.test(voices[j].lang.replace("_", "-"))) return voices[j];
    return voices[0];
  }
  function currentPitch() { return S.gender === "female" ? S.pitchFemale : S.pitchMale; }

  var speaking = false;
  async function speak(text) {
    if (!S.speak || !text) return;
    stopSpeaking();
    speaking = true;
    setState("KONUŞUYOR", "speaking");
    var v = pickVoice();
    try {
      if (TTS && TTS.speak) {
        var opts = { text: text, lang: "tr-TR", rate: S.rate, pitch: currentPitch(), volume: 1.0, category: "ambient" };
        if (v) opts.voice = v.index;
        await TTS.speak(opts);
      } else if (window.speechSynthesis) {
        await new Promise(function (resolve) {
          var u = new SpeechSynthesisUtterance(text);
          u.lang = "tr-TR"; u.rate = S.rate; u.pitch = currentPitch();
          var all = speechSynthesis.getVoices();
          if (v) { for (var i = 0; i < all.length; i++) if (all[i].name === v.name) u.voice = all[i]; }
          u.onend = u.onerror = resolve;
          speechSynthesis.speak(u);
        });
      }
    } catch (e) { /* sessizce geç */ }
    speaking = false;
    setState("HAZIR");
  }
  function stopSpeaking() {
    try { if (TTS && TTS.stop) TTS.stop(); } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    speaking = false;
  }
  function say(text) { addLog("ai", text); return speak(text); }

  // ---------- MİKROFON ----------
  var listening = false;
  async function toggleMic() {
    if (listening) { stopListening(); return; }
    stopSpeaking();
    try {
      if (SR && SR.available) {
        var av = await SR.available();
        if (!av.available) { addLog("ai", "Bu telefonda ses tanıma servisi bulunamadı. Google uygulamasını güncelle."); return; }
        var perm = await SR.requestPermissions();
        if (perm.speechRecognition && perm.speechRecognition !== "granted") { addLog("ai", "Mikrofon izni verilmedi. Ayarlardan izin ver."); return; }
        listening = true; $("micBtn").classList.add("on"); setState("DİNLİYORUM", "listening");
        var res = await SR.start({ language: "tr-TR", maxResults: 1, prompt: "Dinliyorum", partialResults: false, popup: false });
        stopListening(true);
        var heard = res && res.matches && res.matches[0];
        if (heard) handle(heard); else setState("HAZIR");
      } else if (window.webkitSpeechRecognition || window.SpeechRecognition) {
        var R = window.SpeechRecognition || window.webkitSpeechRecognition;
        var rec = new R(); rec.lang = "tr-TR"; rec.interimResults = false;
        listening = true; $("micBtn").classList.add("on"); setState("DİNLİYORUM", "listening");
        rec.onresult = function (e) { handle(e.results[0][0].transcript); };
        rec.onend = function () { stopListening(true); };
        rec.onerror = function () { stopListening(true); };
        rec.start();
        window.__rec = rec;
      } else {
        addLog("ai", "Bu cihazda ses tanıma yok. Komutu yazabilirsin.");
      }
    } catch (e) {
      stopListening(true);
      addLog("ai", "Mikrofon hatası: " + (e && e.message ? e.message : e));
    }
  }
  function stopListening(silent) {
    listening = false;
    $("micBtn").classList.remove("on");
    try { if (SR && SR.stop && !silent) SR.stop(); } catch (e) {}
    try { if (window.__rec && !silent) window.__rec.stop(); } catch (e) {}
    if (!speaking) setState("HAZIR");
  }

  // ---------- Yardımcılar ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  var DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  var MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function tick() {
    var d = new Date();
    $("time").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    $("date").textContent = d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + " · " + DAYS[d.getDay()];
  }
  function greetWord() {
    var h = new Date().getHours();
    if (h < 5) return "İyi geceler";
    if (h < 12) return "Günaydın";
    if (h < 18) return "Tünaydın";
    return "İyi akşamlar";
  }
  function numToWords(n) { return String(n); }

  async function openUrl(url) {
    try {
      if (Launcher && Launcher.openUrl) { await Launcher.openUrl({ url: url }); return true; }
    } catch (e) { return false; }
    try { window.open(url, "_blank"); return true; } catch (e) { return false; }
  }

  // Uygulama listesi: [anahtar kelimeler, görünen ad, uygulama şeması, yedek web adresi]
  var APPS = [
    [["whatsapp", "vatsap", "votsap"], "WhatsApp", "whatsapp://", "https://web.whatsapp.com"],
    [["youtube", "yutup"], "YouTube", "vnd.youtube://", "https://m.youtube.com"],
    [["instagram", "insta"], "Instagram", "instagram://app", "https://instagram.com"],
    [["spotify"], "Spotify", "spotify://", "https://open.spotify.com"],
    [["telegram"], "Telegram", "tg://", "https://web.telegram.org"],
    [["twitter", "x uygulaması"], "X", "twitter://", "https://x.com"],
    [["facebook", "feysbuk"], "Facebook", "fb://", "https://facebook.com"],
    [["tiktok", "tik tok"], "TikTok", "snssdk1233://", "https://tiktok.com"],
    [["netflix"], "Netflix", "nflx://", "https://netflix.com"],
    [["gmail", "e-posta", "eposta", "mail"], "Gmail", "mailto:", "https://mail.google.com"],
    [["harita", "haritalar", "google maps", "yol tarifi"], "Haritalar", "geo:0,0", "https://maps.google.com"],
    [["google"], "Google", "https://www.google.com", "https://www.google.com"],
    [["chrome", "tarayıcı"], "Tarayıcı", "https://www.google.com", "https://www.google.com"],
    [["play store", "google play", "mağaza"], "Play Store", "market://", "https://play.google.com"],
    [["telefon", "arama"], "Telefon", "tel:", "tel:"],
    [["mesaj", "sms"], "Mesajlar", "sms:", "sms:"],
    [["trendyol"], "Trendyol", "trendyol://", "https://trendyol.com"],
    [["hepsiburada"], "Hepsiburada", "hepsiburada://", "https://hepsiburada.com"],
    [["twitch"], "Twitch", "twitch://", "https://twitch.tv"],
    [["discord"], "Discord", "discord://", "https://discord.com/app"],
    [["snapchat", "snap"], "Snapchat", "snapchat://", "https://snapchat.com"],
    [["pinterest"], "Pinterest", "pinterest://", "https://pinterest.com"],
    [["linkedin"], "LinkedIn", "linkedin://", "https://linkedin.com"]
  ];
  function findApp(t) {
    for (var i = 0; i < APPS.length; i++) {
      for (var j = 0; j < APPS[i][0].length; j++) {
        if (t.indexOf(APPS[i][0][j]) >= 0) return APPS[i];
      }
    }
    return null;
  }
  async function launchApp(app) {
    await say(app[1] + " açılıyor.");
    var ok = await openUrl(app[2]);
    if (!ok && app[3]) ok = await openUrl(app[3]);
    if (!ok) addLog("ai", "Açamadım, uygulama yüklü olmayabilir.");
  }

  // ---------- Hava durumu ----------
  var WCODE = {
    0: "açık", 1: "çoğunlukla açık", 2: "parçalı bulutlu", 3: "kapalı", 45: "sisli", 48: "kırağılı sis",
    51: "hafif çisenti", 53: "çisenti", 55: "yoğun çisenti", 61: "hafif yağmurlu", 63: "yağmurlu", 65: "şiddetli yağmurlu",
    71: "hafif karlı", 73: "karlı", 75: "yoğun karlı", 80: "sağanak yağışlı", 81: "sağanak yağışlı", 82: "şiddetli sağanak",
    95: "gök gürültülü fırtınalı", 96: "dolu yağışlı", 99: "şiddetli dolu"
  };
  function getPos() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error("no geo"));
      navigator.geolocation.getCurrentPosition(function (p) { resolve({ lat: p.coords.latitude, lon: p.coords.longitude }); },
        reject, { timeout: 8000, maximumAge: 600000 });
    });
  }
  async function weather(city) {
    var lat, lon, place = "";
    try {
      if (city) {
        var g = await (await fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(city) + "&count=1&language=tr")).json();
        if (!g.results || !g.results.length) { return say(city + " diye bir yer bulamadım."); }
        lat = g.results[0].latitude; lon = g.results[0].longitude; place = g.results[0].name;
      } else {
        try { var p = await getPos(); lat = p.lat; lon = p.lon; place = "bulunduğun yerde"; }
        catch (e) { lat = 41.0082; lon = 28.9784; place = "İstanbul'da"; addLog("ai", "Konum alamadım, İstanbul'u gösteriyorum."); }
      }
      var w = await (await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto")).json();
      var c = w.current;
      var desc = WCODE[c.weather_code] || "değişken";
      var where = city ? (place + "'da") : place;
      return say(where + " hava " + desc + ", sıcaklık " + Math.round(c.temperature_2m) + " derece, hissedilen " +
        Math.round(c.apparent_temperature) + " derece, rüzgar saatte " + Math.round(c.wind_speed_10m) + " kilometre.");
    } catch (e) {
      return say("Hava durumunu alamadım. İnternet bağlantını kontrol et.");
    }
  }

  // ---------- Haberler ----------
  async function news() {
    try {
      var txt = await (await fetch(CFG.NEWS_RSS || "https://www.trthaber.com/sondakika.rss")).text();
      var doc = new DOMParser().parseFromString(txt, "text/xml");
      var items = Array.prototype.slice.call(doc.querySelectorAll("item")).slice(0, 5);
      if (!items.length) throw new Error("boş");
      var titles = items.map(function (it) { return it.querySelector("title").textContent.trim(); });
      addLog("ai", "Son dakika:\n" + titles.map(function (t, i) { return (i + 1) + ". " + t; }).join("\n"));
      await speak("Son dakika haberleri. " + titles.join(". "));
    } catch (e) {
      await say("Haberleri alamadım. İnternet bağlantını kontrol et.");
    }
  }

  // ---------- Hesap makinesi ----------
  function calc(t) {
    var s = t.replace(/,/g, ".")
      .replace(/çarpı|kere|çarp/g, "*").replace(/bölü|böl/g, "/")
      .replace(/artı|topla/g, "+").replace(/eksi|çıkar/g, "-")
      .replace(/ x /g, "*").replace(/üzeri/g, "**");
    s = s.replace(/[^0-9+\-*/().\s]/g, " ").replace(/\s+/g, " ").trim();
    if (!/\d/.test(s) || !/[+\-*/]/.test(s)) return null;
    if (!/^[0-9+\-*/().\s]+$/.test(s)) return null;
    try {
      var r = Function('"use strict";return (' + s + ")")();
      if (typeof r !== "number" || !isFinite(r)) return null;
      return Math.round(r * 1e6) / 1e6;
    } catch (e) { return null; }
  }

  // ---------- Zamanlayıcı ----------
  function parseDuration(t) {
    var total = 0, m;
    var re = /(\d+)\s*(saat|dakika|dk|saniye|sn)/g;
    while ((m = re.exec(t))) {
      var n = parseInt(m[1], 10), u = m[2];
      total += u === "saat" ? n * 3600 : (u === "dakika" || u === "dk") ? n * 60 : n;
    }
    return total;
  }
  var timers = [];
  function startTimer(sec, label) {
    var id = setTimeout(function () {
      var msg = (label || "Zamanlayıcı") + " bitti, " + S.call + "!";
      addLog("ai", "⏰ " + msg);
      speak(msg);
      try { if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
    }, sec * 1000);
    timers.push(id);
  }
  function fmtDur(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, out = [];
    if (h) out.push(h + " saat"); if (m) out.push(m + " dakika"); if (s) out.push(s + " saniye");
    return out.join(" ");
  }

  // ---------- Notlar ----------
  function getNotes() { try { return JSON.parse(localStorage.getItem("jarvis_notes") || "[]"); } catch (e) { return []; } }
  function setNotes(n) { try { localStorage.setItem("jarvis_notes", JSON.stringify(n)); } catch (e) {} renderNotes(); }
  function renderNotes() {
    var n = getNotes();
    $("notesList").textContent = n.length ? n.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") : "Henüz not yok.";
    $("notesList").style.whiteSpace = "pre-wrap";
  }

  // ---------- Şakalar ----------
  var JOKES = [
    "Temel ile Dursun uçakla gidiyormuş. Temel demiş ki: Dursun, yere bak, insanlar karınca gibi görünüyor. Dursun: Temel, onlar zaten karınca.",
    "Bilgisayar neden soğuk almaz? Çünkü pencereleri hep açıktır.",
    "Doktor hastaya demiş ki: Sigarayı bırakmazsan ömrün uzun olmaz. Hasta: Doktor bey, ben de zaten kısa süren işleri severim.",
    "Yapay zeka bara girmiş. Barmen sormuş: Ne içersin? Yapay zeka: Sizin için en uygun olanı hesaplıyorum… Barmen: Yani su.",
    "Bir matematikçi neden orman yürüyüşüne çıkmaz? Çünkü kökleri hep karelerin içinde arar."
  ];

  // ---------- Renk komutları ----------
  var COLOR_WORDS = { mavi: "#19d3ff", kırmızı: "#ff4d4d", yeşil: "#39ff88", mor: "#b77bff", altın: "#ffc83d", sarı: "#ffc83d", turuncu: "#ff8a2b", pembe: "#ff5fc8", beyaz: "#ffffff" };
  var BG_WORDS = { siyah: "#000000", lacivert: "#020a14", gri: "#10151c", mor: "#150a1f", yeşil: "#0b1a0f", kırmızı: "#1a0a0a" };

  // ---------- YAPAY ZEKA (isteğe bağlı) ----------
  async function askAI(q) {
    if (!S.aiKey) return null;
    try {
      var r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": S.aiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-haiku-5-5",
          max_tokens: 400,
          system: "Sen " + S.name + " adında, Türkçe konuşan sesli bir kişisel asistansın. Kullanıcıya '" + S.call + "' diye hitap et. Cevapların kısa (en fazla 3 cümle), doğal ve konuşma diline uygun olsun. Emoji ve madde işareti kullanma.",
          messages: [{ role: "user", content: q }]
        })
      });
      var j = await r.json();
      if (j && j.content && j.content[0] && j.content[0].text) return j.content[0].text;
      return null;
    } catch (e) { return null; }
  }

  // ============================================================
  //  KOMUT İŞLEME
  // ============================================================
  async function handle(raw) {
    var text = String(raw || "").trim();
    if (!text) return;
    addLog("you", text);
    var t = tl(text).replace(/[?!.]+$/g, "");
    var call = S.call || "efendim";

    // kendine ad ile hitap ediyorsa başındaki adı at
    var nm = tl(S.name);
    if (t.indexOf(nm) === 0) t = t.slice(nm.length).replace(/^[\s,]+/, "");

    // --- susturma ---
    if (/^(sus|sessiz ol|sustur|dur|yeter)$/.test(t)) { stopSpeaking(); setState("HAZIR"); return; }

    // --- selam ---
    if (/^(merhaba|selam|hey|hi|günaydın|iyi akşamlar|iyi geceler|naber|nasılsın)/.test(t)) {
      return say(greetWord() + " " + call + ". İyiyim, teşekkür ederim. Size nasıl yardımcı olabilirim?");
    }
    if (/teşekkür|sağ ol|eyvallah/.test(t)) return say("Rica ederim " + call + ".");
    if (/(kimsin|adın ne|ismin ne)/.test(t)) return say("Ben " + S.name + ", kişisel yapay zeka asistanınızım " + call + ".");

    // --- saat / tarih ---
    if (/(saat kaç|saati söyle|şu an saat|saat ne)/.test(t) || t === "saat") {
      var d = new Date();
      return say("Saat " + pad(d.getHours()) + " " + pad(d.getMinutes()) + ", " + call + ".");
    }
    if (/(tarih|bugün günlerden|hangi gün|bugün ayın kaçı|günlerden ne)/.test(t)) {
      var dd = new Date();
      return say("Bugün " + dd.getDate() + " " + MONTHS[dd.getMonth()] + " " + dd.getFullYear() + " " + DAYS[dd.getDay()] + ".");
    }

    // --- ses ayarı ---
    if (/(erkek ses)/.test(t)) { S.gender = "male"; saveSettings(); syncSettingsUI(); return say("Erkek sesine geçtim."); }
    if (/(kız ses|kadın ses|bayan ses)/.test(t)) { S.gender = "female"; saveSettings(); syncSettingsUI(); return say("Kız sesine geçtim."); }
    if (/(daha hızlı)/.test(t)) { S.rate = Math.min(1.4, S.rate + 0.15); saveSettings(); syncSettingsUI(); return say("Hızlandırdım."); }
    if (/(daha yavaş)/.test(t)) { S.rate = Math.max(0.6, S.rate - 0.15); saveSettings(); syncSettingsUI(); return say("Yavaşlattım."); }

    // --- renk / arka plan ---
    var mBg = t.match(/arka plan(?:ı)?\s+(\S+)/);
    if (mBg) {
      var key = mBg[1].replace(/(yap|olsun|rengi)$/, "");
      for (var k in BG_WORDS) if (key.indexOf(k) === 0) { S.bg = BG_WORDS[k]; saveSettings(); applyTheme(); syncSettingsUI(); return say("Arka planı " + k + " yaptım."); }
    }
    if (/renk/.test(t) || /tema/.test(t)) {
      for (var c in COLOR_WORDS) if (t.indexOf(c) >= 0) { S.accent = COLOR_WORDS[c]; saveSettings(); applyTheme(); syncSettingsUI(); return say("Rengi " + c + " yaptım."); }
    }

    // --- zamanlayıcı / hatırlatma ---
    if (/(zamanlayıcı|geri sayım|hatırlat|alarm kur|sonra uyar|sonra söyle)/.test(t)) {
      var sec = parseDuration(t);
      if (sec > 0) {
        startTimer(sec, /hatırlat/.test(t) ? "Hatırlatma zamanı" : "Zamanlayıcı");
        return say(fmtDur(sec) + " sonrasına kuruldu. Uygulama açık kaldığı sürece haber veririm.");
      }
      return say("Ne kadar süre? Örneğin: 5 dakika zamanlayıcı kur.");
    }

    // --- notlar ---
    var mNote = text.match(/^(?:not al|not et|not ekle|not)\s*[:,-]?\s*(.+)$/i);
    if (mNote) { var n = getNotes(); n.push(mNote[1]); setNotes(n); return say("Notunuzu aldım."); }
    if (/(notlarım|notları oku|notlarımı oku)/.test(t)) {
      var nn = getNotes();
      return say(nn.length ? "Notlarınız: " + nn.join(". ") : "Henüz notunuz yok.");
    }
    if (/(notları sil|notlarımı sil)/.test(t)) { setNotes([]); return say("Notları sildim."); }

    // --- hava ---
    if (/hava/.test(t) && /(durum|nasıl|kaç derece|sıcak|soğuk|yağmur|ne)/.test(t) || t === "hava") {
      var mc = t.match(/([a-zçğıöşü]+)(?:'?(?:da|de|ta|te|daki|deki))\s+hava/);
      return weather(mc ? mc[1] : "");
    }

    // --- haber ---
    if (/(haber|son dakika|gündem)/.test(t)) return news();

    // --- şaka ---
    if (/(şaka|fıkra|güldür)/.test(t)) return say(JOKES[Math.floor(Math.random() * JOKES.length)]);

    // --- arama / yönlendirme ---
    var mYt = t.match(/(?:youtube(?:'?(?:da|de|ta|te))?|yutup(?:'?(?:da|de))?)\s+(.+?)\s+(?:ara|aç|izle|çal|bak)$/) || t.match(/^(.+?)\s+(?:izle|dinle|çal)$/);
    if (mYt) {
      await say("YouTube'da " + mYt[1] + " arıyorum.");
      return openUrl("https://www.youtube.com/results?search_query=" + encodeURIComponent(mYt[1]));
    }
    var mG = t.match(/^(?:google'?(?:da|de|ta|te)?\s+)?(.+?)\s+(?:ara|araştır)$/) || t.match(/^google'?(?:da|de)?\s+(.+)$/);
    if (mG && !/^\d/.test(mG[1])) {
      await say(mG[1] + " için arıyorum.");
      return openUrl("https://www.google.com/search?q=" + encodeURIComponent(mG[1]));
    }
    var mMap = t.match(/^(.+?)\s+(?:nerede|haritada|yol tarifi|nasıl gidilir)$/) || t.match(/^(?:haritada)\s+(.+)$/);
    if (mMap) {
      await say(mMap[1] + " için haritayı açıyorum.");
      return openUrl("geo:0,0?q=" + encodeURIComponent(mMap[1]));
    }
    var mCall = t.match(/(?:ara|arama yap)\s*(\+?[\d\s]{7,15})$/) || t.match(/^(\+?[\d\s]{10,15})\s*(?:numarayı|'?yi)?\s*ara$/);
    if (mCall) {
      var num = mCall[1].replace(/\s+/g, "");
      await say(num + " aranıyor.");
      return openUrl("tel:" + num);
    }

    // --- uygulama aç ---
    if (/(aç|başlat|git|çalıştır|gir)$/.test(t) || /^(aç)\s/.test(t) || /(uygulamasını|uygulamayı)/.test(t)) {
      var app = findApp(t);
      if (app) return launchApp(app);
    }
    if (/^(.+?)\s+(aç|başlat)$/.test(t)) {
      var app2 = findApp(t);
      if (app2) return launchApp(app2);
      return say("O uygulamayı tanımıyorum. WhatsApp, YouTube, Instagram, Spotify, Telegram, Netflix gibi uygulamaları açabilirim.");
    }

    // --- yardım ---
    if (/(neler yapabilirsin|yardım|komutlar)/.test(t)) {
      return say("Şunları yapabilirim: saati ve tarihi söylerim. Hava durumu ve son dakika haberleri veririm. WhatsApp, YouTube, Instagram gibi uygulamaları açarım. YouTube'da ya da Google'da arama yaparım. Hesap yaparım, örneğin 25 çarpı 4. Zamanlayıcı kurarım, not alırım, şaka yaparım. Ses, renk ve arka planı değiştiririm. Ayarlardan yapay zeka anahtarı girersen her şeyi sohbet ederek de cevaplarım.");
    }

    // --- hesap ---
    var cr = calc(t);
    if (cr !== null) return say("Sonuç " + cr + ".");

    // --- yapay zeka yedeği ---
    var thinking = addLog("ai", "…");
    setState("DÜŞÜNÜYORUM");
    var ai = await askAI(text);
    if (ai) { thinking.remove(); return say(ai); }
    thinking.remove();
    if (!S.aiKey) {
      return say("Bunu tam anlayamadım " + call + ". Dilersen Google'da arayayım: 've " + text + " ara' diyebilirsin. Ayarlardan yapay zeka anahtarı girersen her soruya cevap veririm.");
    }
    return say("Şu an cevap veremiyorum, internetini veya anahtarını kontrol et.");
  }

  // ============================================================
  //  AYARLAR EKRANI
  // ============================================================
  function buildSwatches(containerId, list, key, customId) {
    var box = $(containerId);
    box.innerHTML = "";
    list.forEach(function (it) {
      var b = document.createElement("button");
      b.style.background = it[0]; b.style.color = it[0]; b.title = it[1];
      b.dataset.v = it[0];
      b.addEventListener("click", function () { S[key] = it[0]; saveSettings(); applyTheme(); syncSettingsUI(); });
      box.appendChild(b);
    });
    $(customId).addEventListener("input", function (e) { S[key] = e.target.value; saveSettings(); applyTheme(); syncSettingsUI(); });
  }
  function syncSettingsUI() {
    $("setName").value = S.name;
    $("setCall").value = S.call;
    $("setRate").value = S.rate;
    $("setPitch").value = currentPitch();
    $("setSpeak").checked = !!S.speak;
    $("setGreet").checked = !!S.greet;
    $("setGrid").checked = !!S.grid;
    $("setSpin").value = S.spin;
    $("accentCustom").value = S.accent.length === 7 ? S.accent : "#19d3ff";
    $("bgCustom").value = S.bg.length === 7 ? S.bg : "#020a14";
    $("voiceSelect").value = S.voiceName || "";
    document.querySelectorAll("#voiceGender button").forEach(function (b) { b.classList.toggle("active", b.dataset.g === S.gender); });
    document.querySelectorAll("#accentSwatches button").forEach(function (b) { b.classList.toggle("active", b.dataset.v === S.accent); });
    document.querySelectorAll("#bgSwatches button").forEach(function (b) { b.classList.toggle("active", b.dataset.v === S.bg); });
    $("accountInfo").textContent = S.user ? (S.user.name + (S.user.email ? " · " + S.user.email : "")) : "Misafir olarak giriş yapıldı.";
    if ($("aiKey")) $("aiKey").value = S.aiKey || "";
  }
  function wireSettings() {
    buildSwatches("accentSwatches", ACCENTS, "accent", "accentCustom");
    buildSwatches("bgSwatches", BGS, "bg", "bgCustom");

    $("settingsBtn").addEventListener("click", function () { $("settings").classList.remove("hidden"); syncSettingsUI(); renderNotes(); });
    $("closeSettings").addEventListener("click", function () { $("settings").classList.add("hidden"); applyAvatar(); });

    $("setName").addEventListener("input", function (e) { S.name = e.target.value || DEFAULTS.name; saveSettings(); applyAvatar(); });
    $("setCall").addEventListener("input", function (e) { S.call = e.target.value || "efendim"; saveSettings(); });
    $("setRate").addEventListener("input", function (e) { S.rate = parseFloat(e.target.value); saveSettings(); });
    $("setPitch").addEventListener("input", function (e) {
      var v = parseFloat(e.target.value);
      if (S.gender === "female") S.pitchFemale = v; else S.pitchMale = v;
      saveSettings();
    });
    $("setSpeak").addEventListener("change", function (e) { S.speak = e.target.checked; saveSettings(); });
    $("setGreet").addEventListener("change", function (e) { S.greet = e.target.checked; saveSettings(); });
    $("setGrid").addEventListener("change", function (e) { S.grid = e.target.checked; saveSettings(); applyTheme(); });
    $("setSpin").addEventListener("input", function (e) { S.spin = parseFloat(e.target.value); saveSettings(); applyTheme(); });
    $("voiceSelect").addEventListener("change", function (e) { S.voiceName = e.target.value; saveSettings(); });
    document.querySelectorAll("#voiceGender button").forEach(function (b) {
      b.addEventListener("click", function () { S.gender = b.dataset.g; saveSettings(); syncSettingsUI(); speak(S.gender === "male" ? "Erkek sesi seçildi." : "Kız sesi seçildi."); });
    });
    $("testVoice").addEventListener("click", function () { speak(greetWord() + " " + S.call + ", ben " + S.name + ". Sesim böyle."); });

    $("pickPhoto").addEventListener("click", function () { $("photoFile").click(); });
    $("photoFile").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var size = 400, cv = document.createElement("canvas"); cv.width = cv.height = size;
        var ctx = cv.getContext("2d"), s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        S.photo = cv.toDataURL("image/jpeg", 0.85); saveSettings(); applyAvatar(); URL.revokeObjectURL(url);
      };
      img.src = url;
    });
    $("clearPhoto").addEventListener("click", function () { S.photo = ""; saveSettings(); applyAvatar(); });
    $("clearNotes").addEventListener("click", function () { setNotes([]); });
    $("logout").addEventListener("click", function () { S.user = null; saveSettings(); stopSpeaking(); location.reload(); });

    // Yapay zeka anahtarı alanı (ayarlara dinamik eklenir)
    var body = document.querySelector("#settings .sheet-body");
    var h = document.createElement("h3"); h.textContent = "Yapay zeka (isteğe bağlı)";
    var lab = document.createElement("label"); lab.textContent = "Anthropic API anahtarı";
    var inp = document.createElement("input"); inp.type = "text"; inp.id = "aiKey"; inp.placeholder = "sk-ant-..."; inp.autocomplete = "off";
    inp.addEventListener("input", function () { S.aiKey = inp.value.trim(); saveSettings(); });
    lab.appendChild(inp);
    var note = document.createElement("div"); note.className = "note";
    note.textContent = "Anahtar girersen anlamadığı her şeyi gerçek yapay zekaya sorar. Anahtar yalnızca bu telefonda saklanır.";
    var acc = document.querySelector("#accountInfo");
    body.insertBefore(h, acc.previousElementSibling);
    body.insertBefore(lab, acc.previousElementSibling);
    body.insertBefore(note, acc.previousElementSibling);
  }

  // ============================================================
  //  GOOGLE İLE GİRİŞ
  // ============================================================
  function parseJwt(token) {
    try {
      var p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return null; }
  }
  function onGoogle(resp) {
    var j = parseJwt(resp.credential);
    if (!j) { $("loginNote").textContent = "Giriş başarısız oldu, tekrar dene."; return; }
    S.user = { name: j.given_name || j.name, email: j.email, picture: j.picture };
    saveSettings();
    enterApp();
  }
  function initLogin() {
    if (S.user) { enterApp(); return; }
    $("guest").addEventListener("click", function () { S.user = null; try { sessionStorage.setItem("guest", "1"); } catch (e) {} enterApp(); });
    if (!CFG.GOOGLE_CLIENT_ID) {
      $("loginNote").textContent = "Google girişi için config.js dosyasına istemci kimliği eklenmemiş. Şimdilik Misafir olarak devam edebilirsin.";
      return;
    }
    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = function () {
      try {
        google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onGoogle });
        google.accounts.id.renderButton($("gbtn"), { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: "tr", width: 260 });
      } catch (e) { $("loginNote").textContent = "Google girişi başlatılamadı: " + e.message; }
    };
    s.onerror = function () { $("loginNote").textContent = "Google'a ulaşılamadı. İnternetini kontrol et."; };
    document.head.appendChild(s);
  }

  // ============================================================
  //  UYGULAMAYA GİRİŞ
  // ============================================================
  var started = false;
  function enterApp() {
    $("login").classList.add("hidden");
    $("main").classList.remove("hidden");
    applyAvatar();
    if (started) return;
    started = true;
    loadVoices();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
    var who = (S.user && S.user.name) ? S.user.name : S.call;
    var d = new Date();
    var hello = greetWord() + " " + who + ". Saat " + pad(d.getHours()) + " " + pad(d.getMinutes()) + ". " + S.name + " hizmetinizde.";
    addLog("ai", hello);
    if (S.greet) setTimeout(function () { speak(hello); }, 700);
  }

  // ============================================================
  //  BAŞLANGIÇ
  // ============================================================
  function init() {
    applyTheme();
    tick(); setInterval(tick, 1000);
    wireSettings();
    syncSettingsUI();
    renderNotes();

    $("micBtn").addEventListener("click", toggleMic);
    $("orb").addEventListener("click", toggleMic);
    function send() { var v = $("cmdInput").value; $("cmdInput").value = ""; handle(v); }
    $("sendBtn").addEventListener("click", send);
    $("cmdInput").addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
    document.querySelectorAll("#quick button").forEach(function (b) {
      b.addEventListener("click", function () { handle(b.dataset.cmd); });
    });

    initLogin();
  }
  document.addEventListener("DOMContentLoaded", init);
})();

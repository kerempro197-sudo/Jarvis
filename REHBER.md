# JARVIS – Android'e kurulum rehberi

Telefondan, ücretsiz, yaklaşık 15 dakika.

## 1) GitHub hesabı
1. Telefonda Chrome'dan **github.com** adresine git, **Sign up** ile hesap aç (e-posta + şifre).

## 2) Depo (repository) oluştur
1. Sağ üstte **+** → **New repository**.
2. İsim: `jarvis`. **Public** seç. **Create repository**'ye bas.

## 3) Dosyaları yükle
1. Bu ZIP'i telefonda aç ve içindeki dosyaları çıkar (Dosyalarım → ZIP'e uzun bas → Çıkar).
2. GitHub'da deponda **uploading an existing file** (veya Add file → Upload files) yaz/seç.
3. Dosyaların **hepsini birden** seç: `index.html`, `style.css`, `app.js`, `config.js`, `package.json`, `capacitor.config.json`, `build-apk.yml`.
4. Alttan **Commit changes**'e bas.

## 4) Derleme dosyasını doğru yere taşı
GitHub'ın APK'yı derlemesi için `build-apk.yml` dosyası `.github/workflows/` klasöründe olmalı.
1. Deponda `build-apk.yml` dosyasına dokun.
2. Sağ üstte kalem (✎ Edit) simgesine bas.
3. Üstteki dosya adı kutusunun en başına şunu yaz: `.github/workflows/`
   Sonuç şöyle görünmeli: `.github/workflows/build-apk.yml`
4. **Commit changes** → **Commit changes**.

## 5) APK'yı indir
1. Deponda üstteki **Actions** sekmesine gir.
2. "APK Derle" çalışmaya başlamış olur (sarı daire). 5-10 dakika bekle, yeşil ✓ olunca içine gir.
3. Sayfanın altındaki **Artifacts** bölümünden **JARVIS-apk** dosyasına dokun, ZIP iner.
4. ZIP'i aç, içinden `app-debug.apk` çıkar.
5. APK'ya dokun, "Bilinmeyen kaynaklardan yüklemeye izin ver" de, **Yükle**.
6. İlk açılışta **mikrofon** ve **konum** izinlerini ver.

Kırmızı ✗ çıkarsa o satıra dokunup hata yazısının ekran görüntüsünü bana at, düzeltirim.

## Google ile giriş nasıl çalışır?
`config.js` içinde `GOOGLE_CLIENT_ID` boşsa uygulama **Misafir** girişi ile açılır.
Google girişi için ücretsiz bir istemci kimliği gerekir:
1. console.cloud.google.com → yeni proje aç.
2. **APIs & Services → OAuth consent screen**: Dış (External) seç, uygulama adı yaz, kendi Gmail'ini "Test users"a ekle.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins**'e şunu ekle: `https://localhost`
5. Çıkan **Client ID**'yi kopyala, GitHub'da `config.js`'i düzenleyip `GOOGLE_CLIENT_ID: ""` içine yapıştır. Commit et, APK yeniden derlenir.

Not: Google, uygulama içi tarayıcılardan (WebView) giriş yapmayı bazen engeller. Bunu telefonda deneyerek görmem lazım. Çalışmazsa Misafir girişi her zaman açıktır, bana yaz, başka bir yöntem kurarım.

## Gerçek yapay zeka sohbeti (isteğe bağlı)
Ayarlar → "Yapay zeka" bölümüne bir Anthropic API anahtarı yazarsan, kendi komutlarında olmayan her soruyu yapay zekaya sorar. Anahtarın yalnızca telefonda saklanır. Kullanım ücretlidir.

## Sesli komut örnekleri
- "Saat kaç", "Bugün günlerden ne"
- "Hava durumu", "Ankara'da hava nasıl"
- "Haberler"
- "WhatsApp'ı aç", "Spotify'ı aç", "Instagram'ı aç"
- "YouTube'da tarkan ara", "Google'da kedi bakımı ara", "Taksim nerede"
- "25 çarpı 4", "5 dakika zamanlayıcı kur", "10 dakika sonra hatırlat"
- "Not al: süt al", "Notlarımı oku"
- "Kız sesine geç", "Erkek sesi", "Daha hızlı konuş"
- "Rengi kırmızı yap", "Arka planı mor yap"
- "Bana şaka yap", "Sus"

## Bilmen gerekenler
- **Erkek / kız sesi:** Telefonundaki Türkçe ses motorunu kullanır. Erkek/kız tuşu perdeyi değiştirir. Daha iyi sonuç için Ayarlar → Ses seçimi listesinden farklı sesleri deneyebilirsin. Telefonun ses ayarlarında (Ayarlar → Erişilebilirlik → Metin okuma) Google Türkçe ses paketini indirirsen kalite artar.
- **Başka uygulamaların içine girmek:** Şu an uygulamaları **açar**, ama içlerinde tıklayıp yazı yazamaz. Bu özellik Android'de "Erişilebilirlik Servisi" gerektirir, istersen sonraki sürümde ekleriz.
- **Zamanlayıcı:** Uygulama açıkken çalışır.
- **Profil fotoğrafı:** Ayarlar → "Profil fotoğrafı seç".
- Sadece Android'de kurulur (iPhone'a kurulmaz).

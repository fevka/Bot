# 🎮 Twitch Viewer Bot - Electron Edition

Modern, kullanıcı dostu arayüze sahip Electron tabanlı Twitch viewer bot uygulaması.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Electron](https://img.shields.io/badge/electron-28.1.0-blue)

## ⚠️ Önemli Uyarı

Bu uygulama **sadece eğitim amaçlıdır**. Twitch'in hizmet şartlarını ihlal edebilir ve hesap banlanmasına yol açabilir. Kullanımdan doğacak tüm sorumluluk size aittir.

## ✨ Özellikler

- 🎨 **Modern UI**: Glassmorphism efektleri ve gradient arka planlar
- 🚀 **Hızlı ve Hafif**: Puppeteer ile optimize edilmiş performans
- 🌐 **7 Proxy Desteği**: Farklı proxy sunucuları arasından seçim
- 📊 **Canlı İstatistikler**: Gerçek zamanlı durum takibi
- 💾 **Cross-Platform**: Windows, macOS ve Linux desteği
- 🎯 **Kolay Kullanım**: Sezgisel ve kullanıcı dostu arayüz
- 🔔 **Bildirimler**: Durum güncellemeleri için görsel bildirimler
- 🎭 **Sistem Tray**: Arka planda çalışma desteği

## 📋 Gereksinimler

- **Node.js** v18 veya üzeri
- **npm** veya **yarn**
- **Chrome/Chromium** tarayıcı (Puppeteer için)
- İnternet bağlantısı

## 🚀 Kurulum

### 1. Bağımlılıkları Yükleyin

```bash
npm install
```

veya

```bash
yarn install
```

### 2. Uygulamayı Çalıştırın

**Geliştirme Modu:**
```bash
npm start
```

**DevTools ile:**
```bash
npm run dev
```

### 3. Production Build Oluşturun

**Windows için:**
```bash
npm run build:win
```

**macOS için:**
```bash
npm run build:mac
```

**Linux için:**
```bash
npm run build:linux
```

Build dosyaları `dist/` klasöründe oluşturulacaktır.

## 📖 Kullanım

1. **Proxy Seçimi**: Dropdown menüden bir proxy sunucusu seçin (BlockAway önerilir)
2. **Kanal Adı**: Twitch kanal adınızı girin (örn: `shroud`)
3. **İzleyici Sayısı**: Slider ile 1-50 arası izleyici sayısı belirleyin
4. **Başlat**: "Başlat" butonuna tıklayın
5. **Durum Takibi**: Sağ panelden canlı istatistikleri izleyin
6. **Durdur**: İşlemi durdurmak için "Durdur" butonuna tıklayın

## 🏗️ Proje Yapısı

```
Twitch Bot/
├── src/
│   ├── main/              # Electron ana süreç
│   │   ├── main.js        # Ana pencere ve IPC
│   │   └── preload.js     # Güvenli API köprüsü
│   ├── renderer/          # UI katmanı
│   │   ├── index.html     # Ana sayfa
│   │   ├── styles.css     # Stiller
│   │   └── renderer.js    # UI mantığı
│   └── bot/              # Bot mantığı
│       ├── proxy-manager.js    # Proxy yönetimi
│       └── bot-controller.js   # Bot kontrolü
├── assets/               # İkonlar ve görseller
├── package.json
└── README.md
```

## 🎯 Desteklenen Proxy Sunucuları

1. **BlockAway** (Önerilen) - `https://www.blockaway.net`
2. **CroxyProxy** - `https://www.croxyproxy.com`
3. **CroxyProxy Rocks** - `https://www.croxyproxy.rocks`
4. **Croxy Network** - `https://www.croxy.network`
5. **Croxy Org** - `https://www.croxy.org`
6. **YouTube Unblocked** - `https://www.youtubeunblocked.live`
7. **CroxyProxy Net** - `https://www.croxyproxy.net`

## 🛠️ Teknolojiler

- **Electron** - Cross-platform desktop uygulama framework
- **Puppeteer** - Headless browser otomasyonu
- **Node.js** - Backend runtime
- **HTML/CSS/JavaScript** - Modern web teknolojileri

## 🐛 Sorun Giderme

### Uygulama açılmıyor
- Node.js versiyonunuzu kontrol edin (`node --version`)
- Bağımlılıkları yeniden yükleyin: `npm install`

### Bot başlamıyor
- İnternet bağlantınızı kontrol edin
- Farklı bir proxy sunucusu deneyin
- Chrome/Chromium'un kurulu olduğundan emin olun

### İzleyiciler gözükmüyor
- Proxy sunucusu değiştirin (BlockAway önerilir)
- İzleyici sayısını azaltın
- Birkaç dakika bekleyin (Twitch gecikmeli güncelleyebilir)

## 📝 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🤝 Katkıda Bulunma

Bu proje eğitim amaçlıdır. Katkılarınızı bekliyoruz!

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## ⚖️ Yasal Uyarı

Bu yazılım sadece eğitim ve araştırma amaçlıdır. Twitch'in hizmet şartlarını ihlal edebilir. Kullanıcılar, bu yazılımı kullanarak tüm riskleri kabul eder. Geliştiriciler, bu yazılımın kullanımından kaynaklanan herhangi bir sorundan sorumlu değildir.

## 📧 İletişim

Sorularınız için issue açabilirsiniz.

---

**Made with ❤️ for educational purposes only**

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const useProxy = require('puppeteer-page-proxy');
const ProxyManager = require('./proxy-manager');
const RealProxyManager = require('./real-proxy-manager');
const UrbanVPNManager = require('./urban-vpn-manager');

puppeteer.use(StealthPlugin());

class BotController {
    constructor() {
        this.browser = null;
        this.pages = [];
        this.isRunning = false;
        this.proxyManager = new ProxyManager();
        this.realProxyManager = new RealProxyManager();
        this.urbanVPNManager = new UrbanVPNManager();
        this.config = null;
        this.emitScreenshot = null;
        this.emitProxyStatus = null;
        this.stats = {
            activeViewers: 0,
            startTime: null,
            errors: 0
        };
    }

    setScreenshotCallback(callback) {
        this.emitScreenshot = callback;
    }

    setProxyStatusCallback(callback) {
        this.emitProxyStatus = callback;
    }

    async start(config) {
        if (this.isRunning) {
            throw new Error('Bot zaten çalışıyor!');
        }

        this.config = config;
        this.isRunning = true;
        this.stats.startTime = Date.now();
        this.stats.errors = 0;

        try {
            // MOD 4: Urban VPN (proxyId === 200) - Extension ile
            if (config.proxyId === 200) {
                console.log('🛡️ Urban VPN modu başlatılıyor...');
                const isReady = await this.urbanVPNManager.prepareExtension();

                if (!isReady) {
                    throw new Error('Urban VPN eklentisi hazır değil! Lütfen CRX dosyasını kontrol edin.');
                }

                // Chrome'u extension ile başlat
                const extPath = this.urbanVPNManager.extensionPath;
                this.browser = await puppeteer.launch({
                    headless: false, // Extension için false olmalı
                    defaultViewport: null,
                    args: [
                        '--window-size=400,300', // Küçük pencere
                        `--disable-extensions-except=${extPath}`,
                        `--load-extension=${extPath}`,
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--allow-running-insecure-content',
                        '--disable-blink-features=AutomationControlled'
                    ]
                });

                console.log('Browser açıldı (Extension Mode)');

                // Extension ID'yi bul (Unpacked olduğu için dinamik olabilir)
                const targets = await this.browser.targets();
                const extensionTarget = targets.find(t => t.type() === 'service_worker' && t.url().includes('chrome-extension://'));
                const extensionId = extensionTarget ? extensionTarget.url().split('/')[2] : 'eppiocemhmnlbhjplcgkofciiegomcon';

                console.log(`🔌 Urban VPN Extension ID bulundu: ${extensionId}`);

                // VPN'e bağlan
                console.log('🔌 VPN Bağlantısı kuruluyor...');
                const vpnConnected = await this.urbanVPNManager.connectVPN(this.browser, extensionId);

                if (!vpnConnected) {
                    console.log('⚠️ VPN Bağlantısı otomatik yapılamadı, lütfen manuel kontrol edin.');
                } else {
                    console.log('✅ VPN Aktif! Viewerlar başlatılıyor...');
                }

                // Kanal adını al
                const channelName = config.channel.replace('https://twitch.tv/', '').replace('https://www.twitch.tv/', '').replace('/', '');

                // Viewer oluşturma loop'u...
                for (let i = 0; i < config.viewerCount; i++) {
                    if (!this.isRunning) break;
                    // createViewerDirect kullanıyoruz çünkü VPN zaten tüm browser'ı tünelliyor
                    await this.createViewerDirect(channelName, i + 1);
                    await this.sleep(2000);
                }

            }
            // MOD 1: API Proxy (proxyId === 100) - İnternetten proxy listesi çek
            else if (config.proxyId === 100) {
                // ... fetch logic ...
                if (this.emitProxyStatus) {
                    this.emitProxyStatus({ message: '🌐 Proxy listesi çekiliyor...', fetched: 0, testing: 0, working: 0, failed: 0 });
                }

                console.log('🌐 Gerçek proxy listesi çekiliyor...');

                // 1. Proxy listesi çek
                await this.realProxyManager.fetchProxies();

                const fetchedCount = this.realProxyManager.proxies.length;
                if (this.emitProxyStatus) {
                    this.emitProxyStatus({ message: `📋 ${fetchedCount} proxy çekildi, test ediliyor...`, fetched: fetchedCount, progress: 0 });
                }

                // 2. Proxy'leri test et ve çalışanları bul (callback ile)
                console.log('🔍 Proxyler test ediliyor (bu biraz sürebilir)...');

                await this.realProxyManager.validateProxies(config.viewerCount + 10, (progress) => {
                    if (this.emitProxyStatus) {
                        this.emitProxyStatus({
                            message: `🔍 Test ediliyor... (${progress.tested}/${progress.total})`,
                            fetched: fetchedCount,
                            testing: progress.tested,
                            working: progress.working,
                            failed: progress.failed,
                            progress: (progress.tested / progress.total) * 100
                        });
                    }
                });

                const workingProxyCount = this.realProxyManager.getWorkingProxyCount();

                if (this.emitProxyStatus) {
                    this.emitProxyStatus({
                        message: workingProxyCount > 0 ? `✅ ${workingProxyCount} çalışan proxy hazır!` : '❌ Çalışan proxy bulunamadı!',
                        fetched: fetchedCount,
                        testing: fetchedCount,
                        working: workingProxyCount,
                        failed: fetchedCount - workingProxyCount,
                        done: true,
                        progress: 100
                    });
                }

                if (workingProxyCount === 0) {
                    throw new Error('Hiç çalışan proxy bulunamadı!');
                }

                console.log(`✅ ${workingProxyCount} çalışan proxy kullanıma hazır!`);
            }
            // MOD 2: Web Proxy (proxyId 1-7) - Proxy sitesi üzerinden bağlan
            else if (config.proxyId >= 1 && config.proxyId <= 7) {
                console.log(`🔗 Web Proxy kullanılıyor: ${this.proxyManager.getProxy(config.proxyId).name}`);
                if (this.emitProxyStatus) {
                    this.emitProxyStatus({ message: `🔗 Web Proxy: ${this.proxyManager.getProxy(config.proxyId).name}`, done: true });
                }
            }
            // MOD 3: Direkt Bağlantı (proxyId === 0) - Proxy yok
            else {
                console.log('⚠️ Proxy devre dışı: Direkt bağlantı kullanılıyor (Riskli!)');
                if (this.emitProxyStatus) {
                    this.emitProxyStatus({ message: '🚫 Proxy devre dışı (Direkt bağlantı)', done: true });
                }
            }

            // Puppeteer'ı başlat
            this.browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=640,480',
                    '--mute-audio'
                ]
            });

            console.log(`🚀 Bot başlatılıyor: ${config.channel}, ${config.viewerCount} viewer`);

            for (let i = 0; i < config.viewerCount; i++) {
                if (!this.isRunning) break;

                try {
                    // MOD 1: Direkt Bağlantı (proxyId === 0)
                    if (config.proxyId === 0) {
                        console.log(`Viewer ${i + 1}: Direkt bağlantı ile bağlanılıyor...`);
                        await this.createViewerDirect(config.channel, i + 1);
                    }
                    // MOD 2: Web Proxy Sitesi (proxyId 1-7)
                    else if (config.proxyId >= 1 && config.proxyId <= 7) {
                        const proxy = this.proxyManager.getProxy(config.proxyId);
                        console.log(`Viewer ${i + 1}: Web Proxy (${proxy.name}) üzerinden bağlanılıyor...`);
                        await this.createViewer(proxy, config.channel, i + 1);
                    }
                    // MOD 3: API Proxy (proxyId === 100)
                    else if (config.proxyId === 100) {
                        const proxyString = this.realProxyManager.getNextProxy();

                        if (!proxyString) {
                            console.log(`⚠️ Viewer ${i + 1}: Proxy yetersiz`);
                            this.stats.errors++;
                            continue;
                        }

                        console.log(`Viewer ${i + 1}: API Proxy ${proxyString} kullanılıyor`);
                        await this.createViewerWithProxy(config.channel, proxyString, i + 1);
                    }

                    this.stats.activeViewers++;
                    await this.sleep(3000); // Viewerlar arası bekleme
                } catch (error) {
                    console.error(`Viewer ${i + 1} oluşturulurken hata:`, error.message);
                    this.stats.errors++;
                }
            }

            return {
                activeViewers: this.stats.activeViewers,
                errors: this.stats.errors
            };

        } catch (error) {
            this.isRunning = false;
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            throw new Error(`Bot başlatılamadı: ${error.message}`);
        }
    }

    /**
     * Direkt bağlantı ile viewer oluşturur (Proxy yok)
     */
    async createViewerDirect(channel, viewerNumber) {
        const page = await this.browser.newPage();

        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        await page.setViewport({ width: 640, height: 480 });

        try {
            await page.goto(`https://www.twitch.tv/${channel}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            // Injection & Bypass Logic
            await this.injectBypassScripts(page, viewerNumber);

        } catch (error) {
            await page.close();
            throw new Error(`Viewer ${viewerNumber} (Direkt) hatası: ${error.message}`);
        }

        this.pages.push(page);
    }

    /**
     * Web Proxy sitesi üzerinden viewer oluşturur (BlockAway, CroxyProxy vb.)
     */
    async createViewer(proxy, channel, viewerNumber) {
        const page = await this.browser.newPage();

        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        await page.setViewport({ width: 640, height: 480 });

        try {
            // 1. Proxy sitesine git
            console.log(`Viewer ${viewerNumber}: ${proxy.name} sitesine gidiliyor...`);
            await page.goto(proxy.url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });

            await this.sleep(3000);

            // 2. Twitch URL'sini gir
            const twitchUrl = `https://www.twitch.tv/${channel}`;

            try {
                await page.waitForSelector(proxy.inputSelector, { timeout: 10000 });
                await page.type(proxy.inputSelector, twitchUrl);
                await this.sleep(1000);

                // Submit butonunu bul ve tıkla
                const submitBtn = await page.$('button[type="submit"], input[type="submit"], button.go-btn, #go, .btn-go');
                if (submitBtn) {
                    await submitBtn.click();
                } else {
                    await page.keyboard.press('Enter');
                }

                console.log(`Viewer ${viewerNumber}: Twitch'e yönlendiriliyor...`);
            } catch (e) {
                console.log(`Viewer ${viewerNumber}: URL girişi hatası:`, e.message);
            }

            // 3. Sayfanın yüklenmesini bekle
            await this.sleep(8000);

            // 4. Bypass ve video oynatma
            await this.injectBypassScripts(page, viewerNumber);

            this.pages.push(page);
            console.log(`Viewer ${viewerNumber}: ✅ Web Proxy (${proxy.name}) üzerinden aktif`);

        } catch (error) {
            await page.close();
            throw new Error(`Viewer ${viewerNumber} (${proxy.name}) hatası: ${error.message}`);
        }
    }

    /**
     * API Proxy ile viewer oluşturur (Gerçek proxy routing)
     */
    async createViewerWithProxy(channel, proxyString, viewerNumber) {
        const [ip, port] = proxyString.split(':');
        const page = await this.browser.newPage();

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 640, height: 480 });

        try {
            // GERÇEK PROXY ROUTING - Trafik artık proxy üzerinden gidiyor!
            const proxyUrl = `http://${ip}:${port}`;
            console.log(`Viewer ${viewerNumber}: Gerçek proxy ayarlanıyor: ${proxyUrl}`);

            // Her istek için proxy kullan
            await page.setRequestInterception(true);
            page.on('request', async (request) => {
                try {
                    await useProxy(request, proxyUrl);
                } catch (e) {
                    request.continue();
                }
            });

            await page.goto(`https://www.twitch.tv/${channel}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            console.log(`Viewer ${viewerNumber}: ✓ Proxy ${ip}:${port} üzerinden bağlandı`);

            await this.injectBypassScripts(page, viewerNumber);

        } catch (error) {
            await page.close();
            throw new Error(`Viewer ${viewerNumber} (${ip}:${port}) hatası: ${error.message}`);
        }

        this.pages.push(page);
    }

    /**
     * Ortak bypass ve video oynatma senaryosu (Geliştirilmiş)
     */
    async injectBypassScripts(page, viewerNumber) {
        // 1. LocalStorage Injection
        try {
            await page.evaluate(() => {
                localStorage.setItem('mature', 'true');
                localStorage.setItem('video-muted', '{"default":true}');
                localStorage.setItem('volume', '0.0');
                localStorage.setItem('video-quality', '{"default":"160p30"}');
                const now = Date.now();
                localStorage.setItem('twilight-content-classification-gate-acknowledged', JSON.stringify({
                    "data": { "acknowledgedAt": now },
                    "version": 1
                }));
            });
        } catch (e) { }

        await page.reload({ waitUntil: ['domcontentloaded', 'networkidle2'] });
        await this.sleep(5000); // Daha uzun bekleme

        // Screenshot Loop
        const screenshotInterval = setInterval(async () => {
            if (page.isClosed()) {
                clearInterval(screenshotInterval);
                return;
            }
            try {
                const screenshot = await page.screenshot({
                    encoding: 'base64',
                    quality: 40,
                    type: 'jpeg'
                });
                if (this.emitScreenshot) this.emitScreenshot(viewerNumber, screenshot);
            } catch (e) { }
        }, 5000);

        // AGRESIF OVERLAY TEMIZLEME
        for (let attempt = 0; attempt < 3; attempt++) {
            await page.evaluate(() => {
                // Tüm overlay'leri kaldır
                document.querySelectorAll('[class*="overlay"], [class*="Overlay"], [data-a-target*="overlay"], [data-a-target*="gate"]').forEach(el => el.remove());

                // Mature content butonları
                document.querySelectorAll('button[data-a-target*="mature"]').forEach(btn => btn.click());

                // Content classification
                const contentGate = document.querySelector('[data-a-target="content-classification-gate-overlay"]');
                if (contentGate) contentGate.remove();
            });
            await this.sleep(1000);
        }

        // Mature button check
        try {
            const matureButton = await page.$('button[data-a-target="player-overlay-mature-accept"]');
            if (matureButton) {
                await matureButton.click();
                console.log(`Viewer ${viewerNumber}: Mature content kabul edildi`);
                await this.sleep(2000);
            }
        } catch (e) { }

        // VIDEO OYNATMA - ÇOK AGRESIF
        try {
            console.log(`Viewer ${viewerNumber}: Video bekleniyor...`);
            await page.waitForSelector('video', { timeout: 20000 });
            await this.sleep(3000);

            // 1. Önce video elementine tıkla (player'ı aktifleştir)
            try {
                await page.click('video');
                console.log(`Viewer ${viewerNumber}: Video'ya tıklandı`);
            } catch (e) { }

            await this.sleep(2000);

            // 2. JavaScript ile zorla oynat
            const playResult = await page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) return 'Video bulunamadı';

                // Mute et
                video.muted = true;
                video.volume = 0;

                // Play
                if (video.paused) {
                    video.play().catch(e => console.log('Play hatası:', e));
                }

                return `Video durumu: paused=${video.paused}, muted=${video.muted}, readyState=${video.readyState}`;
            });
            console.log(`Viewer ${viewerNumber}: ${playResult}`);

            await this.sleep(2000);

            // 3. Play button'a tıkla (varsa)
            try {
                const playBtn = await page.$('button[data-a-target="player-overlay-play-button"], button[aria-label="Play"], .player-overlay-play-button');
                if (playBtn) {
                    await playBtn.click();
                    console.log(`Viewer ${viewerNumber}: Play button'a tıklandı`);
                }
            } catch (e) { }

            await this.sleep(2000);

            // 4. Player'a tekrar tıkla (oynatmayı garantilemek için)
            try {
                const playerDiv = await page.$('[data-a-target="player-overlay-click-handler"], .video-player__container');
                if (playerDiv) {
                    await playerDiv.click();
                }
            } catch (e) { }

            // 5. VİDEO YÜKLENMESINI BEKLE (readyState kontrolü)
            console.log(`Viewer ${viewerNumber}: Video yüklenmesi bekleniyor...`);
            let videoLoaded = false;
            const maxWaitTime = 30000; // 30 saniye max
            const startTime = Date.now();

            while (!videoLoaded && (Date.now() - startTime) < maxWaitTime) {
                const status = await page.evaluate(() => {
                    const video = document.querySelector('video');
                    if (!video) return { found: false };
                    return {
                        found: true,
                        readyState: video.readyState,
                        paused: video.paused,
                        currentTime: video.currentTime,
                        duration: video.duration
                    };
                });

                if (status.found && status.readyState >= 3) {
                    // readyState 3 = HAVE_FUTURE_DATA (yeterli data var)
                    // readyState 4 = HAVE_ENOUGH_DATA (tam yüklendi)
                    videoLoaded = true;
                    console.log(`Viewer ${viewerNumber}: ✅ Video yüklendi! (readyState: ${status.readyState})`);

                    // Video pause olduysa tekrar oynat
                    if (status.paused) {
                        await page.evaluate(() => {
                            const video = document.querySelector('video');
                            if (video) video.play();
                        });
                    }
                } else {
                    // Hala yükleniyor, bekle
                    await this.sleep(2000);
                    if (status.found) {
                        console.log(`Viewer ${viewerNumber}: Yükleniyor... (readyState: ${status.readyState})`);
                    }
                }
            }

            if (!videoLoaded) {
                console.log(`Viewer ${viewerNumber}: ⚠️ Video 30 saniyede yüklenemedi! Proxy çok yavaş olabilir.`);
            }

            // 6. Kalite ayarını 160p yap (VİDEO YÜKLENDİYSE)
            try {
                // Settings butonunu aç
                const settingsBtn = await page.$('button[data-a-target="player-settings-button"]');
                if (settingsBtn) {
                    await settingsBtn.click();
                    await this.sleep(1000);

                    // Quality seçeneğine tıkla
                    const qualityOption = await page.$('button[data-a-target="player-settings-menu-item-quality"]');
                    if (qualityOption) {
                        await qualityOption.click();
                        await this.sleep(500);

                        // 160p seç (en düşük)
                        const qualities = await page.$$('input[data-a-target="tw-radio"]');
                        if (qualities.length > 0) {
                            await qualities[qualities.length - 1].click(); // En son = en düşük kalite
                            console.log(`Viewer ${viewerNumber}: Kalite 160p ayarlandı`);
                        }
                    }

                    // Settings'i kapat (video'ya tekrar tıkla)
                    await page.click('video');
                }
            } catch (e) {
                console.log(`Viewer ${viewerNumber}: Kalite ayarı yapılamadı:`, e.message);
            }

            // Final check - video oynatılıyor mu?
            await this.sleep(2000);
            const finalStatus = await page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) return 'Video element yok!';
                return {
                    playing: !video.paused && video.readyState > 2,
                    paused: video.paused,
                    readyState: video.readyState,
                    currentTime: video.currentTime
                };
            });

            if (finalStatus.playing) {
                console.log(`Viewer ${viewerNumber}: ✅ VIDEO OYNATIYOR! (currentTime: ${finalStatus.currentTime})`);
            } else {
                console.log(`Viewer ${viewerNumber}: ⚠️ Video durumu belirsiz:`, finalStatus);
            }

        } catch (error) {
            console.log(`Viewer ${viewerNumber}: Video oynatma hatası:`, error.message);
        }
    }

    async stop() {
        console.log('🛑 Bot durduruluyor...');
        this.isRunning = false;

        // Hemen browser'ı kapat (page'leri beklemeden)
        if (this.browser) {
            try {
                await Promise.race([
                    this.browser.close(),
                    new Promise(resolve => setTimeout(resolve, 2000)) // Max 2 saniye bekle
                ]);
                console.log('✅ Browser kapatıldı');
            } catch (e) {
                console.log('⚠️ Browser kapatma hatası:', e.message);
            }
            this.browser = null;
        }

        // Stats'i sıfırla
        this.pages = [];
        this.stats.activeViewers = 0;
        console.log('✅ Bot durduruldu');
    }

    getStatus() {
        let uptime = 0;
        if (this.stats.startTime) {
            uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        }

        return {
            isRunning: this.isRunning,
            activeViewers: this.stats.activeViewers,
            errors: this.stats.errors,
            uptime: uptime
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BotController;

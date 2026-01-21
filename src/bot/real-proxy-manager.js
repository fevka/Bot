const https = require('https');
const http = require('http');

class RealProxyManager {
    constructor() {
        this.proxies = [];
        this.workingProxies = [];
        this.currentIndex = 0;
    }

    /**
     * GitHub ve API'lerden binlerce proxy çeker
     */
    async fetchProxies() {
        console.log('🌐 Geniş kapsamlı proxy listeleri taranıyor...');
        const allProxies = [];

        const sources = [
            // 1. TheSpeedX (Popüler & Güncel)
            'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt',

            // 2. ShiftyTR (Sık güncellenir)
            'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
            'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',

            // 3. Monosans
            'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',

            // 4. ProxyScrape (API)
            'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=yes&anonymity=all'
        ];

        console.log(`📋 ${sources.length} kaynak taranıyor...`);

        for (const source of sources) {
            try {
                const proxies = await this.fetchFromAPI(source);
                allProxies.push(...proxies);
                console.log(`✅ Kaynaktan ${proxies.length} proxy alındı`);
            } catch (e) {
                console.log(`⚠️ Kaynak hatası (${source}):`, e.message);
            }
        }

        // Unique proxy'leri al
        this.proxies = [...new Set(allProxies)];
        console.log(`🚀 Toplam ${this.proxies.length} unique proxy toplandı!`);

        return this.proxies;
    }

    /**
     * VPN Gate API'den CSV formatında proxy çeker ve parse eder
     */
    async fetchVPNGateProxies() {
        return new Promise((resolve, reject) => {
            const url = 'http://www.vpngate.net/api/iphone/';

            http.get(url, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        // CSV'yi parse et
                        const lines = data.split('\n');
                        const proxyData = [];

                        // İlk 2 satır header, skip
                        for (let i = 2; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (!line || line.startsWith('#') || line.startsWith('*')) continue;

                            const fields = line.split(',');
                            if (fields.length < 8) continue;

                            // CSV Format: HostName,IP,Score,Ping,Speed,CountryLong,CountryShort,NumVpnSessions,Uptime,...
                            const ip = fields[1];
                            const score = parseInt(fields[2]) || 0;
                            const ping = parseInt(fields[3]) || 9999;
                            const speed = parseInt(fields[4]) || 0;
                            const country = fields[6];

                            // DAHA ESNEK FİLTRELEME
                            // Score > 200 = İyi kalite
                            // Ping < 500 = Kabul edilebilir hız
                            if (ip && score > 200 && ping < 500) {
                                proxyData.push({
                                    ip,
                                    score,
                                    ping,
                                    speed,
                                    country
                                });
                            }
                        }

                        // Skora göre sırala (en yüksek score en üstte)
                        proxyData.sort((a, b) => b.score - a.score);

                        // En iyi 50 VPN'i al ve farklı portlarla dene
                        const proxies = [];
                        for (const vpn of proxyData.slice(0, 50)) {
                            // HTTP proxy portları + yaygın alternatifler
                            proxies.push(`${vpn.ip}:8080`);
                            proxies.push(`${vpn.ip}:3128`);
                            proxies.push(`${vpn.ip}:80`);
                            proxies.push(`${vpn.ip}:8888`);
                            proxies.push(`${vpn.ip}:9090`);
                        }

                        console.log(`📊 VPN Gate: ${proxyData.length} VPN bulundu, ${proxies.length} proxy oluşturuldu`);
                        resolve(proxies);

                    } catch (e) {
                        console.log('VPN Gate parse hatası:', e.message);
                        resolve([]);
                    }
                });
            }).on('error', (e) => {
                console.log('VPN Gate bağlantı hatası:', e.message);
                resolve([]);
            });
        });
    }

    /**
     * API'den proxy listesi çeker (text formatında ip:port)
     */
    fetchFromAPI(url) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;

            protocol.get(url, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    const proxies = data
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line && line.match(/^\d+\.\d+\.\d+\.\d+:\d+$/));
                    resolve(proxies);
                });
            }).on('error', reject);
        });
    }

    /**
     * GeoNode API'den JSON formatında proxy çeker
     */
    async fetchGeoNodeProxies() {
        return new Promise((resolve, reject) => {
            const url = 'https://proxylist.geonode.com/api/proxy-list?limit=100&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps';

            https.get(url, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const proxies = json.data.map(p => `${p.ip}:${p.port}`);
                        resolve(proxies);
                    } catch (e) {
                        resolve([]);
                    }
                });
            }).on('error', () => resolve([]));
        });
    }

    /**
     * Proxy'yi test eder (hızlı check)
     */
    async testProxy(proxyString, timeout = 10000) {
        const [ip, port] = proxyString.split(':');

        return new Promise((resolve) => {
            const startTime = Date.now();
            let isResolved = false;

            // 1. Önce CONNECT dene (HTTPS için en iyisi)
            const req = http.request({
                host: ip,
                port: parseInt(port),
                method: 'CONNECT',
                path: 'www.google.com:443',
                timeout: timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            req.on('connect', (res, socket, head) => {
                if (isResolved) return;
                isResolved = true;
                const responseTime = Date.now() - startTime;
                socket.destroy();
                req.destroy();
                resolve({ success: true, responseTime, proxy: proxyString, type: 'HTTPS' });
            });

            const tryFallback = () => {
                if (isResolved) return;

                // 2. CONNECT başarısızsa, düz HTTP GET dene
                const req2 = http.request({
                    host: ip,
                    port: parseInt(port),
                    method: 'HEAD',
                    path: 'http://www.google.com',
                    timeout: timeout,
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                }, (res) => {
                    if (isResolved) return;
                    isResolved = true;
                    if (res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302) {
                        const responseTime = Date.now() - startTime;
                        resolve({ success: true, responseTime, proxy: proxyString, type: 'HTTP' });
                    } else {
                        resolve({ success: false, proxy: proxyString });
                    }
                });

                req2.on('error', () => {
                    if (!isResolved) {
                        isResolved = true;
                        resolve({ success: false, proxy: proxyString });
                    }
                });

                req2.on('timeout', () => {
                    req2.destroy();
                    if (!isResolved) {
                        isResolved = true;
                        resolve({ success: false, proxy: proxyString });
                    }
                });

                req2.end();
            };

            req.on('timeout', () => {
                req.destroy();
                tryFallback();
            });

            req.on('error', () => {
                req.destroy();
                tryFallback();
            });

            req.end();
        });
    }

    /**
     * Tüm proxy'leri test eder ve çalışanları döner
     * @param {number} maxProxies - Maksimum proxy sayısı
     * @param {function} onProgress - İlerleme callback'i (opsiyonel)
     */
    async validateProxies(maxProxies = 50, onProgress = null) {
        console.log(`${this.proxies.length} proxy test ediliyor...`);

        // Tüm proxy'leri test et (limit koyma, çünkü loop içinde break yapacağız)
        const proxiesToTest = this.proxies;
        const total = proxiesToTest.length;
        let tested = 0;
        let working = 0;
        let failed = 0;
        const results = [];

        // Hedeflenen çalışan proxy sayısı (istenenden biraz fazla olsun)
        const targetWorkingCount = maxProxies + 5;

        // Seri test yerine paralel batch test (20'li gruplar halinde - daha hızlı)
        const batchSize = 20;

        for (let i = 0; i < proxiesToTest.length; i += batchSize) {
            // Yeterince çalışan proxy bulduysak DUR
            if (working >= targetWorkingCount) {
                console.log(`✨ Yeterli proxy bulundu (${working}/${targetWorkingCount}), test durduruluyor...`);
                break;
            }

            const batch = proxiesToTest.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(proxy => this.testProxy(proxy, 10000)));

            for (const result of batchResults) {
                tested++;
                if (result.success) {
                    working++;
                    results.push(result);
                } else {
                    failed++;
                }
            }

            // İlerlemeyi bildir
            if (onProgress) {
                onProgress({ tested, total, working, failed });
            }
        }

        this.workingProxies = results
            .sort((a, b) => a.responseTime - b.responseTime) // Hızlı olanlara öncelik
            .slice(0, maxProxies)
            .map(r => r.proxy);

        console.log(`✅ ${this.workingProxies.length} çalışan proxy bulundu!`);

        return this.workingProxies;
    }

    /**
     * Round-robin ile sıradaki proxy'yi döner
     */
    getNextProxy() {
        if (this.workingProxies.length === 0) {
            return null;
        }

        const proxy = this.workingProxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.workingProxies.length;

        return proxy;
    }

    /**
     * Rastgele proxy döner
     */
    getRandomProxy() {
        if (this.workingProxies.length === 0) {
            return null;
        }

        const index = Math.floor(Math.random() * this.workingProxies.length);
        return this.workingProxies[index];
    }

    /**
     * Çalışan proxy sayısını döner
     */
    getWorkingProxyCount() {
        return this.workingProxies.length;
    }
}

module.exports = RealProxyManager;

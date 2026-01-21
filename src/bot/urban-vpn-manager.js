const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

class UrbanVPNManager {
    constructor() {
        this.extensionPath = path.join(process.cwd(), 'extensions', 'urban-vpn');
        this.crxPath = path.join(process.cwd(), 'extensions', 'urban-vpn.crx');
        this.manifestPath = path.join(this.extensionPath, 'manifest.json');
    }

    /**
     * Unpacks CRX file to folder
     */
    async prepareExtension() {
        console.log(`DEBUG: Checking for unpacked extension at: ${this.extensionPath}`);

        // Eğer klasör ve manifest varsa TAMAM
        if (fs.existsSync(this.extensionPath) && fs.existsSync(this.manifestPath)) {
            console.log('✅ Urban VPN extension found and ready!');
            return true;
        }

        console.log('⚠️ UNPACKED EXTENSION NOT FOUND!');
        console.log('---------------------------------------------------');
        console.log('LÜTFEN ŞUNU YAPIN:');
        console.log(`1. extensions klasöründeki urban-vpn.zip dosyasını açın`);
        console.log(`2. Dosyaları şuraya çıkartın: ${this.extensionPath}`);
        console.log('   (Klasöre girdiğinizde manifest.json dosyasını görmelisiniz)');
        console.log('---------------------------------------------------');

        return false;
    }

    /**
     * Automates Urban VPN Popup and connects
     */
    async connectVPN(browser, extensionId) {
        try {
            const page = await browser.newPage();
            // Extension popup sayfasını aç
            const popupUrl = `chrome-extension://${extensionId}/popup/index.html`;
            console.log(`🔌 VPN Popup açılıyor: ${popupUrl}`);

            await page.goto(popupUrl, { waitUntil: 'networkidle0' });

            // 1. Agree butonu
            try {
                const agreeBtn = await page.waitForSelector('.force-agree-button', { timeout: 5000 });
                if (agreeBtn) await agreeBtn.click();
            } catch (e) { }

            await new Promise(r => setTimeout(r, 1000));

            // 2. Play butonuna bas (Auto-connect / Free Server)
            // Urban VPN genelde "Auto server" seçer, play'e basmak yeter
            const playBtnSelector = '.play-button';
            await page.waitForSelector(playBtnSelector, { timeout: 5000 });
            await page.click(playBtnSelector);

            console.log('✅ VPN Bağlantısı başlatıldı!');
            await new Promise(r => setTimeout(r, 3000)); // Bağlanmasını bekle

            // Bağlantı durumunu kontrol et
            const isConnected = await page.evaluate(() => {
                return document.querySelector('.pause-button') !== null;
            });

            if (isConnected) {
                console.log('✅ VPN Başarıyla bağlandı!');
                await page.close();
                return true;
            } else {
                console.log('⚠️ VPN bağlantısı doğrulanamadı.');
                await page.close();
                return false;
            }

        } catch (error) {
            console.error('❌ VPN Otomasyon hatası:', error.message);
            return false;
        }
    }
}

module.exports = UrbanVPNManager;

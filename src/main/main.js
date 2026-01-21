const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const BotController = require('../bot/bot-controller');

let mainWindow;
let tray;
let botController;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 800,
        minHeight: 600,
        frame: true,
        backgroundColor: '#0e0e10',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../../assets/icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Geliştirme modunda DevTools aç
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Minimize to tray
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });
}

function createTray() {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Göster',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'Çıkış',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Twitch Viewer Bot');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
    botController = new BotController();

    // Proxy durumu güncellemelerini renderer'a ilet
    botController.setProxyStatusCallback((status) => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('proxy-status', status);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (botController) {
        await botController.stop();
    }
});

// IPC Handlers
ipcMain.handle('start-bot', async (event, config) => {
    try {
        const result = await botController.start(config);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-bot', async () => {
    try {
        await botController.stop();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-status', async () => {
    try {
        const status = botController.getStatus();
        return { success: true, data: status };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Bot durumu güncellemelerini renderer'a gönder
setInterval(() => {
    if (mainWindow && botController) {
        const status = botController.getStatus();
        mainWindow.webContents.send('status-update', status);
    }
}, 1000);

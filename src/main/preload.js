const { contextBridge, ipcRenderer } = require('electron');

// Güvenli API'yi renderer sürecine aç
contextBridge.exposeInMainWorld('electronAPI', {
    // Bot kontrolü
    startBot: (config) => ipcRenderer.invoke('start-bot', config),
    stopBot: () => ipcRenderer.invoke('stop-bot'),
    getStatus: () => ipcRenderer.invoke('get-status'),

    // Durum güncellemelerini dinle
    onStatusUpdate: (callback) => {
        ipcRenderer.on('status-update', (event, status) => callback(status));
    },

    // Proxy durum güncellemelerini dinle
    onProxyStatus: (callback) => {
        ipcRenderer.on('proxy-status', (event, status) => callback(status));
    }
});

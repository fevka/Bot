// DOM Elements
const proxySelect = document.getElementById('proxy-select');
const channelInput = document.getElementById('channel-input');
const viewerCountSlider = document.getElementById('viewer-count');
const viewerCountDisplay = document.getElementById('viewer-count-display');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');

// Status Elements
const botStatus = document.getElementById('bot-status');
const activeViewers = document.getElementById('active-viewers');
const currentChannel = document.getElementById('current-channel');
const uptime = document.getElementById('uptime');
const errorCount = document.getElementById('error-count');
const currentProxy = document.getElementById('current-proxy');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

// State
let isRunning = false;
let uptimeInterval = null;

// Proxy names mapping
const proxyNames = {
    1: 'BlockAway',
    2: 'CroxyProxy',
    3: 'CroxyProxy Rocks',
    4: 'Croxy Network',
    5: 'Croxy Org',
    6: 'YouTube Unblocked',
    7: 'CroxyProxy Net'
};

// Event Listeners
viewerCountSlider.addEventListener('input', (e) => {
    viewerCountDisplay.textContent = e.target.value;
});

startBtn.addEventListener('click', async () => {
    const channel = channelInput.value.trim();
    const proxyId = parseInt(proxySelect.value);
    const viewerCount = parseInt(viewerCountSlider.value);

    // Validation
    if (!channel) {
        showNotification('Lütfen bir kanal adı girin!', 'error');
        channelInput.focus();
        return;
    }

    if (viewerCount < 1 || viewerCount > 50) {
        showNotification('İzleyici sayısı 1-50 arasında olmalıdır!', 'error');
        return;
    }

    // Disable controls
    setControlsEnabled(false);
    updateStatus('starting');
    showProgress(true);

    try {
        const config = {
            channel,
            proxyId,
            viewerCount
        };

        const result = await window.electronAPI.startBot(config);

        if (result.success) {
            isRunning = true;
            updateStatus('running');
            currentChannel.textContent = channel;
            currentProxy.textContent = proxyNames[proxyId];
            startUptimeCounter();
            showNotification(`Bot başarıyla başlatıldı! ${result.data.activeViewers} izleyici aktif.`, 'success');

            if (result.data.errors > 0) {
                showNotification(`${result.data.errors} izleyici oluşturulurken hata oluştu.`, 'warning');
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Bot başlatma hatası:', error);
        showNotification(`Hata: ${error.message}`, 'error');
        updateStatus('idle');
        setControlsEnabled(true);
    } finally {
        showProgress(false);
    }
});

stopBtn.addEventListener('click', async () => {
    if (!isRunning) return;

    stopBtn.disabled = true;
    updateStatus('stopping');

    try {
        const result = await window.electronAPI.stopBot();

        if (result.success) {
            isRunning = false;
            updateStatus('idle');
            stopUptimeCounter();
            resetStats();
            setControlsEnabled(true);
            showNotification('Bot başarıyla durduruldu.', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Bot durdurma hatası:', error);
        showNotification(`Hata: ${error.message}`, 'error');
    } finally {
        stopBtn.disabled = false;
    }
});

// Status Updates from Main Process
window.electronAPI.onStatusUpdate((status) => {
    if (status.isRunning) {
        activeViewers.textContent = status.activeViewers;
        errorCount.textContent = status.errors;

        // Update progress if starting
        if (progressContainer.style.display !== 'none') {
            const progress = (status.activeViewers / parseInt(viewerCountSlider.value)) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${status.activeViewers} / ${viewerCountSlider.value}`;
        }
    }
});

// Proxy Status Updates from Main Process
window.electronAPI.onProxyStatus((status) => {
    const proxyFetched = document.getElementById('proxy-fetched');
    const proxyTesting = document.getElementById('proxy-testing');
    const proxyWorking = document.getElementById('proxy-working');
    const proxyFailed = document.getElementById('proxy-failed');
    const proxyStatusText = document.getElementById('proxy-status-text');
    const proxyProgressBar = document.getElementById('proxy-progress-bar');
    const proxyProgressFill = document.getElementById('proxy-progress-fill');

    if (status.fetched !== undefined) proxyFetched.textContent = status.fetched;
    if (status.testing !== undefined) proxyTesting.textContent = status.testing;
    if (status.working !== undefined) proxyWorking.textContent = status.working;
    if (status.failed !== undefined) proxyFailed.textContent = status.failed;
    if (status.message) proxyStatusText.textContent = status.message;

    // Progress bar
    if (status.progress !== undefined) {
        proxyProgressBar.style.display = 'block';
        proxyProgressFill.style.width = `${status.progress}%`;
    }

    if (status.done) {
        proxyProgressBar.style.display = 'none';
    }
});

// Helper Functions
function setControlsEnabled(enabled) {
    proxySelect.disabled = !enabled;
    channelInput.disabled = !enabled;
    viewerCountSlider.disabled = !enabled;
    startBtn.disabled = !enabled;
    stopBtn.disabled = enabled;
}

function updateStatus(status) {
    const badge = botStatus.querySelector('.status-badge');
    badge.className = 'status-badge';

    switch (status) {
        case 'idle':
            badge.classList.add('status-idle');
            badge.textContent = 'Beklemede';
            break;
        case 'starting':
            badge.classList.add('status-running');
            badge.textContent = 'Başlatılıyor...';
            break;
        case 'running':
            badge.classList.add('status-running');
            badge.textContent = 'Çalışıyor';
            break;
        case 'stopping':
            badge.classList.add('status-idle');
            badge.textContent = 'Durduruluyor...';
            break;
    }
}

function showProgress(show) {
    if (show) {
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = '0 / ' + viewerCountSlider.value;
    } else {
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);
    }
}

function startUptimeCounter() {
    let seconds = 0;
    uptimeInterval = setInterval(() => {
        seconds++;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        uptime.textContent = `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
    }, 1000);
}

function stopUptimeCounter() {
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }
}

function resetStats() {
    activeViewers.textContent = '0';
    currentChannel.textContent = '-';
    currentProxy.textContent = '-';
    uptime.textContent = '00:00:00';
    errorCount.textContent = '0';
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function showNotification(message, type = 'info') {
    // Simple console notification for now
    // You can implement a toast notification system here
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Optional: You could add a visual notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#00f593' : '#ffb800'};
        color: ${type === 'success' ? '#000' : '#fff'};
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        font-weight: 500;
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize
console.log('Twitch Viewer Bot UI initialized');

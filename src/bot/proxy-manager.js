const PROXY_SERVERS = [
    {
        id: 1,
        name: 'BlockAway',
        url: 'https://www.blockaway.net',
        inputSelector: '#url',
        recommended: true
    },
    {
        id: 2,
        name: 'CroxyProxy',
        url: 'https://www.croxyproxy.com',
        inputSelector: '#url'
    },
    {
        id: 3,
        name: 'CroxyProxy Rocks',
        url: 'https://www.croxyproxy.rocks',
        inputSelector: '#url'
    },
    {
        id: 4,
        name: 'Croxy Network',
        url: 'https://www.croxy.network',
        inputSelector: '#url'
    },
    {
        id: 5,
        name: 'Croxy Org',
        url: 'https://www.croxy.org',
        inputSelector: '#url'
    },
    {
        id: 6,
        name: 'YouTube Unblocked',
        url: 'https://www.youtubeunblocked.live',
        inputSelector: '#url'
    },
    {
        id: 7,
        name: 'CroxyProxy Net',
        url: 'https://www.croxyproxy.net',
        inputSelector: '#url'
    }
];

class ProxyManager {
    constructor() {
        this.proxies = PROXY_SERVERS;
    }

    getProxyById(id) {
        return this.proxies.find(proxy => proxy.id === id);
    }

    getProxy(id) {
        return this.getProxyById(id);
    }

    getAllProxies() {
        return this.proxies;
    }

    getRecommendedProxy() {
        return this.proxies.find(proxy => proxy.recommended) || this.proxies[0];
    }

    async testProxy(proxyId) {
        // Basit bir proxy sağlık kontrolü
        const proxy = this.getProxyById(proxyId);
        if (!proxy) return false;

        try {
            const response = await fetch(proxy.url, {
                method: 'HEAD',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

module.exports = ProxyManager;

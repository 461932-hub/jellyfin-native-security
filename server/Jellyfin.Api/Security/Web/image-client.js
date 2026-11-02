/* Native Jellyfin media security preview 1: authenticate same-origin library images by header. */
(() => {
    'use strict';
    if (window.__mediaGuardImages) return;
    window.__mediaGuardImages = true;
    const loader = document.currentScript;
    if (!loader) return;
    const scriptUrl = new URL(loader.src, location.href);
    const suffix = '/MediaSecurity/image-client.js';
    if (scriptUrl.origin !== location.origin || !scriptUrl.pathname.endsWith(suffix)) return;
    const basePath = scriptUrl.pathname.slice(0, -suffix.length);
    const roots = new Set(['items', 'artists', 'genres', 'musicgenres', 'persons', 'studios']);
    const nativeSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!nativeSrc?.set) return;
    const nativeSetAttribute = Element.prototype.setAttribute;
    const nativeFetch = window.fetch.bind(window);
    const states = new WeakMap();
    const cache = new Map();
    const queue = [];
    let active = 0, generation = 0, currentSession = '', totalBytes = 0;
    const maxBytes = 32 * 1024 * 1024, maxEntries = 192;

    function protectedUrl(value) {
        if (typeof value !== 'string' || !value || /^(blob:|data:)/i.test(value)) return null;
        try {
            const url = new URL(value, location.href);
            if (url.origin !== location.origin || url.username || url.password) return null;
            if (/%(?:2f|5c|2e)/i.test(url.pathname)) return null;
            if (basePath && !url.pathname.toLowerCase().startsWith(basePath.toLowerCase() + '/')) return null;
            const parts = url.pathname.slice(basePath.length).split('/').filter(Boolean);
            if (parts.length < 4 || !roots.has(parts[0].toLowerCase()) || parts[2].toLowerCase() !== 'images') return null;
            // Existing Cinema/native query credentials are unnecessary here.
            for (const key of [...url.searchParams.keys()]) if (/^(api_?key|access_token|token)$/i.test(key)) url.searchParams.delete(key);
            url.hash = '';
            return url.href;
        } catch { return null; }
    }

    function session() {
        try {
            const api = window.ApiClient;
            const token = api?.accessToken?.(), user = api?.getCurrentUserId?.();
            const server = new URL(api.serverAddress().replace(/\/?$/, '/'));
            if (typeof token !== 'string' || !token || typeof user !== 'string' || !user
                || server.origin !== location.origin || server.pathname.replace(/\/$/, '') !== basePath) return null;
            return { token, key: user + '\n' + token };
        } catch { return null; }
    }

    function reset(key) {
        if (currentSession === key) return;
        currentSession = key; generation++;
        for (const entry of cache.values()) if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl);
        cache.clear(); totalBytes = 0;
    }

    function trim() {
        for (const [key, entry] of cache) {
            if (cache.size <= maxEntries && totalBytes <= maxBytes) break;
            if (!entry.objectUrl) continue;
            URL.revokeObjectURL(entry.objectUrl); totalBytes -= entry.size; cache.delete(key);
        }
    }

    function pump() {
        while (active < 6 && queue.length) {
            const task = queue.shift(); active++;
            task().finally(() => { active--; pump(); });
        }
    }

    async function imageBlob(url, auth) {
        reset(auth.key);
        const found = cache.get(url);
        if (found) { cache.delete(url); cache.set(url, found); return found.promise; }
        if (queue.length >= 384) throw new Error('image queue full');
        const ownGeneration = generation;
        const entry = {};
        entry.promise = new Promise((resolve, reject) => {
            queue.push(async () => {
                try {
                    if (ownGeneration !== generation) throw new Error('session changed');
                    const response = await nativeFetch(url, { headers: { Authorization: 'MediaBrowser Token="' + auth.token + '"' },
                        credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
                    if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().startsWith('image/')) throw new Error('image denied');
                    const reader = response.body.getReader(), chunks = []; let size = 0;
                    while (true) {
                        const part = await reader.read(); if (part.done) break;
                        size += part.value.byteLength;
                        if (size > 16 * 1024 * 1024 || ownGeneration !== generation) { await reader.cancel(); throw new Error('image unavailable'); }
                        chunks.push(part.value);
                    }
                    if (ownGeneration !== generation) throw new Error('session changed');
                    entry.size = size; entry.objectUrl = URL.createObjectURL(new Blob(chunks, { type: response.headers.get('Content-Type') }));
                    totalBytes += size; trim(); resolve(entry.objectUrl);
                } catch (error) { if (cache.get(url) === entry) cache.delete(url); reject(error); }
            });
            pump();
        });
        cache.set(url, entry);
        return entry.promise;
    }

    async function applyImage(element, url, state) {
        let auth = session();
        // The adapter loads before Jellyfin itself. Wait briefly for its API
        // client, rather than sending an anonymous image request first.
        for (let attempt = 0; !auth && attempt < 80 && states.get(element) === state; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 100)); auth = session();
        }
        if (states.get(element) !== state) return;
        if (!auth) { element.dispatchEvent(new Event('error')); return; }
        try {
            const objectUrl = await imageBlob(url, auth);
            if (states.get(element) !== state || session()?.key !== auth.key) return;
            nativeSrc.set.call(element, objectUrl);
        } catch {
            if (states.get(element) === state) element.dispatchEvent(new Event('error'));
        }
    }

    function intercept(element, value) {
        const url = protectedUrl(value);
        if (!url) { states.delete(element); return false; }
        const state = { source: url }; states.set(element, state);
        void applyImage(element, url, state);
        return true;
    }

    Object.defineProperty(HTMLImageElement.prototype, 'src', { ...nativeSrc,
        set(value) { if (!intercept(this, value)) nativeSrc.set.call(this, value); } });
    Element.prototype.setAttribute = function(name, value) {
        if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src' && intercept(this, String(value))) return;
        return nativeSetAttribute.call(this, name, value);
    };

    // CSS backgrounds set directly (rather than through Jellyfin's image
    // preloader) also occur in Cinema. Only inline same-origin image URLs.
    function background(element) {
        const value = element.style?.backgroundImage;
        if (!value || !value.includes('url(')) return;
        const match = /^url\(["']?(.*?)["']?\)$/.exec(value);
        const url = match && protectedUrl(match[1]);
        const auth = url && session();
        if (!auth) return;
        imageBlob(url, auth).then(objectUrl => {
            if (element.style.backgroundImage === value && session()?.key === auth.key) element.style.backgroundImage = 'url("' + objectUrl + '")';
        }).catch(() => {});
    }
    function scan(element) {
        if (element instanceof HTMLImageElement && !states.has(element)) {
            const source = element.getAttribute('src');
            if (source) intercept(element, source);
        }
        background(element);
    }
    new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') scan(record.target);
            else for (const node of record.addedNodes) if (node.nodeType === 1) {
                scan(node); for (const element of node.querySelectorAll('[style], img[src]')) scan(element);
            }
        }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'src'] });
    setInterval(() => { const auth = session(); if (!auth || auth.key !== currentSession) reset(auth?.key || ''); }, 1000);
})();

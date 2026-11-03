/* Early presentation defaults; no authentication or playback changes. GPL-2.0-or-later. */
(() => {
    'use strict';
    if (window.__nativeCinemaBoot) return;
    window.__nativeCinemaBoot = true;
    const root = document.documentElement;
    let disabled = false;
    try {
        const mode = new URL(location.href).searchParams.get('cinema');
        if (mode === 'off') localStorage.setItem('jellyfin-native-cinema-disabled', '1');
        if (mode === 'on') localStorage.removeItem('jellyfin-native-cinema-disabled');
        disabled = localStorage.getItem('jellyfin-native-cinema-disabled') === '1';
    } catch { /* Private browsing can disallow persistent preferences. */ }
    root.classList.toggle('native-cinema-disabled', disabled);
    if (disabled) return;
    root.classList.add('native-cinema-enabled', 'native-cinema-boot');
    let loading;
    window.__nativeCinemaReady = () => { root.classList.remove('native-cinema-boot'); loading?.remove(); };
    function loadingScreen() {
        if (!root.classList.contains('native-cinema-boot')) return;
        loading = document.createElement('div'); loading.className = 'native-cinema-loading'; loading.dataset.nativeCinemaOwned = '';
        loading.setAttribute('role', 'status'); loading.setAttribute('aria-label', 'Cinema wird geladen');
        const hero = document.createElement('div'); hero.className = 'native-cinema-loading-hero';
        const row = document.createElement('div'); row.className = 'native-cinema-loading-row';
        for (let i = 0; i < 7; i++) row.append(document.createElement('span'));
        loading.append(hero, row); document.body.append(loading);
        setTimeout(() => {
            if (!root.classList.contains('native-cinema-boot') || !loading?.isConnected) return;
            const help = document.createElement('p'); help.textContent = 'Das Laden dauert länger als erwartet.';
            const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Erneut laden'; retry.onclick = () => location.reload();
            loading.append(help, retry);
        }, 10000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadingScreen, { once: true });
    else loadingScreen();

    function thumbnailDefault(targetHash = location.hash) {
        try {
            const hash = targetHash.slice(1), route = hash.split('?')[0];
            if (!['/tv', '/movies'].includes(route)) return;
            const params = new URLSearchParams(hash.split('?')[1] || '');
            const library = params.get('topParentId');
            if (library && !/^[a-f0-9]{32}$/i.test(library.replaceAll('-', ''))) return;
            // This is Jellyfin's own useLocalStorage view-settings key.
            const key = (route === '/tv' ? 'series' : 'movies') + ' - ' + library;
            const marker = 'native-cinema-thumb-default-v1:' + key;
            const raw = localStorage.getItem(key);
            if (raw && raw.length > 16384) return;
            const value = raw ? JSON.parse(raw) : {};
            if (!value || Array.isArray(value) || typeof value !== 'object') return;
            if (localStorage.getItem(marker) && Array.isArray(value.SortBy)) return;
            // Jellyfin reads a saved record as a complete view configuration,
            // so retain its native default schema when creating a new record.
            const settings = { ShowTitle: true, ShowYear: true, CardLayout: false,
                SortBy: ['SortName'], SortOrder: 'Ascending', StartIndex: 0,
                ...value, ImageType: 'Thumb', ViewMode: 'grid' };
            if (!Array.isArray(settings.SortBy)) settings.SortBy = ['SortName'];
            const next = JSON.stringify(settings);
            localStorage.setItem(key, next);
            localStorage.setItem(marker, '1');
            window.dispatchEvent(new StorageEvent('storage', { key, newValue: next, storageArea: localStorage }));
        } catch { /* Keep the native defaults if storage is not available. */ }
    }
    thumbnailDefault();
    window.addEventListener('hashchange', () => thumbnailDefault(), { capture: true });
    window.addEventListener('popstate', () => thumbnailDefault(), { capture: true });
    document.addEventListener('click', event => {
        const link = event.target.closest?.('a[href]'); if (!link) return;
        try {
            const url = new URL(link.href, location.href);
            if (url.origin === location.origin && url.pathname === location.pathname) thumbnailDefault(url.hash);
        } catch { /* Unrelated links keep their normal behavior. */ }
    }, { capture: true });
})();

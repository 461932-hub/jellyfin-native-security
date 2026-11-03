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

    // Jellyfin 12.4's native library routes share these view-settings keys.
    // Seed every tab before React mounts it, including tabs changed by pushState.
    const libraryRoutes = new Set(['/books', '/boxsets', '/movies', '/music', '/tv',
        '/homevideos', '/musicvideos', '/playlists', '/mixed', '/livetv']);
    const libraryViews = new Set(['albums', 'albumartists', 'artists', 'authors',
        'books', 'channels', 'collections', 'episodes', 'favorites', 'folders',
        'genres', 'mixed', 'movies', 'musicvideos', 'photoalbums', 'photos',
        'playlists', 'recordings', 'series', 'songs', 'studios', 'suggestions',
        'upcoming', 'videos']);
    const validContext = value => value === 'null' || value === 'livetv' ||
        /^[a-f0-9]{32}$/i.test(value) || /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
    function migrateView(view, context) {
        try {
            const key = view + ' - ' + context;
            const marker = 'native-cinema-thumb-default-v2:' + key;
            const raw = localStorage.getItem(key);
            if (raw && raw.length > 16384) return;
            const value = raw ? JSON.parse(raw) : {};
            if (!value || Array.isArray(value) || typeof value !== 'object') return;
            if (raw && localStorage.getItem(marker)) return;
            // A saved record must contain the complete native renderer schema.
            // Preserve sorting, filters, list layout and an existing custom image
            // choice. Only the previous Primary default changes once to Thumb.
            const sortBy = view === 'episodes' ? ['SeriesSortName'] : ['SortName'];
            const settings = { ShowTitle: true, ShowYear: true, CardLayout: false,
                SortBy: sortBy, SortOrder: 'Ascending', StartIndex: 0,
                ViewMode: view === 'songs' ? 'list' : 'grid', ...value };
            if (!settings.ImageType || settings.ImageType === 'Primary') settings.ImageType = 'Thumb';
            if (!Array.isArray(settings.SortBy)) settings.SortBy = sortBy;
            const next = JSON.stringify(settings);
            if (next !== raw) {
                localStorage.setItem(key, next);
                window.dispatchEvent(new StorageEvent('storage', { key, oldValue: raw,
                    newValue: next, storageArea: localStorage }));
            }
            localStorage.setItem(marker, '1');
        } catch { /* Unavailable or invalid storage keeps its native behavior. */ }
    }
    function thumbnailDefault(targetHash = location.hash) {
        try {
            const hash = targetHash.slice(1), route = hash.split('?')[0];
            if (!libraryRoutes.has(route)) return;
            const params = new URLSearchParams(hash.split('?')[1] || '');
            const context = params.get('collectionType') === 'livetv' ? 'livetv' :
                (params.get('topParentId') || 'null');
            if (!validContext(context)) return;
            for (const view of libraryViews) migrateView(view, context);
        } catch { /* Unrelated routes keep their normal behavior. */ }
    }
    // Existing library settings (including the old v1 marker) are migrated even
    // if the first page is Home. Never read unrelated storage such as credentials.
    try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            const match = /^([a-z]+) - ([a-f0-9-]+|null|livetv)$/i.exec(key);
            if (match && libraryViews.has(match[1]) && validContext(match[2])) migrateView(match[1], match[2]);
        }
        for (const view of libraryViews) migrateView(view, 'null');
    } catch { /* Browser storage is optional. */ }
    function alphabetPage(targetHash = location.hash) {
        const hash = targetHash.slice(1), route = hash.split('?')[0];
        const params = new URLSearchParams(hash.split('?')[1] || '');
        const context = params.get('collectionType') === 'livetv' ? 'livetv' : (params.get('topParentId') || 'null');
        const library = libraryRoutes.has(route) && validContext(context) ? context : null;
        return { key: route + ':' + library + ':' + (params.get('tab') || '0'), library };
    }
    function clearAlphabet(context) {
        if (context === null) return;
        for (const view of libraryViews) {
            try {
                const key = view + ' - ' + context, raw = localStorage.getItem(key);
                if (!raw || raw.length > 16384) continue;
                const value = JSON.parse(raw);
                if (!value || Array.isArray(value) || typeof value !== 'object' || !value.Alphabet) continue;
                const next = JSON.stringify({ ...value, Alphabet: null, StartIndex: 0 });
                localStorage.setItem(key, next);
                window.dispatchEvent(new StorageEvent('storage', { key, oldValue: raw,
                    newValue: next, storageArea: localStorage }));
            } catch { /* Other native view preferences remain intact. */ }
        }
    }
    let previousAlphabetPage = null;
    function syncAlphabetPage() {
        const next = alphabetPage();
        if (previousAlphabetPage?.key === next.key) return;
        // Track committed routes, so an information popup that prevents link
        // navigation does not unexpectedly clear the current letter filter.
        const previous = previousAlphabetPage; previousAlphabetPage = next;
        if (previous) clearAlphabet(previous.library);
        clearAlphabet(next.library);
    }
    window.__nativeCinemaRouteChanged = syncAlphabetPage;
    thumbnailDefault();
    syncAlphabetPage();
    window.addEventListener('hashchange', syncAlphabetPage, { capture: true });
    window.addEventListener('popstate', syncAlphabetPage, { capture: true });
    // Defer past the whole click dispatch, including native router/default handlers.
    document.addEventListener('click', () => setTimeout(syncAlphabetPage, 0), { capture: true });
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

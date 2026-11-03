/* Cinema presentation for the original Jellyfin web client. GPL-2.0-or-later.
 * Existing links, buttons, menus and the native player keep their handlers.
 */
(() => {
    'use strict';
    if (window.__jellyfinNativeCinema) return;
    const script = document.currentScript;
    let scriptUrl;
    try { scriptUrl = new URL(script.src, location.href); } catch { return; }
    const suffix = '/web/cinema-native.js';
    if (scriptUrl.origin !== location.origin || !scriptUrl.pathname.endsWith(suffix)) return;
    const base = scriptUrl.pathname.slice(0, -suffix.length);
    const root = document.documentElement;
    const preference = 'jellyfin-native-cinema-disabled';
    let disabled = false;
    try {
        const mode = new URL(location.href).searchParams.get('cinema');
        if (mode === 'off') localStorage.setItem(preference, '1');
        if (mode === 'on') localStorage.removeItem(preference);
        disabled = localStorage.getItem(preference) === '1';
    } catch { /* Private browsing may not provide persistent preferences. */ }
    root.classList.toggle('native-cinema-disabled', disabled);
    if (disabled) return;
    root.classList.add('native-cinema-enabled');
    window.__jellyfinNativeCinema = true;

    const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id.replaceAll('-', ''));
    const cache = new Map(), enhanced = new WeakMap();
    let sessionKey = '', generation = 0, hero = null, heroKey = '', timer;
    let pending = false, followup = false, retryAfter = 0, controller = new AbortController();

    function session() {
        try {
            const api = window.ApiClient;
            const token = api?.accessToken?.(), user = api?.getCurrentUserId?.();
            const server = new URL(api.serverAddress());
            if (!token || !validId(user) || server.origin !== location.origin
                || server.pathname.replace(/\/$/, '') !== base) return null;
            return { token, user, key: user + '\n' + token };
        } catch { return null; }
    }

    function reset(key) {
        if (key === sessionKey) return;
        sessionKey = key; generation++; retryAfter = 0;
        controller.abort(); controller = new AbortController(); cache.clear();
        hero?.remove(); hero = null; heroKey = '';
        for (const image of document.querySelectorAll('img.native-cinema-art')) image.remove();
        for (const card of document.querySelectorAll('[data-native-cinema-wide]')) {
            card.removeAttribute('data-native-cinema-wide');
            card.removeAttribute('data-native-cinema-ready');
        }
    }

    function activePage() {
        return [...document.querySelectorAll('.mainAnimatedPage')].find(page =>
            !page.classList.contains('hide') && page.getBoundingClientRect().height > 0
            && getComputedStyle(page).display !== 'none');
    }

    function visible(card) {
        const rect = card.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom >= -100 && rect.top <= innerHeight + 300;
    }

    async function metadata(ids, auth) {
        const missing = ids.filter(id => !cache.has(id)).slice(0, 24);
        if (missing.length) {
            const url = new URL(base + '/Users/' + encodeURIComponent(auth.user) + '/Items', location.origin);
            url.search = new URLSearchParams({ Ids: missing.join(','), Recursive: 'true', Limit: String(missing.length),
                Fields: 'Overview,Genres', EnableImageTypes: 'Primary,Thumb,Backdrop,Logo', EnableUserData: 'true' });
            const response = await fetch(url, { headers: { Authorization: 'MediaBrowser Token="' + auth.token + '"' },
                credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal });
            if (!response.ok) throw new Error('metadata unavailable');
            const reader = response.body.getReader(), chunks = []; let bytes = 0;
            while (true) {
                const part = await reader.read(); if (part.done) break;
                bytes += part.value.byteLength;
                if (bytes > 2097152) { await reader.cancel(); throw new Error('metadata limit'); }
                chunks.push(part.value);
            }
            const data = JSON.parse(await new Blob(chunks).text());
            if (session()?.key !== auth.key) return [];
            for (const id of missing) cache.set(id, null);
            for (const item of data.Items || []) if (validId(item.Id) && missing.includes(item.Id)) cache.set(item.Id, item);
            while (cache.size > 256) cache.delete(cache.keys().next().value);
        }
        return ids.map(id => cache.get(id)).filter(Boolean);
    }

    function imageUrl(item, type, width) {
        const url = new URL(base + '/Items/' + encodeURIComponent(item.Id) + '/Images/' + type
            + (type === 'Backdrop' ? '/0' : ''), location.origin);
        url.search = new URLSearchParams({ maxWidth: String(width), quality: '90' });
        // Native image-client.js adds the authentication header and handles logout.
        // No session token, playback grant or user identifier is placed in this URL.
        return url.href;
    }

    function landscape(item) {
        if (item.ImageTags?.Thumb) return 'Thumb';
        if (item.BackdropImageTags?.length) return 'Backdrop';
        return 'Primary';
    }

    function enhanceCard(card, item, ownGeneration) {
        if (!['Movie', 'Series', 'Episode'].includes(item.Type)) return;
        if (enhanced.get(card) === ownGeneration) return;
        const container = card.querySelector('.cardImageContainer:not(.cardOverlayContainer .cardImageContainer)');
        if (!container) return;
        enhanced.set(card, ownGeneration);
        if (['Movie', 'Series'].includes(item.Type)) card.setAttribute('data-native-cinema-wide', '');
        const image = new Image(); image.className = 'native-cinema-art';
        image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.decoding = 'async';
        image.onload = () => {
            if (ownGeneration === generation && card.isConnected) card.setAttribute('data-native-cinema-ready', '');
        };
        image.onerror = () => image.remove();
        container.append(image); image.src = imageUrl(item, landscape(item), 900);
    }

    function element(tag, className, text) {
        const node = document.createElement(tag); node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function showHero(page, card, item, ownGeneration, artwork = item) {
        const key = page.id + ':' + item.Id + ':' + artwork.Id;
        if (heroKey === key && hero?.isConnected) return;
        hero?.remove(); heroKey = key;
        const section = element('section', 'native-cinema-hero');
        section.dataset.nativeCinemaOwned = ''; section.setAttribute('aria-label', artwork.Name || 'Vorschau');
        const image = element('img', 'native-cinema-hero-image'); image.alt = ''; image.setAttribute('aria-hidden', 'true');
        const shade = element('div', 'native-cinema-hero-shade');
        const copy = element('div', 'native-cinema-hero-copy');
        const title = element('h1', 'native-cinema-hero-title', artwork.Name || '');
        const logo = element('img', 'native-cinema-hero-logo'); logo.alt = artwork.Name || ''; logo.hidden = true;
        if (artwork.ImageTags?.Logo) {
            logo.onload = () => { if (generation === ownGeneration) { logo.hidden = false; title.hidden = true; } };
            logo.src = imageUrl(artwork, 'Logo', 800);
        }
        const facts = [artwork.Genres?.slice(0, 2).join(' / '), artwork.ProductionYear, artwork.OfficialRating].filter(Boolean);
        const meta = element('div', 'native-cinema-hero-meta', facts.join('  ·  '));
        const text = element('p', 'native-cinema-hero-overview');
        // Metadata is text, never a second HTML document or remote resource.
        if (artwork.Overview) text.textContent = String(artwork.Overview).replace(/<[^>]*>/g, '');
        const actions = element('div', 'native-cinema-hero-actions');
        const nativePlay = card.querySelector('button[data-action="play"],button[data-action="resume"]');
        if (nativePlay) {
            const play = element('button', 'native-cinema-primary', '▶  Abspielen'); play.type = 'button';
            play.disabled = nativePlay.disabled;
            play.addEventListener('click', () => {
                if (ownGeneration !== generation || session()?.key !== sessionKey) return;
                const current = [...page.querySelectorAll('.card[data-id]')].find(node => node.dataset.id === item.Id);
                current?.querySelector('button[data-action="play"],button[data-action="resume"]')?.click();
            });
            actions.append(play);
        }
        const nativeLink = card.querySelector('a[href*="#/details?"]');
        if (nativeLink) {
            const info = element('a', 'native-cinema-secondary', 'Mehr Infos');
            info.href = nativeLink.getAttribute('href');
            actions.append(info);
        }
        copy.append(logo, title, meta, text, actions);
        section.append(image, shade, copy);
        const home = page.querySelector('#homeTab.is-active');
        (home || page).prepend(section); hero = section;
        image.src = imageUrl(artwork, artwork.BackdropImageTags?.length ? 'Backdrop' : landscape(artwork), 1920);
        image.onerror = () => {
            if (section.isConnected) { section.remove(); if (hero === section) { hero = null; heroKey = ''; } }
        };
    }

    async function refresh() {
        if (pending) { followup = true; return; }
        pending = true;
        try {
            const auth = session(); reset(auth?.key || '');
            const page = activePage();
            if (!auth || !page || document.hidden || Date.now() < retryAfter) return;
            const ownGeneration = generation;
            const cards = [...page.querySelectorAll('.card[data-id]')].filter(card =>
                validId(card.dataset.id) && ['Movie', 'Series', 'Episode'].includes(card.dataset.type));
            const eligible = ['indexPage', 'moviesPage', 'tvshowsPage'].includes(page.id)
                && (!page.querySelector('#favoritesTab.is-active'));
            const first = eligible ? cards[0] : null;
            const requested = [...new Set([first?.dataset.id, ...cards.filter(visible).map(card => card.dataset.id)].filter(Boolean))].slice(0, 24);
            const items = await metadata(requested, auth);
            if (generation !== ownGeneration || session()?.key !== auth.key || activePage() !== page) return;
            for (const item of items) for (const card of cards) if (card.dataset.id === item.Id) enhanceCard(card, item, ownGeneration);
            if (first) {
                const item = items.find(item => item.Id === first.dataset.id);
                if (item) {
                    const series = item.Type === 'Episode' && validId(item.SeriesId) ? (await metadata([item.SeriesId], auth))[0] : null;
                    if (generation === ownGeneration && session()?.key === auth.key && activePage() === page) showHero(page, first, item, ownGeneration, series || item);
                }
            } else { hero?.remove(); hero = null; heroKey = ''; }
        } catch { retryAfter = Date.now() + 5000; /* Native pages remain usable. */ }
        finally { pending = false; if (followup) { followup = false; schedule(); } }
    }

    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 140); }
    function scroll() {
        root.classList.toggle('native-cinema-scrolled', (activePage()?.scrollTop || scrollY) > 24);
        root.classList.toggle('native-cinema-catalog-visible', !hero?.isConnected
            || hero.getBoundingClientRect().bottom <= (document.querySelector('header.MuiAppBar-root')?.getBoundingClientRect().bottom || 0) + 24);
        schedule();
    }
    const observer = new MutationObserver(records => {
        if (records.some(record => !record.target.closest?.('[data-native-cinema-owned],.native-cinema-art')
            && [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1
                && !node.matches?.('[data-native-cinema-owned],.native-cinema-art')))) schedule();
    });
    function start() {
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('scroll', scroll, { capture: true, passive: true });
        window.addEventListener('hashchange', () => { scroll(); schedule(); });
        document.addEventListener('visibilitychange', schedule);
        setInterval(() => { if ((session()?.key || '') !== sessionKey) schedule(); }, 1200);
        schedule();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();

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
    let hover = null, hoverCard = null, pendingHoverCard = null, hoverTimer, leaveTimer, hoverTicket = 0;
    let lastPointer = null, scrollHoverTimer, hoverOpening = null, hoverClosing = null;
    let heroSnap = null;
    let details = null, detailsAbort = null, detailsTicket = 0;

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
        hideHover(); closeDetails(false);
        destroyHeroSnap(); hero?.remove(); hero = null; heroKey = '';
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

    function cardImageUrl(item, width) {
        // Seasons often only own a portrait poster. Prefer the parent's existing
        // horizontal artwork before falling back to that poster in a 16:9 box.
        if (item.Type === 'Season' && !item.ImageTags?.Thumb && !item.BackdropImageTags?.length) {
            if (validId(item.ParentThumbItemId)) return imageUrl({ Id: item.ParentThumbItemId }, 'Thumb', width);
            if (validId(item.ParentBackdropItemId)) return imageUrl({ Id: item.ParentBackdropItemId }, 'Backdrop', width);
        }
        return imageUrl(item, landscape(item), width);
    }

    function enhanceCard(card, item, ownGeneration) {
        if (!['Movie', 'Series', 'Episode', 'Season'].includes(item.Type)) return;
        if (item.Type === 'Season' && !card.closest('#homeTab')) return;
        // The native thumbnail grid already requests the correct artwork and
        // reserves its dimensions. Keep React-owned library images unchanged.
        if (card.closest('#moviesPage,#tvshowsPage')) return;
        if (enhanced.get(card) === ownGeneration && card.querySelector('.native-cinema-art')) return;
        const container = card.querySelector('.cardImageContainer:not(.cardOverlayContainer .cardImageContainer)');
        if (!container) return;
        enhanced.set(card, ownGeneration);
        card.setAttribute('data-native-cinema-wide', '');
        const image = new Image(); image.className = 'native-cinema-art';
        image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.decoding = 'async';
        image.onload = () => {
            if (ownGeneration === generation && card.isConnected) card.setAttribute('data-native-cinema-ready', '');
        };
        image.onerror = () => image.remove();
        container.append(image); image.src = cardImageUrl(item, 900);
    }

    function element(tag, className, text) {
        const node = document.createElement(tag); node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function currentCard(id, hint) {
        if (hint?.isConnected && hint.dataset.id === id) return hint;
        return [...(activePage()?.querySelectorAll('.card[data-id]') || [])].find(card => card.dataset.id === id);
    }

    function originalButton(id, action, hint) {
        const card = currentCard(id, hint);
        if (!card) return null;
        if (action === 'play') return card.querySelector('button[data-action="play"],button[data-action="resume"]');
        if (action === 'favorite') return card.querySelector('button[is="emby-ratingbutton"],button:has([data-testid="FavoriteIcon"]),button:has([data-testid="FavoriteBorderIcon"])');
        return card.querySelector('button[data-action="menu"],button:has([data-testid="MoreVertIcon"])');
    }

    function playOriginal(item, hint) {
        const button = originalButton(item.Id, 'play', hint);
        if (button) { if (!button.disabled) button.click(); return; }
        // Episode rows may not have a card on the underlying page. Dispatch the
        // native item command, as Cinema did, instead of creating a player.
        const api = window.ApiClient, serverId = api?.serverId?.();
        if (serverId && validId(item.Id)) for (const context of document.querySelectorAll('.itemsContainer,.nowPlayingBar,.itemDetailPage .nameContainer')) {
            const commandButton = document.createElement('button');
            commandButton.type = 'button'; commandButton.hidden = true; commandButton.className = 'itemAction';
            Object.assign(commandButton.dataset, { action: 'play', id: item.Id, serverid: serverId,
                type: item.Type, mediatype: 'Video', isfolder: 'false', positionticks: '0' });
            context.append(commandButton);
            try {
                const command = new CustomEvent('command', { bubbles: true, cancelable: true, detail: { command: 'play' } });
                commandButton.dispatchEvent(command);
                if (command.defaultPrevented) return;
                const click = new MouseEvent('click', { bubbles: true, cancelable: true }); commandButton.dispatchEvent(click);
                if (click.defaultPrevented) return;
            } finally { commandButton.remove(); }
        }
        location.hash = '/details?id=' + encodeURIComponent(item.Id);
    }

    const paths = {
        play: 'M8 5v14l11-7z',
        favorite: 'M12 21l-1.45-1.32C5.4 15 2 12 2 8.5A5.5 5.5 0 0 1 12 5.1a5.5 5.5 0 0 1 10 3.4c0 3.5-3.4 6.5-8.55 11.18z',
        more: 'm6 9 6 6 6-6', close: 'm6 6 12 12M18 6 6 18', menu: 'M12 5h.01M12 12h.01M12 19h.01'
    };
    function actionIcon(kind, label, callback, primary = false) {
        const button = element('button', 'native-cinema-action' + (primary ? ' is-primary' : ''));
        button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
        const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[kind]);
        path.setAttribute('fill', ['play', 'favorite'].includes(kind) ? 'currentColor' : 'none');
        if (!['play', 'favorite'].includes(kind)) { path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linecap', 'round'); }
        svg.append(path); button.append(svg); button.addEventListener('click', callback); return button;
    }

    function mediaFacts(item) {
        const parts = [item.Type === 'Movie' ? 'Film' : item.Type === 'Episode' ? 'Folge' : 'Serie', item.OfficialRating];
        if (item.Type === 'Episode') parts.push([Number.isInteger(item.ParentIndexNumber) ? 'S' + item.ParentIndexNumber : '', Number.isInteger(item.IndexNumber) ? 'E' + item.IndexNumber : ''].filter(Boolean).join(' · '));
        if (item.RunTimeTicks) parts.push(Math.round(item.RunTimeTicks / 600000000) + ' Min.');
        else if (item.ProductionYear) parts.push(item.ProductionYear);
        return parts.filter(Boolean).join('  ·  ');
    }

    // Motion rules ported from the existing Cinema presentation (GPL-2.0-or-later).
    function growCard(panel, trigger, { enabled = true, duration = 420, view = window } = {}) {
      const skipped = () => ({ finished: Promise.resolve(), cancel() {} });
      if (!enabled || typeof panel.animate !== 'function' || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return skipped();
      const target = panel.getBoundingClientRect(), source = trigger.getBoundingClientRect();
      const width = target.width || parseFloat(panel.style.width), height = target.height;
      if (!(width > 0 && height > 0 && source.width > 0)) return skipped();
      const left = Number.isFinite(target.left) ? target.left : parseFloat(panel.style.left);
      const top = Number.isFinite(target.top) ? target.top : parseFloat(panel.style.top);
      const imageHeight = panel.querySelector('.native-cinema-hover-art')?.getBoundingClientRect().height || width * 9 / 16;
      const scale = source.width / width;
      if (scale >= 1) return skipped();
      const previousOverflow = panel.style.overflow;
      panel.style.overflow = 'hidden';
      panel.style.transformOrigin = '0 0';
      const motion = panel.animate([
        { transform: `translate(${source.left - left}px, ${source.top - top}px) scale(${scale})`,
          height: Math.min(height, imageHeight) + 'px' },
        { transform: 'translate(0px, 0px) scale(1)', height: height + 'px' }
      ], { duration, easing: 'cubic-bezier(.25,.1,.25,1)' });
      const body = panel.querySelector('.native-cinema-hover-body');
      const controls = typeof body?.animate === 'function' ? body.animate([
        { opacity: 0, transform: 'translateY(-8px)', offset: 0 },
        { opacity: 0, transform: 'translateY(-8px)', offset: .2 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 }
      ], { duration, easing: 'ease-out' }) : null;
      controls?.finished.catch(() => {});
      const cancel = () => { motion.cancel(); controls?.cancel(); panel.style.overflow = previousOverflow; };
      const finished = motion.finished.then(() => {}, () => {}).finally(cancel);
      return { finished, cancel };
    }
    function shrinkCard(panel, trigger, { duration = 260, view = window } = {}) {
      if (typeof panel.animate !== 'function' || view.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
      // Measure the visible card before cancelling an opening that is still in flight.
      const current = panel.getBoundingClientRect(), target = trigger.getBoundingClientRect();
      const width = parseFloat(panel.style.width) || panel.offsetWidth || current.width;
      if (!(width > 0 && current.width > 0 && current.height > 0 && target.width > 0 && target.height > 0)) return null;
      const left = parseFloat(panel.style.left), top = parseFloat(panel.style.top);
      const layoutLeft = Number.isFinite(left) ? left : current.left, layoutTop = Number.isFinite(top) ? top : current.top;
      const fromScale = current.width / width, toScale = target.width / width;
      const opacity = node => {
        const value = parseFloat(view.getComputedStyle?.(node).opacity);
        return Number.isFinite(value) ? value : 1;
      };
      panel.style.transformOrigin = '0 0';
      const motion = panel.animate([
        { transform: `translate(${current.left - layoutLeft}px, ${current.top - layoutTop}px) scale(${fromScale})`,
          height: current.height / fromScale + 'px', opacity: opacity(panel) },
        { transform: `translate(${target.left - layoutLeft}px, ${target.top - layoutTop}px) scale(${toScale})`,
          height: target.height / toScale + 'px', opacity: 0 }
      ], { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      const body = panel.querySelector('.native-cinema-hover-body');
      const bodyTransform = body ? view.getComputedStyle?.(body).transform || 'none' : 'none';
      const controls = typeof body?.animate === 'function' ? body.animate([
        { opacity: opacity(body), transform: bodyTransform, offset: 0 },
        { opacity: 0, transform: 'translateY(-8px)', offset: .55 },
        { opacity: 0, transform: 'translateY(-8px)', offset: 1 }
      ], { duration, easing: 'ease-out', fill: 'forwards' }) : null;
      controls?.finished.catch(() => {});
      const cancel = () => { motion.cancel(); controls?.cancel(); };
      return { finished: motion.finished.then(() => {}, () => {}), cancel };
    }
    function createDialogMotion(dialog,{view=window,source=null,onDismiss=()=>{},finishClose=()=>{}}={}) {
      let motion=null,timer=null,closing=false,dead=false,generation=0;
      const reduced=()=>view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const canAnimate=()=>typeof dialog.animate==='function'&&!reduced()&&!view.document.hidden;
      function clear(){view.clearTimeout(timer);timer=null;motion?.cancel();motion=null;}
      function finish(){if(dead)return;dead=true;++generation;clear();finishClose();}
      function sourceFrame(rect,target){
        if(!rect||!(rect.width>0&&rect.height>0&&target.width>0&&target.height>0))return null;
        if(![rect.left,rect.top,target.left,target.top].every(Number.isFinite))return null;
        const scale=rect.width/target.width;
        return{opacity:1,transform:`translate(${rect.left-target.left}px, ${rect.top-target.top}px) scale(${scale})`,
          clipPath:`inset(0px 0px ${Math.max(0,target.height-rect.height/scale)}px 0px)`};
      }
      function open(){
        if(dead||closing||!canAnimate())return;
        try{
          const origin=sourceFrame(source?.rect,dialog.getBoundingClientRect?.()||{});
          if(origin)dialog.style.transformOrigin='0 0';
          motion=dialog.animate([origin||{opacity:0,transform:'translateY(24px) scale(.88)'},{opacity:1,transform:'translate(0px, 0px) scale(1)',clipPath:'inset(0px 0px 0px 0px)'}],
            {duration:origin?800:360,easing:origin?'cubic-bezier(.4,0,.2,1)':'cubic-bezier(.16,1,.3,1)',fill:'both'});
          const current=motion,ticket=++generation;
          current.finished.then(()=>{if(!dead&&!closing&&ticket===generation){current.cancel();motion=null;}},()=>{});
        }catch{clear();}
      }
      function close(){
        if(dead||closing)return;closing=true;onDismiss();dialog.inert=true;dialog.classList.add('is-closing');
        if(!canAnimate()){finish();return;}
        // Sample before cancelling so an early close reverses from the visible size.
        const style=view.getComputedStyle(dialog),from={opacity:style.opacity||'1',transform:style.transform||'none',clipPath:style.clipPath||'inset(0px 0px 0px 0px)'};
        ++generation;clear();
        try{
          const node=source?.returnTarget;
          const rect=node?.isConnected?node.getBoundingClientRect():null;
          const visible=rect&&rect.bottom>0&&rect.top<view.innerHeight&&rect.right>0&&rect.left<view.innerWidth;
          const destination=visible?sourceFrame(rect,dialog.getBoundingClientRect()):null;
          motion=dialog.animate([from,destination?{...destination,opacity:0}:{opacity:0,transform:'translateY(24px) scale(.88)'}],
            {duration:destination?600:260,easing:'cubic-bezier(.4,0,.6,1)',fill:'both'});
          motion.finished.then(finish,finish);
          timer=view.setTimeout(finish,800);
        }catch{finish();}
      }
      function destroy(){if(dead)return;dead=true;++generation;clear();}
      return{open,close,destroy};
    }

    function finishHoverClosing(entry) {
        if (hoverClosing !== entry) return;
        hoverClosing = null; entry.motion.cancel(); entry.panel.remove();
    }
    function hideHover(smooth = false) {
        clearTimeout(hoverTimer); clearTimeout(leaveTimer); pendingHoverCard = null; hoverTicket++;
        const panel = hover, card = hoverCard, opening = hoverOpening;
        hover = null; hoverCard = null; hoverOpening = null;
        if (hoverClosing && (!smooth || panel)) finishHoverClosing(hoverClosing);
        if (!panel) { opening?.cancel(); return; }
        let motion = null;
        if (smooth && card?.isConnected && !document.hidden) {
            panel.classList.add('is-closing'); panel.inert = true; panel.setAttribute('aria-hidden', 'true');
            try { motion = shrinkCard(panel, card.querySelector('.cardScalable') || card); } catch { /* Remove immediately if motion is unavailable. */ }
        }
        // Sample the visible geometry for shrinking before cancelling growth.
        opening?.cancel();
        if (motion) {
            const entry = { panel, card, motion }; hoverClosing = entry;
            motion.finished.then(() => finishHoverClosing(entry), () => finishHoverClosing(entry));
        } else panel.remove();
    }
    function leaveHover() {
        const panel = hover;
        if (!panel) return;
        clearTimeout(leaveTimer);
        leaveTimer = setTimeout(() => { if (hover === panel) hideHover(true); }, 140);
    }
    function positionHover(panel, card) {
        const rect = card.querySelector('.cardScalable')?.getBoundingClientRect() || card.getBoundingClientRect();
        const width = Math.min(innerWidth - 24, Math.max(320, Math.min(480, rect.width * 1.5)));
        const headerBottom = document.querySelector('header.MuiAppBar-root')?.getBoundingClientRect().bottom || 0;
        panel.style.width = width + 'px';
        panel.style.left = Math.max(12, Math.min(innerWidth - width - 12, rect.x + rect.width / 2 - width / 2)) + 'px';
        panel.style.top = Math.max(headerBottom + 8, Math.min(innerHeight - panel.offsetHeight - 12, rect.top - 35)) + 'px';
    }
    function animateHover(panel, card) {
        return growCard(panel, card.querySelector('.cardScalable') || card);
    }
    async function showHover(card) {
        if (pendingHoverCard !== card) return;
        const auth = session(), ticket = ++hoverTicket, ownGeneration = generation;
        try {
            if (!auth || details || !card.isConnected) return;
            if ([...document.querySelectorAll('.MuiPopover-root')].some(node => !node.classList.contains('MuiModal-hidden') && node.getAttribute('aria-hidden') !== 'true'
                && [...node.querySelectorAll('.MuiPaper-root')].some(paper => getComputedStyle(paper).visibility !== 'hidden' && Number(getComputedStyle(paper).opacity) > .1))) return;
            const item = cache.get(card.dataset.id) || (await metadata([card.dataset.id], auth))[0];
            if (!item || ticket !== hoverTicket || ownGeneration !== generation || session()?.key !== auth.key || !card.isConnected) return;
            hideHover(); hoverCard = card;
            const panel = element('article', 'native-cinema-hover'); panel.dataset.nativeCinemaOwned = '';
            panel.setAttribute('aria-label', (item.Name || '') + ' – Vorschau');
            const art = element('button', 'native-cinema-hover-art'); art.type = 'button'; art.setAttribute('aria-label', 'Mehr Infos zu ' + (item.Name || 'diesem Titel'));
            const image = element('img', 'native-cinema-hover-image'); image.alt = '';
            image.src = imageUrl(item, landscape(item), 900);
            art.append(image); art.addEventListener('click', () => openDetails(item.Id, card, art));
            const actions = element('div', 'native-cinema-hover-actions');
            actions.append(actionIcon('play', 'Abspielen', () => { hideHover(); playOriginal(item, card); }, true));
            const favorite = originalButton(item.Id, 'favorite', card);
            if (favorite) actions.append(actionIcon('favorite', favorite.title || 'Favorit umschalten', () => { favorite.click(); }));
            const info = actionIcon('more', 'Mehr Infos', () => openDetails(item.Id, card, art)); info.classList.add('is-more'); actions.append(info);
            const body = element('div', 'native-cinema-hover-body');
            body.append(actions, element('strong', 'native-cinema-hover-name', item.SeriesName || item.Name),
                element('div', 'native-cinema-hover-meta', mediaFacts(item)), element('div', 'native-cinema-hover-genres', (item.Genres || []).slice(0, 3).join('  ·  ')));
            panel.append(art, body);
            panel.addEventListener('pointerenter', () => clearTimeout(leaveTimer)); panel.addEventListener('pointerleave', leaveHover);
            document.body.append(panel); hover = panel; positionHover(panel, card);
            hoverOpening = animateHover(panel, card);
        } catch { /* Keep native cards usable if extra metadata is unavailable. */ }
        finally { if (ticket === hoverTicket && pendingHoverCard === card) pendingHoverCard = null; }
    }
    function pointerOver(event) {
        if (!matchMedia('(hover: hover) and (pointer: fine)').matches || details || event.pointerType === 'touch') return;
        if (event.target.closest?.('.native-cinema-hover')) { if (hover?.contains(event.target)) clearTimeout(leaveTimer); return; }
        const card = event.target.closest?.('.card[data-id]');
        if (!card || !validId(card.dataset.id) || !['Movie', 'Series', 'Episode'].includes(card.dataset.type) || !activePage()?.contains(card)) return;
        if (document.querySelector('dialog[open]')) return;
        if (card === hoverCard && hover?.isConnected) { clearTimeout(leaveTimer); return; }
        if (card === pendingHoverCard) return;
        // Like Cinema's schedule(): shrink the previous preview immediately,
        // then wait for this card's independent opening deadline.
        hideHover(true); pendingHoverCard = card;
        hoverTimer = setTimeout(() => { hoverTimer = null; showHover(card); }, 550);
    }
    function pointerOut(event) {
        const card = event.target.closest?.('.card[data-id]');
        if (!card) return;
        if (card.contains(event.relatedTarget) || hover?.contains(event.relatedTarget)) return;
        if (pendingHoverCard === card) {
            clearTimeout(hoverTimer); hoverTimer = null; pendingHoverCard = null; hoverTicket++;
        }
        if (card === hoverCard) leaveHover();
    }

    async function readJson(path, auth, signal) {
        const response = await fetch(new URL(base + path, location.origin), { headers: { Authorization: 'MediaBrowser Token="' + auth.token + '"' },
            credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal });
        if (!response.ok) throw new Error('information unavailable');
        const reader = response.body.getReader(), chunks = []; let size = 0;
        while (true) {
            const part = await reader.read(); if (part.done) break;
            size += part.value.byteLength;
            if (size > 2097152) { await reader.cancel(); throw new Error('information limit'); }
            chunks.push(part.value);
        }
        return JSON.parse(await new Blob(chunks).text());
    }
    function dismissDetails(dialog) {
        if (details !== dialog) return;
        detailsTicket++; detailsAbort?.abort(); detailsAbort = null;
    }
    function finishDetails(dialog, restore) {
        if (details === dialog) details = null;
        dialog.cinemaMotion?.destroy(); dialog.close(); dialog.remove();
        if (restore && dialog.cinemaTrigger?.isConnected) dialog.cinemaTrigger.focus({ preventScroll: true });
    }
    function closeDetails(restore = true) {
        if (!details) return;
        const dialog = details; dialog.cinemaRestoreFocus = restore;
        if (!restore || !dialog.cinemaMotion) { dismissDetails(dialog); finishDetails(dialog, restore); return; }
        dialog.cinemaMotion.close();
    }

    function detailOrigin(id, card, trigger) {
        const preview = hoverCard?.dataset.id === id ? hover : null;
        const source = preview?.querySelector('.native-cinema-hover-art')
            || trigger?.closest?.('.native-cinema-hero') || card?.querySelector('.cardScalable') || card;
        const rect = source?.getBoundingClientRect();
        const image = source?.querySelector('img.native-cinema-hover-image,img.native-cinema-hero-image,img.native-cinema-art');
        let imageSrc;
        if (image?.src) {
            const url = new URL(image.src, location.href);
            // The authenticated image adapter displays local blob URLs. Reuse
            // that already loaded artwork while the protected details reload.
            if (url.origin === location.origin && (url.protocol === 'blob:' || url.pathname.startsWith(base + '/Items/'))) imageSrc = url.href;
        }
        return { rect: rect?.width > 0 && rect?.height > 0 ? rect : null, imageSrc,
            returnTarget: (!preview && trigger?.closest?.('.native-cinema-hero')) || card?.querySelector('.cardScalable') || card };
    }

    async function episodeSection(dialog, series, auth, ticket) {
        const section = element('section', 'native-cinema-episodes');
        const heading = element('h3', '', 'Folgen'); const select = element('select', 'native-cinema-season'); select.setAttribute('aria-label', 'Staffel');
        const rows = element('div', 'native-cinema-episode-rows'), status = element('p', 'native-cinema-info-status');
        const more = element('button', 'native-cinema-load-more', 'Weitere Folgen'); more.type = 'button'; more.hidden = true;
        section.append(heading, select, status, rows, more); dialog.querySelector('.native-cinema-info-body').append(section);
        let start = 0, seasonId = '', episodeTicket = 0;
        async function load(append = false) {
            const ownTicket = ++episodeTicket;
            if (!append) { start = 0; rows.replaceChildren(); }
            more.disabled = true; status.textContent = 'Folgen werden geladen …';
            try {
                const params = new URLSearchParams({ userId: auth.user, startIndex: String(start), limit: '30', fields: 'Overview', enableImageTypes: 'Primary', excludeLocationTypes: 'Virtual' });
                if (seasonId) params.set('seasonId', seasonId);
                const data = await readJson('/Shows/' + series.Id + '/Episodes?' + params, auth, detailsAbort.signal);
                if (details !== dialog || ticket !== detailsTicket || ownTicket !== episodeTicket || session()?.key !== auth.key) return;
                for (const episode of data.Items || []) {
                    if (!validId(episode.Id)) continue;
                    const row = element('button', 'native-cinema-episode'); row.type = 'button';
                    const image = element('img', 'native-cinema-episode-image'); image.alt = ''; image.loading = 'lazy'; image.src = imageUrl(episode, 'Primary', 400);
                    const text = element('span', 'native-cinema-episode-copy');
                    text.append(element('strong', '', (episode.IndexNumber ? episode.IndexNumber + '. ' : '') + episode.Name), element('span', '', String(episode.Overview || '').replace(/<[^>]*>/g, '')));
                    row.append(image, text); row.addEventListener('click', () => { closeDetails(false); playOriginal(episode); }); rows.append(row);
                }
                start += data.Items?.length || 0; more.hidden = !data.Items?.length || start >= (data.TotalRecordCount ?? start) || start >= 300;
                status.textContent = start ? '' : 'Keine Folgen verfügbar.';
            } catch { if (details === dialog && ticket === detailsTicket) status.textContent = 'Folgen konnten nicht geladen werden. Die originale Detailseite bleibt verfügbar.'; }
            finally { more.disabled = false; }
        }
        try {
            const data = await readJson('/Shows/' + series.Id + '/Seasons?userId=' + encodeURIComponent(auth.user), auth, detailsAbort.signal);
            if (details !== dialog || ticket !== detailsTicket || session()?.key !== auth.key) return;
            const all = element('option', '', 'Alle Staffeln'); all.value = ''; select.append(all);
            for (const season of data.Items || []) if (validId(season.Id)) { const option = element('option', '', season.Name); option.value = season.Id; select.append(option); }
            select.addEventListener('change', () => { seasonId = select.value; load(); }); more.addEventListener('click', () => load(true)); await load();
        } catch { status.textContent = 'Staffeln konnten nicht geladen werden. Die originale Detailseite bleibt verfügbar.'; }
    }

    async function openDetails(id, card, trigger) {
        const auth = session(); if (!auth || !validId(id)) return;
        // Capture the artwork before removing the hover card. The loading and
        // completed states use the same frame, so opening never starts tiny.
        const origin = detailOrigin(id, card, trigger);
        hideHover(); closeDetails(false); const ticket = ++detailsTicket;
        const dialog = element('dialog', 'native-cinema-info'); dialog.dataset.nativeCinemaOwned = '';
        dialog.cinemaTrigger = trigger?.isConnected ? trigger : currentCard(id, card)?.querySelector('a[href*="#/details?"]');
        dialog.setAttribute('aria-label', 'Filminformationen');
        const close = actionIcon('close', 'Schließen', () => closeDetails()); close.classList.add('native-cinema-info-close');
        const status = element('p', 'native-cinema-info-status', 'Informationen werden geladen …'); status.setAttribute('role', 'status');
        const loadingArt = element('div', 'native-cinema-info-art native-cinema-info-loading-art');
        loadingArt.setAttribute('aria-hidden', 'true');
        if (origin.imageSrc) { const image = element('img', 'native-cinema-info-image'); image.alt = ''; image.src = origin.imageSrc; loadingArt.append(image); }
        dialog.append(close, loadingArt, status); document.body.append(dialog); details = dialog; detailsAbort = new AbortController();
        dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetails(); });
        dialog.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); closeDetails(); } });
        dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDetails(); } });
        dialog.addEventListener('close', () => { if (details === dialog) closeDetails(false); });
        dialog.cinemaMotion = createDialogMotion(dialog, { source: origin, onDismiss: () => dismissDetails(dialog),
            finishClose: () => finishDetails(dialog, dialog.cinemaRestoreFocus !== false) });
        dialog.showModal(); dialog.cinemaMotion.open();
        try {
            const item = await readJson('/Users/' + auth.user + '/Items/' + id, auth, detailsAbort.signal);
            if (details !== dialog || ticket !== detailsTicket || session()?.key !== auth.key || item.Id !== id) return;
            status.remove(); loadingArt.remove(); dialog.setAttribute('aria-label', item.Name || 'Filminformationen');
            const art = element('div', 'native-cinema-info-art'), image = element('img', 'native-cinema-info-image'); image.alt = '';
            image.src = imageUrl(item, item.BackdropImageTags?.length ? 'Backdrop' : landscape(item), 1600);
            const copy = element('div', 'native-cinema-info-copy');
            const name = element('h2', 'native-cinema-info-name', item.Name); const logo = element('img', 'native-cinema-info-logo'); logo.alt = item.Name; logo.hidden = true;
            if (item.ImageTags?.Logo) { logo.onload = () => { logo.hidden = false; name.classList.add('visually-hidden'); }; logo.src = imageUrl(item, 'Logo', 800); }
            const actions = element('div', 'native-cinema-info-actions');
            const play = element('button', 'native-cinema-primary', '▶  Abspielen'); play.type = 'button';
            play.addEventListener('click', () => { closeDetails(false); playOriginal(item, card); }); actions.append(play);
            const favorite = originalButton(id, 'favorite', card);
            if (favorite) actions.append(actionIcon('favorite', favorite.title || 'Favorit umschalten', () => favorite.click()));
            const menu = originalButton(id, 'menu', card);
            if (menu) actions.append(actionIcon('menu', 'Jellyfin-Kontextmenü öffnen', () => { closeDetails(false); menu.click(); }));
            copy.append(logo, name, actions); art.append(image, element('div', 'native-cinema-info-shade'), copy);
            const body = element('div', 'native-cinema-info-body');
            body.append(element('p', 'native-cinema-info-facts', mediaFacts(item)), element('p', 'native-cinema-info-overview', String(item.Overview || '').replace(/<[^>]*>/g, '')));
            if (item.Genres?.length) body.append(element('p', 'native-cinema-info-genres', 'Genres: ' + item.Genres.join(', ')));
            const actors = (item.People || []).filter(person => ['Actor', 'Director'].includes(person.Type)).slice(0, 8).map(person => person.Name);
            if (actors.length) body.append(element('p', 'native-cinema-info-people', 'Besetzung & Mitwirkende: ' + actors.join(', ')));
            const original = element('a', 'native-cinema-original-details', 'Originale Detailseite öffnen'); original.href = '#/details?id=' + encodeURIComponent(id);
            original.addEventListener('click', () => closeDetails(false)); body.append(original);
            dialog.append(art, body);
            if (item.Type === 'Series') episodeSection(dialog, item, auth, ticket);
        } catch { if (details === dialog && ticket === detailsTicket) status.textContent = 'Informationen konnten nicht geladen werden. Bitte schließe das Fenster und versuche es erneut.'; }
    }

    function cardClick(event) {
        if (event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (event.target.closest?.('[data-native-cinema-owned],button,input,select,[role="checkbox"]')) return;
        const card = event.target.closest?.('.card[data-id]');
        if (!card || !validId(card.dataset.id) || !['Movie', 'Series', 'Episode'].includes(card.dataset.type) || !activePage()?.contains(card)) return;
        if ([...document.querySelectorAll('.itemSelectionPanel,.selectionCommandsPanel')].some(node => node.getBoundingClientRect().height > 0)) return;
        const link = event.target.closest?.('a[href*="#/details?"],.cardOverlayContainer[data-action="link"],.cardImageContainer[data-action="link"]');
        if (!link) return;
        event.preventDefault(); event.stopPropagation(); openDetails(card.dataset.id, card, link);
    }


    function createHeroSnap({scroller,header,hero,getSection,enabled=()=>true,onSnap=()=>{},view=scroller.ownerDocument.defaultView}) {
      const DURATION=240, QUIET_GAP=150;
      let dead=false,motion=null,frame=null,guard=false,lastCaptured=-Infinity;
      const now=()=>view.performance.now();
      function reset(){if(frame!==null)view.cancelAnimationFrame(frame);frame=null;motion=null;guard=false;}
      function geometry(){
        const section=getSection();if(!section||hero.hidden)return null;
        const target=scroller.scrollTop+section.getBoundingClientRect().top-scroller.getBoundingClientRect().top-header.getBoundingClientRect().height;
        const maximum=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
        return {section,target:Math.max(0,Math.min(maximum,target))};
      }
      function sync(){
        const layout=geometry();const show=!!getSection()&&(hero.hidden||!!layout&&layout.target>8&&scroller.scrollTop>=layout.target-2);
        scroller.classList.toggle('native-cinema-catalog-view',show);
      }
      function refresh(){
        const height=header.getBoundingClientRect().height||78;
        const viewport=scroller.clientHeight||view.innerHeight||900;
        for(const [name,value] of [['--native-cinema-header-height',height+'px'],['--native-cinema-viewport-height',viewport+'px']])
          if(scroller.style.getPropertyValue(name)!==value)scroller.style.setProperty(name,value);
        refreshHeroArtwork(hero);sync();
      }
      function snap(target,section){
        onSnap();guard=true;lastCaptured=now();
        const reduced=view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if(reduced){scroller.scrollTop=target;sync();return;}
        const entry={from:scroller.scrollTop,to:target,at:now(),section};motion=entry;
        function tick(time){
          frame=null;if(dead||motion!==entry)return;
          if(!enabled()||getSection()!==entry.section){reset();sync();return;}
          const fraction=Math.max(0,Math.min(1,(time-entry.at)/DURATION));
          scroller.scrollTop=entry.from+(entry.to-entry.from)*(1-Math.pow(1-fraction,3));sync();
          if(fraction<1)frame=view.requestAnimationFrame(tick);
          else{scroller.scrollTop=entry.to;motion=null;lastCaptured=now();sync();}
        }
        frame=view.requestAnimationFrame(tick);
      }
      function wheel(event){
        if(dead||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||!enabled()) {if(motion)reset();return;}
        if(Math.abs(event.deltaX)>=Math.abs(event.deltaY)||!event.deltaY)return;
        const path=event.composedPath?.()||[event.target];
        if(path.some(node=>node?.matches?.('input,textarea,select,[contenteditable],.alphaPicker,header,.MuiPopover-root,.MuiDialog-root,.mainDrawer,[role="dialog"],[role="menu"],.native-cinema-info,.native-cinema-hover')))return;
        const layout=geometry();if(!layout||layout.target<8)return;
        const time=now(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?scroller.clientHeight:1);
        if(motion||(guard&&time-lastCaptured<QUIET_GAP)){event.preventDefault();lastCaptured=time;return;}
        guard=false;
        const y=scroller.scrollTop,target=layout.target;
        if(delta>0){if(y<target-1){event.preventDefault();snap(target,layout.section);}return;}
        if(y>target+1){
          if(y+delta>target)return;
          // Finish this gesture at the first complete grid row. Its remaining
          // wheel momentum must not also open the hero above it.
          event.preventDefault();snap(target,layout.section);return;
        }
        if(y>1){event.preventDefault();snap(0,layout.section);}
      }
      function resize(){
        const grid=scroller.classList.contains('native-cinema-catalog-view'),before=geometry();
        const offset=grid&&before?Math.max(0,scroller.scrollTop-before.target):0;
        reset();refresh();
        if(grid){const after=geometry();if(after)scroller.scrollTop=after.target+offset;}
        sync();
      }
      function visibility(){if(scroller.ownerDocument.hidden)reset();}
      scroller.addEventListener('wheel',wheel,{passive:false});scroller.addEventListener('scroll',sync,{passive:true});view.addEventListener('resize',resize);
      scroller.ownerDocument.addEventListener('visibilitychange',visibility);
      const observer=view.ResizeObserver?new view.ResizeObserver(resize):null;observer?.observe(header);observer?.observe(scroller.element||scroller);refresh();
      function preserveCatalog(update){
        const before=geometry();const keep=enabled()&&before&&(scroller.scrollTop>=before.target-2||motion?.to===before.target);
        reset();update();refresh();
        if(keep){const after=geometry();if(after){scroller.scrollTop=after.target;guard=true;lastCaptured=now();}}
        sync();
      }
      return {refresh,reset,preserveCatalog,destroy(){if(dead)return;reset();dead=true;observer?.disconnect();scroller.removeEventListener('wheel',wheel);scroller.removeEventListener('scroll',sync);view.removeEventListener('resize',resize);scroller.ownerDocument.removeEventListener('visibilitychange',visibility);}};
    }

    function destroyHeroSnap() {
        if (!heroSnap) return;
        heroSnap.controller.destroy(); heroSnap.catalog.removeAttribute('data-native-cinema-catalog');
        heroSnap.page.classList.remove('native-cinema-hero-page', 'native-cinema-catalog-view');
        for (const key of ['--native-cinema-header-height','--native-cinema-viewport-height']) heroSnap.page.style.removeProperty(key);
        heroSnap = null;
    }
    function refreshHeroArtwork(node) {
        if (!node.cinemaArtwork || node.cinemaGeneration !== generation || !session()) return;
        const width = Math.min(3840, Math.max(640, Math.ceil(node.clientWidth * Math.min(3, devicePixelRatio || 1) / 320) * 320));
        if (node.cinemaImageWidth === width) return;
        node.cinemaImageWidth = width;
        const artwork = node.cinemaArtwork;
        node.querySelector('.native-cinema-hero-image').src = imageUrl(artwork, artwork.BackdropImageTags?.length ? 'Backdrop' : landscape(artwork), width);
    }
    function mountHeroSnap(page, node) {
        const header = [...document.querySelectorAll('header.MuiAppBar-root,.skinHeader')].find(node =>
            node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== 'hidden');
        const grid = page.querySelector('.itemsContainer');
        const catalog = page.querySelector('#homeTab.is-active .homeSectionsContainer') || grid?.closest('.padded-bottom-page') || grid;
        if (!header || !catalog || node.contains(catalog)) { refreshHeroArtwork(node); return; }
        if (heroSnap?.page === page && heroSnap.catalog === catalog && heroSnap.header === header) { heroSnap.controller.refresh(); return; }
        destroyHeroSnap();
        let element = page;
        while (element !== document.body && element !== document.documentElement) {
            if (/auto|scroll/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1) break;
            element = element.parentElement || document.documentElement;
        }
        const documentScroll = element === document.body || element === document.documentElement;
        if (documentScroll) element = document.scrollingElement;
        const events = documentScroll ? document : element;
        const scroller = { element, ownerDocument: document, classList: page.classList, style: page.style,
            get clientHeight() { return documentScroll ? document.documentElement.clientHeight || innerHeight : element.clientHeight; },
            get scrollHeight() { return element.scrollHeight; },
            get scrollTop() { return element.scrollTop; },
            set scrollTop(top) { element.scrollTo({ top, behavior: 'instant' }); },
            getBoundingClientRect() { return documentScroll ? { top: 0 } : element.getBoundingClientRect(); },
            addEventListener(...args) { events.addEventListener(...args); }, removeEventListener(...args) { events.removeEventListener(...args); }
        };
        page.classList.add('native-cinema-hero-page'); catalog.setAttribute('data-native-cinema-catalog', '');
        const controller = createHeroSnap({ scroller, header, hero: node, getSection: () => catalog.isConnected ? catalog : null,
            enabled: () => node.isConnected && activePage() === page && !details && !document.hidden && !!session(), onSnap: () => hideHover() });
        heroSnap = { page, catalog, header, controller };
    }

    function showHero(page, card, item, ownGeneration, artwork = item) {
        const key = page.id + ':' + item.Id + ':' + artwork.Id;
        if (heroKey === key && hero?.isConnected) { mountHeroSnap(page, hero); return; }
        destroyHeroSnap(); hero?.remove(); heroKey = key;
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
            info.addEventListener('click', event => {
                if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault(); openDetails(item.Id, card, info);
            });
            actions.append(info);
        }
        copy.append(logo, title, meta, text, actions);
        section.append(image, shade, copy);
        const home = page.querySelector('#homeTab.is-active');
        (home || page).prepend(section); hero = section;
        section.cinemaArtwork = artwork; section.cinemaGeneration = ownGeneration;
        mountHeroSnap(page, section);
        image.onerror = () => {
            if (section.isConnected) { if (hero === section) destroyHeroSnap(); section.remove(); if (hero === section) { hero = null; heroKey = ''; } }
        };
    }

    async function refresh() {
        if (pending) { followup = true; return; }
        pending = true;
        try {
            const auth = session(); reset(auth?.key || '');
            const page = activePage();
            if (!page || document.hidden) return;
            if (!auth) { window.__nativeCinemaReady?.(); root.classList.remove('native-cinema-boot'); return; }
            if (Date.now() < retryAfter) return;
            const ownGeneration = generation;
            const cards = [...page.querySelectorAll('.card[data-id]')].filter(card =>
                validId(card.dataset.id) && (['Movie', 'Series', 'Episode'].includes(card.dataset.type)
                    || (card.dataset.type === 'Season' && card.closest('#homeTab'))));
            const eligible = ['indexPage', 'moviesPage', 'tvshowsPage'].includes(page.id)
                && (!page.querySelector('#favoritesTab.is-active'));
            const first = eligible ? cards.find(card => card.dataset.type !== 'Season') : null;
            // Bound the viewport work set below the cache size. metadata() requests
            // only uncached IDs, at most 24 at a time; cached cards must not crowd
            // later rows out of that request budget.
            const requested = [...new Set([first?.dataset.id, ...cards.filter(visible).map(card => card.dataset.id)].filter(Boolean))].slice(0, 128);
            const items = await metadata(requested, auth);
            if (generation !== ownGeneration || session()?.key !== auth.key || activePage() !== page) return;
            if (requested.some(id => !cache.has(id))) followup = true;
            for (const item of items) for (const card of cards) if (card.dataset.id === item.Id) enhanceCard(card, item, ownGeneration);
            if (first) {
                const item = items.find(item => item.Id === first.dataset.id);
                if (item) {
                    const series = item.Type === 'Episode' && validId(item.SeriesId) ? (await metadata([item.SeriesId], auth))[0] : null;
                    if (generation === ownGeneration && session()?.key === auth.key && activePage() === page) showHero(page, first, item, ownGeneration, series || item);
                }
            } else { destroyHeroSnap(); hero?.remove(); hero = null; heroKey = ''; }
            page.dataset.nativeCinemaInitialized = 'true';
            window.__nativeCinemaReady?.(); root.classList.remove('native-cinema-boot');
        } catch { retryAfter = Date.now() + 5000; window.__nativeCinemaReady?.(); root.classList.remove('native-cinema-boot'); }
        finally { pending = false; if (followup) { followup = false; schedule(); } }
    }

    function schedule() { window.__nativeCinemaRouteChanged?.(); clearTimeout(timer); timer = setTimeout(refresh, 140); }
    function scroll() {
        hideHover();
        clearTimeout(scrollHoverTimer);
        if (lastPointer) scrollHoverTimer = setTimeout(() => {
            const target = document.elementFromPoint(lastPointer.x, lastPointer.y);
            if (target) pointerOver({ target, pointerType: lastPointer.type });
        }, 140);
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
        window.addEventListener('hashchange', () => { heroSnap?.controller.reset(); hideHover(); closeDetails(false); scroll(); schedule(); });
        document.addEventListener('pointerover', pointerOver);
        document.addEventListener('pointermove', event => { lastPointer = { x: event.clientX, y: event.clientY, type: event.pointerType }; }, { passive: true });
        document.addEventListener('pointerout', pointerOut);
        document.addEventListener('click', cardClick, true);
        document.addEventListener('keydown', event => { if (event.key === 'Escape') hideHover(); });
        window.addEventListener('resize', hideHover);
        document.addEventListener('visibilitychange', schedule);
        setInterval(() => { if ((session()?.key || '') !== sessionKey) schedule(); }, 1200);
        schedule();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();

const { app, BrowserWindow, ipcMain, screen, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { DEFAULT_CHANNELS } = require('./channels');
const { FREE_HOLIDAY_CHANNELS } = require('./free_channels');

// Prevent Chromium from throttling or suspending hidden background tabs/audio
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const DATA_FILE = app.isPackaged
  ? path.join(app.getPath('userData'), 'user_data.json')
  : path.join(__dirname, 'user_data.json');
const WIDGET_WIDTH = 720;
const MINI_HEIGHT = 68;
const COMPACT_HEIGHT = 200;
const EXPANDED_HEIGHT = 760;
const MAX_TRACK_HISTORY = 12;

let widgetWin = null;
let playerWin = null;
let alwaysOnTop = true;
let isPlaying = false;
let isMiniMode = false;
let isDrawerOpen = false;
let widgetScale = 1;
let currentVolume = 100;
let isMuted = false;
let savedWindowPos = null;
let trackHistory = [];
let channels = [...FREE_HOLIDAY_CHANNELS, ...DEFAULT_CHANNELS];
let favorites = ['2', '8', '34', '36', '51', '71', 'W1', 'W2'];
let currentChannel = channels.find(c => String(c.number) === '71') || channels[0];
let currentTheme = 'christmas';
let widgetOpacity = 1;
let musicReactiveLights = true;
let scrollLongTitles = true;
let showVisualizer = false;
let isTuningUntil = 0;
let latestUpdateInfo = null;
const GITHUB_RELEASES_API = 'https://api.github.com/repos/de4d5y/SiriusXmWidget/releases/latest';
const GITHUB_RELEASES_PAGE = 'https://github.com/de4d5y/SiriusXmWidget/releases';

function getStartupLoginOptions() {
  if (app.isPackaged) {
    const exePath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    return { path: exePath };
  }
  return {
    path: process.execPath,
    args: [path.resolve(__dirname)]
  };
}

function getLaunchAtStartup() {
  try {
    const opts = getStartupLoginOptions();
    return !!app.getLoginItemSettings(opts).openAtLogin;
  } catch (e) {
    return false;
  }
}

function setLaunchAtStartup(enabled) {
  try {
    const opts = getStartupLoginOptions();
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      ...opts
    });
    return getLaunchAtStartup();
  } catch (e) {
    console.error('Failed to update startup setting:', e);
    return false;
  }
}

function getSafeWindowPosition(pos, width, height) {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return null;
  try {
    const displays = screen.getAllDisplays();
    const visible = displays.some(d => {
      const wa = d.workArea;
      const overlapX = Math.min(pos.x + width, wa.x + wa.width) - Math.max(pos.x, wa.x);
      const overlapY = Math.min(pos.y + height, wa.y + wa.height) - Math.max(pos.y, wa.y);
      return overlapX >= 80 && overlapY >= 40;
    });
    return visible ? { x: Math.round(pos.x), y: Math.round(pos.y) } : null;
  } catch (e) {
    return null;
  }
}

function recordTrackHistory(title, artist, channel) {
  const cleanTitle = (title || '').trim();
  const cleanArtist = (artist || '').trim();
  if (!cleanTitle) return;
  const ignoredTitles = ['ready to stream', 'stream stopped', 'loading...', 'siriusxm'];
  if (ignoredTitles.includes(cleanTitle.toLowerCase())) return;

  const chName = channel ? channel.name : '';
  const chNum = channel ? String(channel.number) : '';
  const latest = trackHistory[0];
  if (
    latest &&
    latest.title.toLowerCase() === cleanTitle.toLowerCase() &&
    latest.artist.toLowerCase() === cleanArtist.toLowerCase()
  ) {
    return;
  }

  trackHistory.unshift({
    title: cleanTitle,
    artist: cleanArtist,
    channelName: chName,
    channelNumber: chNum,
    timestamp: Date.now()
  });

  if (trackHistory.length > MAX_TRACK_HISTORY) {
    trackHistory = trackHistory.slice(0, MAX_TRACK_HISTORY);
  }
  saveUserData();
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.webContents.send('history_update', trackHistory);
  }
}

async function applySxmAudioSettings() {
  if (!playerWin || playerWin.isDestroyed()) return;
  try {
    playerWin.webContents.setAudioMuted(!!isMuted);
    const volFraction = Math.max(0, Math.min(1, currentVolume / 100));
    await playerWin.webContents.executeJavaScript(`
      (function() {
        const mediaEls = document.querySelectorAll('audio, video');
        mediaEls.forEach(m => {
          if (Math.abs(m.volume - ${volFraction}) > 0.01) {
            m.volume = ${volFraction};
          }
          m.muted = ${!!isMuted};
        });
      })();
    `);
  } catch (e) {}
}

function loadUserData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      if (Array.isArray(data.favorites)) {
        favorites = data.favorites.map(String);
      }
      if (data.theme && typeof data.theme === 'string') {
        currentTheme = data.theme;
      }
      if (typeof data.widget_opacity === 'number') {
        widgetOpacity = Math.max(0.35, Math.min(1, data.widget_opacity));
      }
      if (typeof data.music_reactive_lights === 'boolean') {
        musicReactiveLights = data.music_reactive_lights;
      }
      if (typeof data.scroll_long_titles === 'boolean') {
        scrollLongTitles = data.scroll_long_titles;
      }
      if (typeof data.show_visualizer === 'boolean') {
        showVisualizer = data.show_visualizer;
      }
      if (typeof data.volume === 'number' && !Number.isNaN(data.volume)) {
        currentVolume = Math.max(0, Math.min(100, Math.round(data.volume)));
      }
      if (typeof data.is_muted === 'boolean') {
        isMuted = data.is_muted;
      }
      if (typeof data.mini_mode === 'boolean') {
        isMiniMode = data.mini_mode;
      }
      if (typeof data.widget_scale === 'number' && Number.isFinite(data.widget_scale)) {
        widgetScale = Math.max(0.75, Math.min(1.35, data.widget_scale));
      }
      if (data.window_pos && typeof data.window_pos.x === 'number' && typeof data.window_pos.y === 'number') {
        savedWindowPos = { x: data.window_pos.x, y: data.window_pos.y };
      }
      if (Array.isArray(data.track_history)) {
        trackHistory = data.track_history.slice(0, MAX_TRACK_HISTORY);
      }
      if (Array.isArray(data.custom_channels)) {
        const existingNums = new Set(channels.map(c => String(c.number)));
        for (const ch of data.custom_channels) {
          if (ch && ch.number && !existingNums.has(String(ch.number))) {
            channels.push(ch);
          }
        }
      }
      if (data.last_channel) {
        const found = channels.find(c => String(c.number) === String(data.last_channel));
        if (found) currentChannel = found;
      }
    } catch (e) {
      console.error('Failed to load user_data.json:', e);
    }
  }
}

function buildUserDataPayload() {
  const builtInNums = new Set([
    ...FREE_HOLIDAY_CHANNELS.map(c => String(c.number)),
    ...DEFAULT_CHANNELS.map(c => String(c.number))
  ]);
  const customChannels = channels.filter(c => !builtInNums.has(String(c.number)));
  return {
    favorites,
    theme: currentTheme,
    widget_opacity: widgetOpacity,
    music_reactive_lights: musicReactiveLights,
    scroll_long_titles: scrollLongTitles,
    show_visualizer: showVisualizer,
    last_channel: currentChannel ? String(currentChannel.number) : '71',
    volume: currentVolume,
    is_muted: isMuted,
    mini_mode: isMiniMode,
    widget_scale: widgetScale,
    window_pos: savedWindowPos,
    track_history: trackHistory,
    custom_channels: customChannels
  };
}

function saveUserData() {
  try {
    const payload = buildUserDataPayload();
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save user_data.json:', e);
  }
}

function matchOrRegisterLiveChannel(detectedName, detectedNumber) {
  if (!detectedName && !detectedNumber) return null;

  const cleanName = (detectedName || '').trim();
  const cleanNum = (detectedNumber || '').trim();

  // 1. Exact channel number match
  if (cleanNum && /^\d+$/.test(cleanNum)) {
    const byNum = channels.find(c => String(c.number) === cleanNum);
    if (byNum) {
      if (cleanName && cleanName.length > 2 && cleanName.length < 40 && !/^\d+$/.test(cleanName)) {
        byNum.name = cleanName;
      }
      return byNum;
    }
  }

  // 2. Exact or normalized channel name match
  if (cleanName) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetNorm = norm(cleanName);
    if (targetNorm.length >= 3) {
      const byName = channels.find(c => norm(c.name) === targetNorm || (targetNorm.length > 5 && norm(c.name).includes(targetNorm)));
      if (byName) return byName;
    }
  }

  // 3. Auto-discover any new channel number detected from the live web player
  if (cleanNum && /^\d+$/.test(cleanNum)) {
    const newCh = {
      number: cleanNum,
      name: cleanName || `Channel ${cleanNum}`,
      genre: 'Live Synced',
      id: (cleanName || `ch-${cleanNum}`).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      color: '#00d2ff'
    };
    channels.push(newCh);
    channels.sort((a, b) => (parseInt(a.number, 10) || 9999) - (parseInt(b.number, 10) || 9999));
    saveUserData();
    return newCh;
  }

  return null;
}

let pendingTuneTimer = null;

async function tuneSxmPlayer(channel) {
  if (!playerWin || playerWin.isDestroyed() || !channel) return;

  // Give the tuning sequence 10 seconds before the metadata poller overrides currentChannel
  isTuningUntil = Date.now() + 10000;
  if (pendingTuneTimer) {
    clearInterval(pendingTuneTimer);
    pendingTuneTimer = null;
  }

  const entityUuid = channel.uuid || '';
  const customUrl = channel.url || '';

  // Shared helper script injected into the SiriusXM player window to click the top "ON NOW" Live Channel Play button
  // and NEVER click the "Latest episodes" on-demand buttons below it.
  const clickHeroLivePlayScript = `
    (function() {
      function isHeroPlayBtn(btn) {
        if (!btn || btn.closest('footer, [data-testid*="mini-player"], [class*="playerBar" i], [class*="nowPlayingBar" i], nav, header')) {
          return false;
        }
        const rect = btn.getBoundingClientRect();
        // Must be visible and located in the top Hero banner section of the channel page (above "Latest episodes")
        if (rect.width < 20 || rect.height < 20 || rect.top <= 20 || rect.top > 380) {
          return false;
        }
        const aria = (btn.getAttribute('aria-label') || '').trim();
        const title = (btn.getAttribute('title') || '').trim();
        const testId = (btn.getAttribute('data-testid') || '').toLowerCase();

        if (/\\b(add|library|favorite|share|more|options|close|search|back|next|previous)\\b/i.test(aria + ' ' + title + ' ' + testId)) {
          return false;
        }
        return true;
      }

      const mainArea = document.querySelector('main, [role="main"]') || document.body;

      // Priority 1: Find the "ON NOW" badge in the hero header and click the Play button right inside its container!
      const allEls = Array.from(mainArea.querySelectorAll('span, div, p, strong'));
      const onNowBadge = allEls.find(el => (el.innerText || '').trim().toUpperCase() === 'ON NOW');
      if (onNowBadge) {
        let container = onNowBadge.parentElement;
        while (container && container !== mainArea) {
          const btns = Array.from(container.querySelectorAll('button, [role="button"]')).filter(isHeroPlayBtn);
          if (btns.length > 0) {
            const targetBtn = btns[0];
            const aria = (targetBtn.getAttribute('aria-label') || targetBtn.innerText || '').trim();
            if (/pause/i.test(aria)) return 'already_playing_live';
            targetBtn.click();
            return 'clicked_on_now_hero_btn';
          }
          container = container.parentElement;
        }
      }

      // Priority 2: Find the largest primary Play button in the top hero area (rect.top <= 380)
      const heroButtons = Array.from(mainArea.querySelectorAll('button, [role="button"]')).filter(isHeroPlayBtn);
      heroButtons.sort((a, b) => {
        const rA = a.getBoundingClientRect();
        const rB = b.getBoundingClientRect();
        return (rB.width * rB.height) - (rA.width * rA.height);
      });

      if (heroButtons.length > 0) {
        const bestBtn = heroButtons[0];
        const aria = (bestBtn.getAttribute('aria-label') || bestBtn.innerText || '').trim();
        if (/pause/i.test(aria)) return 'already_playing_hero';
        bestBtn.click();
        return 'clicked_top_hero_btn';
      }

      return null;
    })()
  `;

  const targetUrl = entityUuid
    ? `https://www.siriusxm.com/player/channel-linear/entity/${entityUuid}`
    : (customUrl && customUrl.startsWith('http') ? customUrl : null);

  if (!targetUrl) return;

  const currentUrl = playerWin.webContents.getURL() || '';
  if (!entityUuid || !currentUrl.includes(entityUuid)) {
    try {
      playerWin.loadURL(targetUrl);
    } catch (e) {}
  }

  // Poll from the Electron Main Process (immune to page navigation reloads) until the new page renders & starts playing!
  let attempts = 0;
  let clickedHeroOnce = false;
  pendingTuneTimer = setInterval(async () => {
    attempts++;
    if (attempts > 32 || !playerWin || playerWin.isDestroyed()) {
      clearInterval(pendingTuneTimer);
      pendingTuneTimer = null;
      return;
    }
    if (playerWin.webContents.isLoading()) return;

    try {
      const status = await playerWin.webContents.executeJavaScript(`
        (function() {
          if (document.readyState !== 'complete') return { state: 'loading' };

          // Check if audio is already actively playing
          const media = document.querySelector('audio, video');
          const mediaPlaying = (media && !media.paused) || (navigator.mediaSession && navigator.mediaSession.playbackState === 'playing');

          // Wait until the "ON NOW" hero badge is rendered on the newly loaded channel page
          const hasOnNow = Array.from(document.querySelectorAll('span, div')).some(
            el => (el.innerText || '').trim().toUpperCase() === 'ON NOW'
          );
          if (!hasOnNow && ${attempts} < 14) return { state: 'waiting_for_on_now' };

          if (!${clickedHeroOnce}) {
            const heroRes = ${clickHeroLivePlayScript};
            if (heroRes) {
              return { state: 'clicked_hero', detail: heroRes };
            }
          } else {
            if (mediaPlaying) {
              return { state: 'playing_verified' };
            }
            // If we already clicked the hero button on the previous tick and it loaded the channel into the player bar
            // in a paused state, click the Play button or call media.play() so it starts automatically!
            const playSelectors = [
              '[data-testid="play-pause-button"]',
              'button[aria-label*="Play" i]',
              'button[title*="Play" i]',
              '.play-pause-btn'
            ];
            for (const sel of playSelectors) {
              const btn = document.querySelector(sel);
              if (btn) {
                const lbl = (btn.getAttribute('aria-label') || btn.getAttribute('title') || btn.innerText || '').toLowerCase();
                if (!lbl.includes('pause') && !lbl.includes('episode')) {
                  btn.click();
                  return { state: 'triggered_play_btn' };
                }
              }
            }
            if (media && media.paused) {
              media.play();
              return { state: 'triggered_media_play' };
            }
          }

          return { state: 'idle' };
        })()
      `);

      if (status && status.state === 'clicked_hero') {
        clickedHeroOnce = true;
        isPlaying = true;
        applySxmAudioSettings();
      } else if (status && (status.state === 'playing_verified' || status.state === 'triggered_play_btn' || status.state === 'triggered_media_play')) {
        clearInterval(pendingTuneTimer);
        pendingTuneTimer = null;
        isPlaying = true;
        applySxmAudioSettings();
      }
    } catch (e) {
      // Page is still mid-navigation; next interval tick will retry cleanly
    }
  }, 450);
}

async function fetchFreeRadioMetadata(ch) {
  if (!ch || !ch.metaUrl) return null;
  try {
    const resp = await fetch(ch.metaUrl, { headers: { 'User-Agent': 'SXMDesktopWidget/1.0' } });
    if (!resp.ok) return null;
    const data = await resp.json();

    if (ch.metaType === 'azuracast') {
      const np = Array.isArray(data) ? data[0]?.now_playing : data?.now_playing;
      const song = np?.song || {};
      return {
        title: song.title || ch.name,
        artist: song.artist || ch.desc,
        artwork: song.art || ch.defaultArt || null
      };
    }

    if (ch.metaType === 'evergreen') {
      const item = data?.nowPlaying?.[0];
      if (item) {
        return {
          title: item.title || ch.name,
          artist: item.artist || ch.desc,
          artwork: item.imageUrl || ch.defaultArt || null
        };
      }
    }

    if (ch.metaType === 'somafm') {
      const song = data?.songs?.[0];
      if (song) {
        return {
          title: song.title || ch.name,
          artist: song.artist || ch.desc,
          artwork: song.albumArt || ch.defaultArt || null
        };
      }
    }

    if (ch.metaType === 'wqxr') {
      const st = data?.[ch.wqxrKey || 'wqxr-special2'];
      const cat = st?.current_playlist_item?.catalog_entry;
      const showImg = st?.current_show?.fullImage?.url || ch.defaultArt || null;
      if (cat && cat.title) {
        const composer = cat.composer?.name || '';
        const ensemble = cat.ensemble?.name || '';
        const artistStr = [composer, ensemble].filter(Boolean).join(' • ') || st?.current_show?.title || 'WQXR Classical';
        return {
          title: cat.title,
          artist: artistStr,
          artwork: showImg
        };
      }
    }
  } catch (e) {}
  return null;
}

let icyMetaCache = { url: null, fetchedAt: 0, data: null, inFlight: false };

function parseIcyStreamTitle(rawTitle, ch, icyName) {
  const clean = String(rawTitle || '').replace(/\0+/g, '').trim();
  if (!clean) {
    if (icyName) {
      return { title: icyName, artist: ch.desc || 'Custom Radio Stream', artwork: ch.defaultArt || null };
    }
    return null;
  }
  const sepMatch = clean.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (sepMatch) {
    const artist = sepMatch[1].trim();
    const title = sepMatch[2].trim();
    if (artist && title) {
      return { title, artist, artwork: ch.defaultArt || null };
    }
  }
  return {
    title: clean,
    artist: icyName || ch.name || ch.desc || 'Custom Radio Stream',
    artwork: ch.defaultArt || null
  };
}

function readIcyOnce(targetUrl, redirectsLeft = 5) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return finish(null);
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(parsedUrl, {
      headers: {
        'Icy-MetaData': '1',
        'User-Agent': 'SXMDesktopWidget/1.0',
        'Accept': '*/*'
      },
      timeout: 5500
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.destroy();
        try {
          const nextUrl = new URL(res.headers.location, parsedUrl).toString();
          return resolve(readIcyOnce(nextUrl, redirectsLeft - 1));
        } catch (e) {
          return finish(null);
        }
      }

      const icyName = (res.headers['icy-name'] || '').toString().trim() || null;
      const metaInt = parseInt(res.headers['icy-metaint'], 10);
      if (!metaInt || metaInt <= 0 || metaInt > 524288) {
        res.destroy();
        return finish(icyName ? { streamTitle: null, icyName } : null);
      }

      let bytesToSkip = metaInt;
      let metaLen = -1;
      let metaBuf = Buffer.alloc(0);

      res.on('data', (chunk) => {
        let offset = 0;
        if (bytesToSkip > 0) {
          const skip = Math.min(bytesToSkip, chunk.length);
          bytesToSkip -= skip;
          offset += skip;
        }
        if (bytesToSkip === 0 && offset < chunk.length) {
          if (metaLen === -1) {
            metaLen = chunk[offset] * 16;
            offset += 1;
            if (metaLen === 0) {
              res.destroy();
              return finish(icyName ? { streamTitle: null, icyName } : null);
            }
          }
          if (metaLen > 0 && offset < chunk.length) {
            const needed = metaLen - metaBuf.length;
            metaBuf = Buffer.concat([metaBuf, chunk.subarray(offset, offset + needed)]);
            if (metaBuf.length >= metaLen) {
              res.destroy();
              const metaStr = metaBuf.toString('utf8').replace(/\0+/g, '');
              const m = metaStr.match(/StreamTitle='([^']*)'/i);
              return finish({ streamTitle: m ? m[1] : null, icyName });
            }
          }
        }
      });

      res.on('end', () => finish(icyName ? { streamTitle: null, icyName } : null));
      res.on('error', () => finish(null));
    });

    req.on('timeout', () => {
      req.destroy();
      finish(null);
    });
    req.on('error', () => finish(null));
  });
}

async function fetchIcyMetadata(ch, force = false) {
  if (!ch || !ch.streamUrl || ch.isHls) return null;
  const url = ch.streamUrl;
  const now = Date.now();
  if (!force && icyMetaCache.url === url && (now - icyMetaCache.fetchedAt) < 8000) {
    return icyMetaCache.data;
  }
  if (icyMetaCache.inFlight && icyMetaCache.url === url) {
    return icyMetaCache.data;
  }

  icyMetaCache.inFlight = true;
  icyMetaCache.url = url;
  try {
    const raw = await readIcyOnce(url);
    const parsed = raw ? parseIcyStreamTitle(raw.streamTitle, ch, raw.icyName) : null;
    icyMetaCache = { url, fetchedAt: Date.now(), data: parsed, inFlight: false };
    return parsed;
  } catch (e) {
    icyMetaCache.inFlight = false;
    return null;
  }
}

async function fetchDirectStreamMetadata(ch, force = false) {
  if (!ch || !ch.isDirectStream) return null;
  if (ch.metaUrl) {
    return fetchFreeRadioMetadata(ch);
  }
  return fetchIcyMetadata(ch, force);
}

async function resolveStreamPlaylistUrl(inputUrl) {
  const cleanUrl = String(inputUrl || '').trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(cleanUrl);
  } catch (e) {
    return { ok: false, error: 'Please enter a valid http:// or https:// URL.' };
  }

  const pathname = parsedUrl.pathname.toLowerCase();
  const isPlsExt = pathname.endsWith('.pls');
  const isM3uExt = pathname.endsWith('.m3u') || pathname.endsWith('.ram');
  const isM3u8Ext = pathname.endsWith('.m3u8');

  if (!isPlsExt && !isM3uExt && !isM3u8Ext) {
    return { ok: true, streamUrl: cleanUrl, isHls: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(cleanUrl, {
      headers: { 'User-Agent': 'SXMDesktopWidget/1.0' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return { ok: true, streamUrl: cleanUrl, isHls: isM3u8Ext };
    }
    const text = (await resp.text()).slice(0, 65536);

    if (isPlsExt || /\[playlist\]/i.test(text)) {
      const lines = text.split(/\r?\n/);
      let foundUrl = null;
      let foundTitle = null;
      for (const line of lines) {
        const fileMatch = line.match(/^\s*File\d+\s*=\s*(.+)$/i);
        if (fileMatch && !foundUrl) {
          const candidate = fileMatch[1].trim();
          if (/^https?:\/\//i.test(candidate)) foundUrl = candidate;
        }
        const titleMatch = line.match(/^\s*Title\d+\s*=\s*(.+)$/i);
        if (titleMatch && !foundTitle) {
          foundTitle = titleMatch[1].trim();
        }
      }
      if (foundUrl) {
        return { ok: true, streamUrl: foundUrl, isHls: /\.m3u8(\?|$)/i.test(foundUrl), resolvedTitle: foundTitle };
      }
      return { ok: false, error: 'No stream URL found inside this .pls playlist.' };
    }

    // M3U / M3U8 handling
    const isHlsManifest = /#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE|VERSION)/i.test(text);
    if (isHlsManifest) {
      return { ok: true, streamUrl: cleanUrl, isHls: true };
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    for (const line of lines) {
      try {
        const resolved = new URL(line, cleanUrl).toString();
        if (/^https?:\/\//i.test(resolved)) {
          return { ok: true, streamUrl: resolved, isHls: /\.m3u8(\?|$)/i.test(resolved) };
        }
      } catch (e) {}
    }

    return { ok: true, streamUrl: cleanUrl, isHls: isM3u8Ext };
  } catch (e) {
    return { ok: true, streamUrl: cleanUrl, isHls: isM3u8Ext };
  }
}

function compareSemver(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

async function checkForUpdates(notifyRenderer = true) {
  const currentVersion = app.getVersion();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(GITHUB_RELEASES_API, {
      headers: {
        'User-Agent': `SXMDesktopWidget/${currentVersion}`,
        'Accept': 'application/vnd.github+json'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return { ok: false, currentVersion, available: false };
    }
    const release = await resp.json();
    const tag = String(release.tag_name || '').trim();
    const latestVersion = tag.replace(/^v/i, '');
    const available = !!latestVersion && compareSemver(latestVersion, currentVersion) > 0;
    const info = {
      ok: true,
      available,
      currentVersion,
      latestVersion: latestVersion || currentVersion,
      releaseName: release.name || tag || `v${latestVersion}`,
      releaseUrl: release.html_url || GITHUB_RELEASES_PAGE
    };
    if (available) {
      latestUpdateInfo = info;
      if (notifyRenderer && widgetWin && !widgetWin.isDestroyed()) {
        widgetWin.webContents.send('update_available', info);
      }
    }
    return info;
  } catch (e) {
    return { ok: false, currentVersion, available: false };
  }
}

let lastAdaptiveCache = { url: null, color: null };

async function extractDominantColor(artworkUrl) {
  if (!artworkUrl || typeof artworkUrl !== 'string') return null;
  if (lastAdaptiveCache.url === artworkUrl && lastAdaptiveCache.color) {
    return lastAdaptiveCache.color;
  }

  try {
    let img = null;
    if (artworkUrl.startsWith('data:image/')) {
      img = nativeImage.createFromDataURL(artworkUrl);
    } else if (/^https?:\/\//i.test(artworkUrl)) {
      const resp = await fetch(artworkUrl, { headers: { 'User-Agent': 'SXMDesktopWidget/1.0' } });
      if (!resp.ok) return null;
      const buf = Buffer.from(await resp.arrayBuffer());
      img = nativeImage.createFromBuffer(buf);
    }
    if (!img || img.isEmpty()) return null;

    const resized = img.resize({ width: 24, height: 24, quality: 'good' });
    const bitmap = resized.toBitmap();
    if (!bitmap || bitmap.length < 4) return null;

    // Group pixels into 12 hue buckets (30 deg each) weighted by vibrancy so opposite colors don't muddy to grey
    const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    let fallback = { w: 0, r: 0, g: 0, b: 0 };

    for (let i = 0; i < bitmap.length; i += 4) {
      // Electron toBitmap() is BGRA on Windows
      const b = bitmap[i];
      const g = bitmap[i + 1];
      const r = bitmap[i + 2];
      const a = bitmap[i + 3];
      if (a < 128) continue;

      const rf = r / 255, gf = g / 255, bf = b / 255;
      const max = Math.max(rf, gf, bf);
      const min = Math.min(rf, gf, bf);
      const d = max - min;
      const l = (max + min) / 2;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

      if (l < 0.08 || l > 0.94) continue;

      const fbWeight = 1 - Math.abs(l - 0.5);
      fallback.w += fbWeight;
      fallback.r += r * fbWeight;
      fallback.g += g * fbWeight;
      fallback.b += b * fbWeight;

      if (s < 0.14) continue;

      let h = 0;
      if (d > 0) {
        if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
        else if (max === gf) h = ((bf - rf) / d + 2) / 6;
        else h = ((rf - gf) / d + 4) / 6;
      }

      const bucketIdx = Math.min(11, Math.floor(h * 12));
      const weight = Math.pow(s, 1.5) * (1.15 - Math.abs(l - 0.5));
      buckets[bucketIdx].w += weight;
      buckets[bucketIdx].r += r * weight;
      buckets[bucketIdx].g += g * weight;
      buckets[bucketIdx].b += b * weight;
    }

    let best = buckets.reduce((acc, cur) => (cur.w > acc.w ? cur : acc), { w: 0, r: 0, g: 0, b: 0 });
    if (best.w <= 0) best = fallback;
    if (best.w <= 0) return null;

    let r = Math.round(best.r / best.w);
    let g = Math.round(best.g / best.w);
    let b = Math.round(best.b / best.w);

    // Ensure the extracted accent isn't too dark to glow cleanly
    const maxCh = Math.max(r, g, b);
    if (maxCh > 0 && maxCh < 155) {
      const boost = 170 / maxCh;
      r = Math.min(255, Math.round(r * boost));
      g = Math.min(255, Math.round(g * boost));
      b = Math.min(255, Math.round(b * boost));
    }

    const color = { r, g, b };
    lastAdaptiveCache = { url: artworkUrl, color };
    return color;
  } catch (e) {
    return null;
  }
}

function normalizeTextForCompare(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeSxmMetadata(meta, channel) {
  if (!meta || typeof meta !== 'object') return meta;

  const rawTitle = (meta.title || '').trim();
  const rawArtist = (meta.artist || '').trim();
  if (!rawTitle && !rawArtist) return meta;

  const chNames = [
    channel && channel.name,
    meta.detected_ch_name,
    meta.album
  ].map(normalizeTextForCompare).filter(Boolean);

  const titleParts = rawTitle
    ? rawTitle.split(/\s*[·•|]\s*/).map(s => s.trim()).filter(Boolean)
    : [];
  const hasChannelShowFormat = titleParts.length >= 2;
  const normTitle = normalizeTextForCompare(rawTitle);
  const titleMatchesChannel = !rawTitle || (normTitle && chNames.some(c => c === normTitle || (c.length >= 4 && normTitle.includes(c))));

  // SiriusXM Web Player sets mediaSession.title to "Channel · Show" (often "Channel · Channel")
  // and mediaSession.artist to "Artist - Song Title".
  const artistSplitMatch = rawArtist.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (artistSplitMatch && (hasChannelShowFormat || titleMatchesChannel)) {
    const parsedArtist = artistSplitMatch[1].trim();
    const parsedTitle = artistSplitMatch[2].trim();
    if (parsedArtist && parsedTitle) {
      meta.title = parsedTitle;
      meta.artist = parsedArtist;
      return meta;
    }
  }

  // Even when there's no "Artist - Song" (e.g., talk/sports show or station bumper),
  // collapse redundant "Channel · Channel" or strip leading "Channel · " prefix.
  if (hasChannelShowFormat) {
    const firstNorm = normalizeTextForCompare(titleParts[0]);
    const secondNorm = normalizeTextForCompare(titleParts[1]);
    if (firstNorm && firstNorm === secondNorm) {
      meta.title = titleParts[1];
    } else if (firstNorm && chNames.some(c => c === firstNorm || (c.length >= 4 && firstNorm.includes(c)))) {
      meta.title = titleParts.slice(1).join(' · ');
    }
  }

  return meta;
}

function startMetadataPoller() {
  setInterval(async () => {
    if (!widgetWin || widgetWin.isDestroyed()) return;

    // 1. If currently tuned to a Free/Custom Internet Radio stream, fetch its live JSON API or ICY metadata directly!
    if (currentChannel && currentChannel.isDirectStream) {
      const freeMeta = await fetchDirectStreamMetadata(currentChannel, false);
      if (freeMeta) {
        if (isPlaying && freeMeta.title) {
          recordTrackHistory(freeMeta.title, freeMeta.artist, currentChannel);
        }
        const adaptiveColor = freeMeta.artwork ? await extractDominantColor(freeMeta.artwork) : null;
        widgetWin.webContents.send('metadata_update', {
          title: freeMeta.title,
          artist: freeMeta.artist,
          artwork: freeMeta.artwork,
          adaptive_color: adaptiveColor,
          is_playing: isPlaying,
          auth_needed: false
        });
      }
      return;
    }

    // 2. Otherwise poll the SiriusXM Web Player window
    if (!playerWin || playerWin.isDestroyed()) return;
    if (playerWin.webContents.isLoading()) return;

    const jsMeta = `
      (function() {
        const out = {
          title: null,
          artist: null,
          album: null,
          artwork: null,
          is_playing: null,
          auth_needed: false,
          detected_ch_num: null,
          detected_ch_name: null,
          watchdog_notice: null
        };

        // 0. Stream Watchdog: dismiss SiriusXM "Are you still listening?" or playback retry modals
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i]'));
        for (const dlg of dialogs) {
          const dlgText = (dlg.innerText || '').trim();
          if (/still\\s*listening|inactive|timed\\s*out|keep\\s*listening|playback\\s*error|something\\s*went\\s*wrong/i.test(dlgText)) {
            const btns = Array.from(dlg.querySelectorAll('button, [role="button"]'));
            const resumeBtn = btns.find(b => {
              const t = (b.innerText || b.getAttribute('aria-label') || '').trim();
              return /continue|yes|keep\\s*listening|resume|try\\s*again|retry|ok/i.test(t);
            });
            if (resumeBtn) {
              resumeBtn.click();
              out.watchdog_notice = 'AUTO-RESUMED STREAM';
              break;
            }
          }
        }

        const url = window.location.href || '';
        if (url.includes('login') || url.includes('signin') || url.includes('auth')) {
          out.auth_needed = true;
        }

        // 1. MediaSession metadata (SiriusXM sets album to the active Channel Name)
        if (navigator.mediaSession && navigator.mediaSession.metadata) {
          const m = navigator.mediaSession.metadata;
          out.title = m.title || null;
          out.artist = m.artist || null;
          out.album = m.album || null;
          if (m.artwork && m.artwork.length > 0) {
            out.artwork = m.artwork[m.artwork.length - 1].src;
          }
        }

        if (navigator.mediaSession && navigator.mediaSession.playbackState === 'playing') {
          out.is_playing = true;
        } else if (navigator.mediaSession && navigator.mediaSession.playbackState === 'paused') {
          out.is_playing = false;
        } else {
          const media = document.querySelector('audio, video');
          if (media) {
            out.is_playing = !media.paused;
          }
        }

        // 2. Scrape active channel number & name ONLY from the player bar (footer / mini-player)
        const playerBar = document.querySelector('footer, [data-testid*="mini-player"], [class*="playerBar" i], [class*="nowPlayingBar" i]');
        if (playerBar) {
          const chSelectors = [
            '[data-testid*="channel-number"]',
            '[data-testid*="channel-title"]',
            '[data-testid*="channel-name"]',
            '[class*="channelNumber" i]',
            '[class*="channelName" i]',
            '[class*="channel" i]'
          ];

          for (const sel of chSelectors) {
            const nodes = playerBar.querySelectorAll(sel);
            nodes.forEach(n => {
              const txt = (n.innerText || n.getAttribute('aria-label') || '').trim();
              if (!txt) return;
              const numMatch = txt.match(/^(?:ch(?:annel)?\\.?\\s*)?(\\d{1,4})$/i);
              if (numMatch && !out.detected_ch_num) {
                out.detected_ch_num = numMatch[1];
              } else if (txt.length > 1 && txt.length < 45 && !/^\\d+$/.test(txt) && !out.detected_ch_name) {
                out.detected_ch_name = txt.replace(/^ch(?:annel)?\\.?\\s*\\d+\\s*[-•:]?\\s*/i, '').trim();
              }
            });
          }

          if (!out.detected_ch_num) {
            const barText = playerBar.innerText || '';
            const m = barText.match(/\\b(?:Ch\\.?|Channel)\\s*(\\d{1,4})\\b/i);
            if (m) out.detected_ch_num = m[1];
          }
        }

        if (!out.detected_ch_name && out.album) {
          out.detected_ch_name = out.album;
        }

        if (!out.title) {
          const tEl = document.querySelector('[data-testid*="track-title"], .track-name, .now-playing-title');
          if (tEl && tEl.innerText) out.title = tEl.innerText.trim();
        }
        if (!out.artist) {
          const aEl = document.querySelector('[data-testid*="artist-name"], .artist-name, .now-playing-artist');
          if (aEl && aEl.innerText) out.artist = aEl.innerText.trim();
        }

        return out;
      })();
    `;

    try {
      const meta = await playerWin.webContents.executeJavaScript(jsMeta);
      if (meta && typeof meta === 'object') {
        if (typeof meta.is_playing === 'boolean') {
          isPlaying = meta.is_playing;
        }

        // Only override currentChannel from the browser if we aren't mid-tune
        if (Date.now() > isTuningUntil && (meta.detected_ch_num || meta.detected_ch_name)) {
          const matched = matchOrRegisterLiveChannel(meta.detected_ch_name, meta.detected_ch_num);
          if (matched) {
            currentChannel = matched;
            saveUserData();
            meta.synced_channel = currentChannel;
            meta.updated_channels = channels;
          }
        }

        // Normalize SiriusXM MediaSession metadata ("Channel · Show" + "Artist - Song Title")
        normalizeSxmMetadata(meta, currentChannel);

        // Keep SiriusXM player volume/mute synced with widget controls
        applySxmAudioSettings();

        if (meta.title && (meta.is_playing !== false)) {
          recordTrackHistory(meta.title, meta.artist, currentChannel);
        }

        if (meta.artwork) {
          meta.adaptive_color = await extractDominantColor(meta.artwork);
        }

        widgetWin.webContents.send('metadata_update', meta);
      }
    } catch (e) {
      // Ignore transient frame errors
    }
  }, 2000);
}

function getScaledWidgetSize() {
  const width = Math.round(WIDGET_WIDTH * widgetScale);
  const baseH = isDrawerOpen ? EXPANDED_HEIGHT : (isMiniMode ? MINI_HEIGHT : COMPACT_HEIGHT);
  let height = Math.round(baseH * widgetScale);
  if (isDrawerOpen && widgetWin && !widgetWin.isDestroyed()) {
    try {
      const disp = screen.getDisplayMatching(widgetWin.getBounds());
      if (disp && disp.workArea && disp.workArea.height) {
        height = Math.min(height, Math.max(400, disp.workArea.height - 24));
      }
    } catch (e) {}
  }
  return { width, height };
}

function applyWidgetBoundsAndZoom() {
  if (!widgetWin || widgetWin.isDestroyed()) return;
  const { width, height } = getScaledWidgetSize();
  const bounds = widgetWin.getBounds();
  widgetWin.webContents.setZoomFactor(widgetScale);
  widgetWin.setBounds({
    x: bounds.x,
    y: bounds.y,
    width,
    height
  }, true);
}

function createWindows() {
  loadUserData();
  const iconPath = path.join(__dirname, 'icon.ico');
  const { width: initialWidth, height: initialHeight } = getScaledWidgetSize();
  const safePos = getSafeWindowPosition(savedWindowPos, initialWidth, initialHeight);

  widgetWin = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    ...(safePos ? { x: safePos.x, y: safePos.y } : {}),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    icon: iconPath,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  widgetWin.loadFile(path.join(__dirname, 'ui.html'));
  widgetWin.setOpacity(widgetOpacity);
  widgetWin.webContents.on('did-finish-load', () => {
    if (widgetWin && !widgetWin.isDestroyed()) {
      widgetWin.webContents.setZoomFactor(widgetScale);
    }
  });

  let savePosTimer = null;
  widgetWin.on('move', () => {
    if (!widgetWin || widgetWin.isDestroyed()) return;
    if (savePosTimer) clearTimeout(savePosTimer);
    savePosTimer = setTimeout(() => {
      if (!widgetWin || widgetWin.isDestroyed()) return;
      const b = widgetWin.getBounds();
      savedWindowPos = { x: b.x, y: b.y };
      saveUserData();
    }, 300);
  });

  widgetWin.on('closed', () => {
    app.quit();
  });

  // Paint when initially hidden so React & IntersectionObservers render normally even when window is hidden!
  playerWin = new BrowserWindow({
    width: 1050,
    height: 740,
    show: false,
    paintWhenInitiallyHidden: true,
    icon: iconPath,
    title: 'SiriusXM Web Player (Sign In Once, Then Click 🌐 or Close to Hide)',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:sxm_session',
      backgroundThrottling: false,
      contextIsolation: true
    }
  });

  playerWin.webContents.setAudioMuted(!!isMuted);

  const cleanUA = playerWin.webContents.getUserAgent().replace(/Electron\/[0-9.]+\s?/g, '');
  playerWin.webContents.setUserAgent(cleanUA);

  playerWin.loadURL('https://www.siriusxm.com/player');

  playerWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      playerWin.hide();
    }
  });

  startMetadataPoller();
  setTimeout(() => {
    checkForUpdates(true);
  }, 4000);
}

function getInitialStatePayload() {
  return {
    channels,
    favorites,
    current_channel: currentChannel,
    is_playing: isPlaying,
    theme: currentTheme,
    widget_opacity: widgetOpacity,
    music_reactive_lights: musicReactiveLights,
    scroll_long_titles: scrollLongTitles,
    show_visualizer: showVisualizer,
    volume: currentVolume,
    is_muted: isMuted,
    mini_mode: isMiniMode,
    widget_scale: widgetScale,
    track_history: trackHistory,
    launch_at_startup: getLaunchAtStartup(),
    app_version: app.getVersion(),
    update_info: latestUpdateInfo
  };
}

// IPC Handlers
ipcMain.handle('get_initial_state', () => {
  return getInitialStatePayload();
});

ipcMain.handle('save_theme', (_event, themeId) => {
  if (themeId && typeof themeId === 'string') {
    currentTheme = themeId;
    saveUserData();
  }
  return currentTheme;
});

ipcMain.handle('save_visual_settings', (_event, settings) => {
  if (settings && typeof settings === 'object') {
    if (typeof settings.opacity === 'number' && Number.isFinite(settings.opacity)) {
      widgetOpacity = Math.max(0.35, Math.min(1, settings.opacity));
      if (widgetWin && !widgetWin.isDestroyed()) widgetWin.setOpacity(widgetOpacity);
    }
    if (typeof settings.musicReactiveLights === 'boolean') {
      musicReactiveLights = settings.musicReactiveLights;
    }
    if (typeof settings.scrollLongTitles === 'boolean') {
      scrollLongTitles = settings.scrollLongTitles;
    }
    if (typeof settings.showVisualizer === 'boolean') {
      showVisualizer = settings.showVisualizer;
    }
    saveUserData();
  }
  return { opacity: widgetOpacity, musicReactiveLights, scrollLongTitles, showVisualizer };
});

ipcMain.handle('preview_widget_opacity', (_event, opacity) => {
  if (typeof opacity !== 'number' || !Number.isFinite(opacity)) return widgetOpacity;
  widgetOpacity = Math.max(0.35, Math.min(1, opacity));
  if (widgetWin && !widgetWin.isDestroyed()) widgetWin.setOpacity(widgetOpacity);
  return widgetOpacity;
});

ipcMain.handle('set_volume', async (_event, volume, muted) => {
  if (typeof volume === 'number' && !Number.isNaN(volume)) {
    currentVolume = Math.max(0, Math.min(100, Math.round(volume)));
  }
  if (typeof muted === 'boolean') {
    isMuted = muted;
  }
  saveUserData();
  await applySxmAudioSettings();
  return { volume: currentVolume, is_muted: isMuted };
});

ipcMain.handle('set_widget_scale', (_event, scale) => {
  if (typeof scale === 'number' && Number.isFinite(scale)) {
    widgetScale = Math.max(0.75, Math.min(1.35, scale));
    saveUserData();
    applyWidgetBoundsAndZoom();
  }
  return widgetScale;
});

ipcMain.handle('set_mini_mode', (_event, mini) => {
  isMiniMode = !!mini;
  if (isMiniMode) isDrawerOpen = false;
  saveUserData();
  applyWidgetBoundsAndZoom();
  return isMiniMode;
});

ipcMain.handle('clear_history', () => {
  trackHistory = [];
  saveUserData();
  return trackHistory;
});

ipcMain.handle('set_launch_at_startup', (_event, enabled) => {
  return setLaunchAtStartup(!!enabled);
});

ipcMain.handle('set_drawer_open', (_event, isOpen) => {
  if (!widgetWin || widgetWin.isDestroyed()) return false;
  isDrawerOpen = !!isOpen;
  if (isDrawerOpen && isMiniMode) {
    isMiniMode = false;
    saveUserData();
  }
  applyWidgetBoundsAndZoom();
  return true;
});

ipcMain.handle('toggle_favorite', (_event, chNumber) => {
  const numStr = String(chNumber);
  const idx = favorites.indexOf(numStr);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(numStr);
  }
  saveUserData();
  return favorites;
});

ipcMain.handle('reorder_favorites', (_event, newOrder) => {
  if (!Array.isArray(newOrder)) return favorites;
  const seen = new Set();
  const cleaned = [];
  for (const item of newOrder) {
    const s = String(item);
    if (!seen.has(s) && favorites.includes(s)) {
      seen.add(s);
      cleaned.push(s);
    }
  }
  // Preserve any favorites not included in the payload (e.g. if filtered during drag)
  for (const existing of favorites) {
    if (!seen.has(existing)) {
      cleaned.push(existing);
    }
  }
  favorites = cleaned;
  saveUserData();
  return favorites;
});

ipcMain.handle('add_custom_stream', async (_event, payload) => {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid stream data.' };
  }
  let cleanName = String(payload.name || '').trim();
  const rawUrl = String(payload.streamUrl || '').trim();
  const cleanGenre = String(payload.genre || '').trim() || 'Custom';
  const cleanColor = /^#[0-9a-fA-F]{6}$/.test(String(payload.color || ''))
    ? String(payload.color)
    : '#00d2ff';

  if (!/^https?:\/\/.+/i.test(rawUrl)) {
    return { ok: false, error: 'Stream URL must start with http:// or https://' };
  }

  const resolved = await resolveStreamPlaylistUrl(rawUrl);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error || 'Could not resolve playlist URL.' };
  }

  if (!cleanName && resolved.resolvedTitle) {
    cleanName = resolved.resolvedTitle;
  }
  if (!cleanName) {
    return { ok: false, error: 'Please enter a station name.' };
  }

  const existingNums = new Set(channels.map(c => String(c.number).toUpperCase()));
  let finalNum = String(payload.number || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (!finalNum || existingNums.has(finalNum)) {
    let idx = 1;
    while (existingNums.has(`C${idx}`)) idx++;
    finalNum = `C${idx}`;
  }

  const newCh = {
    number: finalNum,
    name: cleanName,
    genre: cleanGenre,
    desc: resolved.isHls ? 'Custom HLS Radio Stream' : 'Custom Radio Stream',
    color: cleanColor,
    isDirectStream: true,
    isUserCustom: true,
    isHls: !!resolved.isHls,
    streamUrl: resolved.streamUrl
  };

  channels.push(newCh);
  saveUserData();
  return { ok: true, channel: newCh, channels };
});

ipcMain.handle('remove_custom_stream', (_event, chNumber) => {
  const numStr = String(chNumber);
  const idx = channels.findIndex(c => String(c.number) === numStr && c.isUserCustom);
  if (idx < 0) return { ok: false, channels, favorites };

  channels.splice(idx, 1);
  favorites = favorites.filter(f => f !== numStr);
  saveUserData();
  return { ok: true, channels, favorites };
});

async function pauseSxmBrowser() {
  if (pendingTuneTimer) {
    clearInterval(pendingTuneTimer);
    pendingTuneTimer = null;
  }
  if (!playerWin || playerWin.isDestroyed()) return;
  try {
    await playerWin.webContents.executeJavaScript(`
      (function() {
        const pauseSelectors = ['button[aria-label*="Pause" i]', 'button[title*="Pause" i]'];
        for (const sel of pauseSelectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return true; }
        }
        const media = document.querySelector('audio, video');
        if (media && !media.paused) { media.pause(); return true; }
        return false;
      })();
    `);
  } catch (e) {}
}

ipcMain.handle('select_channel', async (_event, chNumber) => {
  const numStr = String(chNumber);
  const target = channels.find(c => String(c.number) === numStr);
  if (!target) return null;
  return tuneToTargetChannel(target);
});

function getFilteredChannelPool(filterCategory, searchQuery) {
  const filter = typeof filterCategory === 'string' ? filterCategory : (filterCategory === true ? 'favorites' : 'all');
  const q = (searchQuery || '').trim().toLowerCase();

  let filteredPool = channels.filter(ch => {
    if (filter === 'favorites' && !favorites.includes(String(ch.number))) {
      return false;
    }
    if (filter === 'all' && !q && ch.isDirectStream) {
      // Keep the "All (826)" tab strictly for SiriusXM channels unless searching or in Free Radio / Custom / Favorites!
      return false;
    }
    if (filter === 'Custom') {
      if (!ch.isUserCustom && (ch.genre || '').toLowerCase() !== 'custom') {
        return false;
      }
    } else if (filter !== 'all' && filter !== 'favorites') {
      if ((ch.genre || '').toLowerCase() !== filter.toLowerCase()) {
        return false;
      }
    }
    if (q) {
      const matchName = (ch.name || '').toLowerCase().includes(q);
      const matchNum = String(ch.number).toLowerCase().includes(q);
      const matchGenre = (ch.genre || '').toLowerCase().includes(q);
      const matchDesc = (ch.desc || '').toLowerCase().includes(q);
      return matchName || matchNum || matchGenre || matchDesc;
    }
    return true;
  });

  if (filter === 'favorites') {
    filteredPool.sort((a, b) => favorites.indexOf(String(a.number)) - favorites.indexOf(String(b.number)));
  }

  return filteredPool.length > 0 ? filteredPool : channels;
}

async function tuneToTargetChannel(target) {
  currentChannel = target;
  isPlaying = true;
  saveUserData();

  if (target.isDirectStream) {
    await pauseSxmBrowser();
    fetchDirectStreamMetadata(target, true).then(async meta => {
      if (meta && widgetWin && !widgetWin.isDestroyed()) {
        if (meta.title) {
          recordTrackHistory(meta.title, meta.artist, target);
        }
        const adaptiveColor = meta.artwork ? await extractDominantColor(meta.artwork) : null;
        widgetWin.webContents.send('metadata_update', {
          title: meta.title,
          artist: meta.artist,
          artwork: meta.artwork,
          adaptive_color: adaptiveColor,
          is_playing: true,
          auth_needed: false
        });
      }
    });
  } else {
    tuneSxmPlayer(target);
  }
  return { channel: currentChannel, is_playing: isPlaying };
}

ipcMain.handle('step_channel', async (_event, delta, filterCategory, searchQuery) => {
  const pool = getFilteredChannelPool(filterCategory, searchQuery);
  if (pool.length === 0) return null;

  let currIdx = pool.findIndex(c => String(c.number) === String(currentChannel.number));
  let nextIdx;
  if (currIdx < 0) {
    nextIdx = Number(delta) >= 0 ? 0 : pool.length - 1;
  } else {
    nextIdx = (currIdx + Number(delta) + pool.length) % pool.length;
  }

  return tuneToTargetChannel(pool[nextIdx]);
});

ipcMain.handle('random_channel', async (_event, filterCategory, searchQuery) => {
  const pool = getFilteredChannelPool(filterCategory, searchQuery);
  if (pool.length === 0) return null;

  const candidates = pool.length > 1
    ? pool.filter(c => String(c.number) !== String(currentChannel && currentChannel.number))
    : pool;
  const pick = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  return tuneToTargetChannel(pick);
});

ipcMain.handle('toggle_play', async () => {
  if (currentChannel && currentChannel.isDirectStream) {
    isPlaying = !isPlaying;
    return { is_playing: isPlaying, is_direct: true };
  }

  if (!playerWin || playerWin.isDestroyed()) return { is_playing: false };

  const jsCode = `
    (function() {
      const selectors = [
        '[data-testid="play-pause-button"]',
        'button[aria-label*="Play" i]',
        'button[aria-label*="Pause" i]',
        '.play-pause-btn',
        'button[title*="Play" i]',
        'button[title*="Pause" i]'
      ];
      for (const sel of selectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          return 'clicked_btn';
        }
      }
      const media = document.querySelector('audio, video');
      if (media) {
        if (media.paused) { media.play(); return 'played_media'; }
        else { media.pause(); return 'paused_media'; }
      }
      return 'no_control_found';
    })();
  `;

  try {
    const res = await playerWin.webContents.executeJavaScript(jsCode);
    if (res === 'no_control_found') {
      tuneSxmPlayer(currentChannel);
      isPlaying = true;
    } else {
      isPlaying = !isPlaying;
    }
  } catch (e) {
    isPlaying = !isPlaying;
  }

  return { is_playing: isPlaying };
});

ipcMain.handle('stop_stream', async () => {
  isPlaying = false;
  await pauseSxmBrowser();
  return { is_playing: false };
});

ipcMain.handle('jump_to_live', async () => {
  if (!playerWin || playerWin.isDestroyed()) return { ok: false };

  const jsGoLive = `
    (function() {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
      for (const btn of buttons) {
        const txt = (btn.innerText || btn.getAttribute('aria-label') || btn.getAttribute('title') || '').trim();
        const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
        if (
          /^go\\s*live$/i.test(txt) ||
          /^live$/i.test(txt) ||
          /jump\\s*to\\s*live/i.test(txt) ||
          /back\\s*to\\s*live/i.test(txt) ||
          testId.includes('go-live') ||
          testId.includes('live-button')
        ) {
          btn.click();
          return 'clicked_live_btn';
        }
      }

      const media = document.querySelector('audio, video');
      if (media) {
        if (media.seekable && media.seekable.length > 0) {
          media.currentTime = media.seekable.end(media.seekable.length - 1);
          if (media.paused) media.play();
          return 'seeked_live_edge';
        } else if (isFinite(media.duration) && media.duration > 0) {
          media.currentTime = media.duration;
          if (media.paused) media.play();
          return 'seeked_duration';
        }
      }
      return 'not_found';
    })();
  `;

  try {
    const result = await playerWin.webContents.executeJavaScript(jsGoLive);
    isPlaying = true;
    return { ok: true, method: result };
  } catch (e) {
    return { ok: false };
  }
});

ipcMain.handle('sync_live_channels', async () => {
  return { channels };
});

ipcMain.handle('toggle_player_window', () => {
  if (!playerWin || playerWin.isDestroyed()) return false;
  if (playerWin.isVisible()) {
    playerWin.hide();
    return false;
  } else {
    playerWin.show();
    playerWin.focus();
    return true;
  }
});

ipcMain.handle('toggle_on_top', () => {
  alwaysOnTop = !alwaysOnTop;
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.setAlwaysOnTop(alwaysOnTop);
  }
  return alwaysOnTop;
});

ipcMain.handle('close_app', () => {
  app.isQuitting = true;
  app.quit();
});

ipcMain.handle('open_external_url', async (_event, targetUrl) => {
  const clean = String(targetUrl || '').trim();
  if (!/^https?:\/\/.+/i.test(clean)) return { ok: false };
  try {
    await shell.openExternal(clean);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('export_settings', async () => {
  if (!widgetWin || widgetWin.isDestroyed()) return { ok: false };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(widgetWin, {
      title: 'Export SiriusXM Widget Settings',
      defaultPath: path.join(app.getPath('documents'), 'sxm-widget-backup.json'),
      filters: [{ name: 'JSON Backup', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    const backup = {
      ...buildUserDataPayload(),
      app_version: app.getVersion(),
      exported_at: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf-8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('import_settings', async () => {
  if (!widgetWin || widgetWin.isDestroyed()) return { ok: false };
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(widgetWin, {
      title: 'Import SiriusXM Widget Settings',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };

    const raw = fs.readFileSync(filePaths[0], 'utf-8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'Invalid backup file format.' };
    }

    const knownKeys = ['favorites', 'theme', 'widget_opacity', 'volume', 'custom_channels', 'track_history', 'widget_scale'];
    if (!knownKeys.some(k => Object.prototype.hasOwnProperty.call(data, k))) {
      return { ok: false, error: 'This file does not look like an SXM Widget backup.' };
    }

    if (Array.isArray(data.favorites)) {
      favorites = data.favorites.map(String);
    }
    if (data.theme && typeof data.theme === 'string') {
      currentTheme = data.theme;
    }
    if (typeof data.widget_opacity === 'number' && Number.isFinite(data.widget_opacity)) {
      widgetOpacity = Math.max(0.35, Math.min(1, data.widget_opacity));
      widgetWin.setOpacity(widgetOpacity);
    }
    if (typeof data.music_reactive_lights === 'boolean') {
      musicReactiveLights = data.music_reactive_lights;
    }
    if (typeof data.scroll_long_titles === 'boolean') {
      scrollLongTitles = data.scroll_long_titles;
    }
    if (typeof data.show_visualizer === 'boolean') {
      showVisualizer = data.show_visualizer;
    }
    if (typeof data.volume === 'number' && !Number.isNaN(data.volume)) {
      currentVolume = Math.max(0, Math.min(100, Math.round(data.volume)));
    }
    if (typeof data.is_muted === 'boolean') {
      isMuted = data.is_muted;
    }
    if (typeof data.widget_scale === 'number' && Number.isFinite(data.widget_scale)) {
      widgetScale = Math.max(0.75, Math.min(1.35, data.widget_scale));
    }
    if (Array.isArray(data.track_history)) {
      trackHistory = data.track_history.slice(0, MAX_TRACK_HISTORY);
    }

    // Rebuild channels from built-ins + imported custom channels
    channels = [...FREE_HOLIDAY_CHANNELS, ...DEFAULT_CHANNELS];
    if (Array.isArray(data.custom_channels)) {
      const existingNums = new Set(channels.map(c => String(c.number)));
      for (const ch of data.custom_channels) {
        if (ch && ch.number && !existingNums.has(String(ch.number))) {
          channels.push(ch);
          existingNums.add(String(ch.number));
        }
      }
    }

    if (data.last_channel) {
      const found = channels.find(c => String(c.number) === String(data.last_channel));
      if (found) currentChannel = found;
    }

    saveUserData();
    await applySxmAudioSettings();
    applyWidgetBoundsAndZoom();
    return { ok: true, state: getInitialStatePayload() };
  } catch (e) {
    return { ok: false, error: 'Failed to read backup file.' };
  }
});

ipcMain.handle('check_for_updates', async () => {
  return checkForUpdates(true);
});

app.whenReady().then(createWindows);

(() => {
'use strict';

// ---------------------------------------------------------------- rules
const W = 8, H = 16;
const TICK_MS = 1000 / 50;            // logic runs at 50 ticks per second
// Ticks a piece waits on a row before dropping, by speed step.
const GRAV = [56,54,53,51,49,48,46,44,43,41,39,38,36,34,33,31,29,28,26,24,23,21,19,18,16,15,14,13,12,11,10,9,9,8,7,6,6,5,5,5,
  4,4,4,4,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
const SPEED_BASE = [15, 25, 31];      // starting step for low / medium / high
const MAX_SPEED_UPS = 49;
const PIECES_PER_SPEED_UP = 10;
const MULT = [1, 2, 4, 8, 16, 32];
const DAS_FIRST = 13, DAS_RESET = 8;  // auto-repeat: first after 13 ticks, then every 5
const CLEAR_T = 14, FALL_T = 12, SPAWN_T = 8;

const COL = [
  { name: 'blue', b: '#3f7fe0', l: '#a9ccff', d: '#1f4aa0' },
  { name: 'green', b: '#5fbf2e', l: '#c6f29a', d: '#34791a' },
  { name: 'purple', b: '#9b4fd6', l: '#d9b3ff', d: '#5e2a94' },
  { name: 'orange', b: '#f58220', l: '#ffc98f', d: '#b0530c' },
];
const NC = COL.length;

// ---------------------------------------------------------------- text
const TEXT = {
  ru: { title: 'Алхимик и слизни', tagline: 'Собирай четыре камня одного цвета в ряд и растворяй слизней.',
    level: 'Уровень', speed: 'Скорость', slow: 'Низкая', medium: 'Средняя', fast: 'Высокая', best: 'Рекорд', play: 'Играть',
    score: 'Очки', slimes: 'Слизни', next: 'Далее', paused: 'Пауза', resume: 'Продолжить', menu: 'Меню',
    win: 'Котёл очищен!', nextLevel: 'Следующий уровень', over: 'Котёл переполнен', retry: 'Заново',
    revive: 'Продолжить за рекламу', leaders: 'Рейтинг', back: 'Назад', newBest: 'Новый рекорд!',
    lbLoading: 'Загрузка…', lbEmpty: 'Пока никого нет. Станьте первым!', lbError: 'Не удалось загрузить рейтинг.',
    lbAnon: 'Игрок', lbLogin: 'Войти, чтобы попасть в рейтинг', lbMine: 'Ваш рекорд',
    restart: 'Заново', resetTitle: 'Начать заново?', resetYes: 'Сбросить камни', cancel: 'Отмена',
    resetText: 'Все камни в котле исчезнут. Слизни останутся на своих местах, очки сохранятся.',
    howKeys: '← → двигать · ↓ ускорить · Z, X или ↑ повернуть · P пауза',
    howTouch: 'Ведите пальцем по котлу, чтобы двигать камни. Касание поворачивает, движение вниз ускоряет.' },
  en: { title: 'Alchemist vs Slimes', tagline: 'Line up four stones of one colour to dissolve the slimes.',
    level: 'Level', speed: 'Speed', slow: 'Low', medium: 'Medium', fast: 'High', best: 'Best', play: 'Play',
    score: 'Score', slimes: 'Slimes', next: 'Next', paused: 'Paused', resume: 'Resume', menu: 'Menu',
    win: 'Cauldron cleared!', nextLevel: 'Next level', over: 'The cauldron overflowed', retry: 'Retry',
    revive: 'Continue (watch ad)', leaders: 'Leaderboard', back: 'Back', newBest: 'New best!',
    lbLoading: 'Loading…', lbEmpty: 'Nobody here yet. Be the first!', lbError: 'Could not load the leaderboard.',
    lbAnon: 'Player', lbLogin: 'Sign in to join the leaderboard', lbMine: 'Your best',
    restart: 'Restart', resetTitle: 'Start over?', resetYes: 'Clear the stones', cancel: 'Cancel',
    resetText: 'All stones in the cauldron will vanish. The slimes stay where they are and your score is kept.',
    howKeys: '← → move · ↓ drop faster · Z, X or ↑ rotate · P pause',
    howTouch: 'Drag across the cauldron to move the stones. Tap to rotate, drag down to drop faster.' },
};
let lang = 'en';
const t = k => TEXT[lang][k] || TEXT.en[k] || k;

// ---------------------------------------------------------------- platform (Playgama Bridge)
const B = window.bridge || null;
const SAVE_KEY = 'alchemist_save_v1';
// level = the level to continue from, runScore = score carried into it
const save = { best: 0, unlocked: 0, level: 0, runScore: 0, speed: 0, sound: true };
const LB_ID = 'score';      // must match the id in playgama-bridge-config.json
const Plat = {
  ok: false, audioOn: true, rewardGranted: false, onReward: null,
  async init() {
    if (!B) { this.loadLocal(); return; }
    try {
      await B.initialize();
      this.ok = true;
      const l = String(B.platform.language || '').slice(0, 2).toLowerCase();
      lang = ['ru', 'be', 'uk', 'kk', 'uz'].includes(l) ? 'ru' : 'en';
      if (B.platform.isAudioEnabled === false) this.audioOn = false;
      const E = B.EVENT_NAME || {};
      B.platform.on(E.AUDIO_STATE_CHANGED || 'audio_state_changed', on => { this.audioOn = !!on; Snd.refresh(); });
      B.platform.on(E.PAUSE_STATE_CHANGED || 'pause_state_changed', p => setSysPaused(!!p));
      B.advertisement.on(E.INTERSTITIAL_STATE_CHANGED || 'interstitial_state_changed', s => {
        if (s === 'opened') setSysPaused(true);
        if (s === 'closed' || s === 'failed') setSysPaused(false);
      });
      B.advertisement.on(E.REWARDED_STATE_CHANGED || 'rewarded_state_changed', s => {
        if (s === 'opened') { this.rewardGranted = false; setSysPaused(true); }
        if (s === 'rewarded') this.rewardGranted = true;
        if (s === 'closed' || s === 'failed') {
          setSysPaused(false);
          const cb = this.onReward; this.onReward = null;
          if (cb && this.rewardGranted && s === 'closed') cb();
          this.rewardGranted = false;
        }
      });
      const data = await B.storage.get([SAVE_KEY]);
      this.apply(data && data[0]);
    } catch (e) {
      console.warn('bridge init failed', e);
      this.loadLocal();
    }
  },
  apply(raw) {
    if (!raw) return;
    try {
      const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v)) || 0));
      save.best = int(d.best, 1e12);
      save.unlocked = int(d.unlocked, 1e6);
      save.level = int(d.level, save.unlocked);
      save.runScore = int(d.runScore, 1e12);
      save.speed = int(d.speed, 2);
      save.sound = d.sound !== false;
    } catch (e) { /* ignore a broken save and start fresh */ }
  },
  // Local fallback only when the SDK is unavailable (opening the file outside a platform).
  loadLocal() {
    lang = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
    try { this.apply(localStorage.getItem(SAVE_KEY)); } catch (e) { /* storage blocked */ }
  },
  store() {
    const s = JSON.stringify(save);
    if (this.ok) { B.storage.set([SAVE_KEY], [s]).catch(() => {}); return; }
    try { localStorage.setItem(SAVE_KEY, s); } catch (e) { /* storage blocked */ }
  },
  msg(name, params) {
    if (!this.ok) return;
    try { params ? B.platform.sendMessage(name, params) : B.platform.sendMessage(name); } catch (e) { /* not relayed */ }
  },
  interstitial() {
    if (!this.ok) return;
    try { B.advertisement.showInterstitial(); } catch (e) { /* no ad */ }
  },
  get rewardedSupported() { return this.ok && !!B.advertisement.isRewardedSupported; },
  rewarded(cb) {
    if (!this.rewardedSupported) return;
    this.onReward = cb;
    try { B.advertisement.showRewarded(); } catch (e) { this.onReward = null; }
  },
  // 'in_game': we draw the table; 'native_popup': the platform opens its own window;
  // 'native': the platform shows the table outside the game; 'not_available': no leaderboard.
  lbType() {
    try { return (this.ok && B.leaderboards && B.leaderboards.type) || 'not_available'; } catch (e) { return 'not_available'; }
  },
  submitScore(score) {
    if (score <= 0 || this.lbType() === 'not_available') return;
    try { B.leaderboards.setScore(LB_ID, score).catch(() => {}); } catch (e) { /* leaderboard unavailable */ }
  },
  lbEntries() { return B.leaderboards.getEntries(LB_ID); },
  lbPopup() { return B.leaderboards.showNativePopup(LB_ID); },
  playerId() { try { return B.player.id; } catch (e) { return null; } },
  get canLogin() {
    try { return this.ok && !!B.player.isAuthorizationSupported && !B.player.isAuthorized; } catch (e) { return false; }
  },
  login() { return B.player.authorize(); },
};

// ---------------------------------------------------------------- sound (all synthesised)
// ---------------------------------------------------------------- sound
// Recorded sounds in assets/sounds; until a file is decoded (or if it fails) the old synth tone plays instead.
const SND_DIR = 'assets/sounds/';
// game event -> [file, loudness]. Every file is normalised to its peak first, so the number is the final level.
const SFX = {
  move: ['move', 0.3], rot: ['rotate', 0.4], lock: ['lock', 0.55], clear: ['clear', 0.6], combo: ['combo', 0.75],
  slime: ['slime', 0.6], throw: ['throw', 0.35], speed: ['speed', 0.55], click: ['click', 0.35],
  win: ['win', 0.75], over: ['over', 0.65],
};
const MUSIC = ['music-1', 'music-2', 'music-3', 'music-4'];   // level 1 -> track 1, level 5 -> track 1 again
const MUSIC_RMS = 0.05;        // background level of every track, before the master volume
const MUSIC_XF = 1.2;          // seconds of crossfade where a track loops back to its start
const MAX_BOOST = 40;          // a nearly silent file is not pushed beyond this

const Snd = {
  ctx: null, master: null, nextNote: 0, step: 0,
  raw: {}, buf: {},
  mus: { buf: {}, req: {}, fail: {}, track: -1, pos: 0, base: 0, loopAt: 0, voices: [] },
  // the small effect files are downloaded at start-up and decoded once audio is unlocked
  preload() {
    Object.values(SFX).forEach(([file]) => {
      fetch(SND_DIR + file + '.mp3').then(r => r.ok ? r.arrayBuffer() : null)
        .then(ab => { if (ab) { this.raw[file] = ab; this.decodeFx(file); } }).catch(() => {});
    });
  },
  decode(ab) {
    return new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(ab, res, rej);       // callback form for older Safari
      if (p && p.then) p.then(res, rej);
    });
  },
  decodeFx(file) {
    const ab = this.raw[file];
    if (!this.ctx || !ab) return;
    delete this.raw[file];
    this.decode(ab).then(b => { this.buf[file] = { b, g: 1 / Math.max(peakOf(b), 1 / MAX_BOOST) }; }).catch(e => { this.err = 'decode ' + file; });
  },
  // Phones only allow sound after a touch, and iPhones also mute Web Audio when the side switch is on silent.
  // unlock() is called on every touch/click, so it also revives a context that the system suspended or interrupted.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running' && !sysPaused) { try { this.ctx.resume().catch(() => {}); } catch (e) { /* not allowed yet */ } }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.err = 'no WebAudio'; return; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
    try { this.ctx = new AC(); } catch (e) { this.err = 'ctx: ' + e; return; }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    // play one silent sample inside the gesture: this is what actually starts the audio engine on iOS
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination); src.start(0);
    } catch (e) { /* ignore */ }
    this.keepAlive();
    Object.keys(this.raw).forEach(f => this.decodeFx(f));
    this.refresh();
  },
  // iOS before 16.4 has no audioSession: a looping silent <audio> makes the page a "media" page, which ignores the silent switch.
  keepAlive() {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!ios || navigator.audioSession) return;
    try {
      const n = 800, rate = 8000, d = new DataView(new ArrayBuffer(44 + n * 2));
      const w = (o, str) => { for (let i = 0; i < str.length; i++) d.setUint8(o + i, str.charCodeAt(i)); };
      w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true);
      d.setUint16(22, 1, true); d.setUint32(24, rate, true); d.setUint32(28, rate * 2, true); d.setUint16(32, 2, true);
      d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
      const a = document.createElement('audio');
      a.src = URL.createObjectURL(new Blob([d], { type: 'audio/wav' }));
      a.loop = true; a.setAttribute('playsinline', ''); a.play().catch(() => {});
      this.silent = a;
    } catch (e) { /* ignore */ }
  },
  refresh() {
    if (!this.ctx) return;
    const on = save.sound && Plat.audioOn && !sysPaused;
    this.master.gain.value = on ? 0.8 : 0;
    if (sysPaused) this.ctx.suspend(); else this.ctx.resume();
  },
  tone(freq, dur, type, vol, when, slide) {
    if (!this.ctx) return;
    const t0 = when || this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  fx(name, delay) {
    if (!this.ctx) return;
    const n = this.ctx.currentTime + (delay || 0);
    const def = SFX[name], B = def && this.buf[def[0]];
    if (B) {
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = B.b; g.gain.value = B.g * def[1];
      src.connect(g); g.connect(this.master);
      src.start(n);
      return;
    }
    if (name === 'move') this.tone(520, 0.04, 'square', 0.06, n);
    else if (name === 'rot') this.tone(700, 0.05, 'triangle', 0.12, n, 900);
    else if (name === 'lock') this.tone(160, 0.09, 'triangle', 0.25, n, 90);
    else if (name === 'clear' || name === 'combo') { this.tone(660, 0.12, 'triangle', 0.2, n, 1320); this.tone(990, 0.16, 'sine', 0.12, n + 0.06, 1760); }
    else if (name === 'slime') this.tone(300, 0.2, 'sawtooth', 0.1, n, 80);
    else if (name === 'win') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.2, n + i * 0.12));
    else if (name === 'over') [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.12, n + i * 0.18));
    else if (name === 'speed') this.tone(880, 0.1, 'square', 0.08, n, 1320);
  },

  // Background music: one track per level, cycling through MUSIC. Each track is fetched when its level
  // (or the level before it) is reached, loops with a short crossfade, and pauses where it stopped.
  loadTrack(i) {
    const M = this.mus;
    if (!this.ctx || M.buf[i] || M.req[i] || M.fail[i]) return;
    M.req[i] = true;
    fetch(SND_DIR + MUSIC[i] + '.mp3').then(r => { if (!r.ok) throw r.status; return r.arrayBuffer(); })
      .then(ab => this.decode(ab))
      .then(b => { M.buf[i] = { b, g: MUSIC_RMS / Math.max(rmsOf(b), 0.005) }; })
      .catch(() => { M.fail[i] = true; });
  },
  musicVoice(T, when, offset, fadeIn) {
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = T.b;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(T.g, when + fadeIn);
    src.connect(g); g.connect(this.master);
    src.start(when, offset);
    const v = { src, g };
    src.onended = () => { const k = this.mus.voices.indexOf(v); if (k >= 0) this.mus.voices.splice(k, 1); };
    this.mus.voices.push(v);
  },
  musicHalt(fade) {
    const now = this.ctx.currentTime;
    this.mus.voices.forEach(({ src, g }) => {
      g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + fade);
      try { src.stop(now + fade + 0.02); } catch (e) { /* already stopped */ }
    });
    this.mus.voices = [];
  },
  music() {
    if (!this.ctx) return;
    const M = this.mus, now = this.ctx.currentTime;
    const track = G.level % MUSIC.length;
    if (track !== M.track) { this.musicHalt(0.4); M.track = track; M.pos = 0; }   // a new level starts its track from the top
    this.loadTrack(track);
    this.loadTrack((G.level + 1) % MUSIC.length);                               // fetch the next level's track in advance
    if (G.mode !== 'play' || sysPaused) {
      if (M.voices.length) { M.pos = Math.max(0, now - M.base); this.musicHalt(0.3); }
      this.nextNote = 0;
      return;
    }
    const T = M.buf[track];
    if (!T) { if (M.fail[track]) this.synthMusic(); return; }
    const span = T.b.duration - MUSIC_XF;
    if (!M.voices.length) {
      M.pos %= span;
      const at = now + 0.03;
      this.musicVoice(T, at, M.pos, M.pos ? 0.3 : 0.05);
      M.base = at - M.pos; M.loopAt = M.base + span;
    }
    if (now > M.loopAt - 0.5) {                                                 // start the next pass and crossfade into it
      const at = Math.max(M.loopAt, now + 0.03);
      M.voices.forEach(({ src, g }) => {
        g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(T.g, at);
        g.gain.linearRampToValueAtTime(0, at + MUSIC_XF);
        try { src.stop(at + MUSIC_XF + 0.05); } catch (e) { /* already stopped */ }
      });
      this.musicVoice(T, at, 0, MUSIC_XF);
      M.base = at; M.loopAt = at + span;
    }
  },
  // Short original loop: bass on the beat, a wandering lead over a minor scale.
  synthMusic() {
    if (!this.ctx || G.mode !== 'play' || sysPaused) { this.nextNote = 0; return; }
    const now = this.ctx.currentTime;
    if (!this.nextNote || this.nextNote < now - 0.5) this.nextNote = now + 0.05;
    const beat = 0.2;
    const lead = [0, 3, 7, 10, 7, 3, 5, 8, 12, 8, 5, 3, 2, 5, 9, 5];
    const bass = [0, 0, -4, -4, -7, -7, -5, -5];
    while (this.nextNote < now + 0.25) {
      const s = this.step++;
      const f = n => 220 * Math.pow(2, n / 12);
      this.tone(f(lead[s % lead.length]), beat * 0.9, 'triangle', 0.045, this.nextNote);
      if (s % 2 === 0) this.tone(f(bass[(s >> 1) % bass.length] - 12), beat * 1.8, 'sine', 0.09, this.nextNote);
      this.nextNote += beat;
    }
  },
};
function peakOf(b) {
  let p = 0;
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = d[i] < 0 ? -d[i] : d[i]; if (a > p) p = a; } }
  return p;
}
function rmsOf(b) {
  const d = b.getChannelData(0); let q = 0;
  for (let i = 0; i < d.length; i += 4) q += d[i] * d[i];
  return Math.sqrt(q / Math.ceil(d.length / 4));
}

// ---------------------------------------------------------------- game state
const G = {
  mode: 'menu',          // menu | play | paused | win | over
  phase: 'spawn',        // spawn | control | clear | fall
  grid: new Array(W * H).fill(null),
  piece: null, next: null,
  level: 0, speedSel: 0, speedUps: 0, pieces: 0,
  score: 0, slimes: 0, combo: 0,
  timer: 0, grav: 0, das: 0, tick: 0, revived: false,
};
const In = { left: false, right: false, down: false, downLock: false, pl: false, pr: false, rot: [] };
let sysPaused = false;

const at = (x, y) => G.grid[y * W + x];
const free = (x, y) => x >= 0 && x < W && y < H && (y < 0 || !G.grid[y * W + x]);
const rnd = n => Math.floor(Math.random() * n);
const newPiece = () => ({ x: 3, y: 0, o: 0, a: rnd(NC), b: rnd(NC) });

function pieceCells(p) {
  switch (p.o) {
    case 0: return [[p.x, p.y, p.a, 2], [p.x + 1, p.y, p.b, 1]];
    case 1: return [[p.x, p.y, p.a, 3], [p.x, p.y - 1, p.b, 4]];
    case 2: return [[p.x, p.y, p.b, 2], [p.x + 1, p.y, p.a, 1]];
    default: return [[p.x, p.y, p.b, 3], [p.x, p.y - 1, p.a, 4]];
  }
}
function fits(x, y, o) {
  if (y < 0) return false;
  return (o & 1) ? free(x, y) && free(x, y - 1) : free(x, y) && free(x + 1, y);
}

// ---------------------------------------------------------------- endless levels
// Everything about level n is derived from n alone, so a level looks the same on every retry
// and the sequence never ends.
function seeded(seed) {                 // small deterministic generator (mulberry32)
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Layout shapes: which cells of the slime zone may hold a slime. d = row inside the zone, counted from its top.
const PATTERNS = [
  () => true,                                                          // scatter
  (x, d) => (x + d) % 2 === 0,                                         // checkerboard
  (x, d, rows, k) => x % 2 === k,                                      // columns
  (x, d, rows, k) => d % 2 === k,                                      // stripes
  (x, d, rows) => Math.abs(x - 3.5) < (d + 1) * 4 / rows + 0.5,        // pyramid
  (x, d, rows) => Math.abs(x - 3.5) > 3 - (d + 1) * 4 / rows,          // valley
  (x, d) => (x + d) % 4 < 2,                                           // diagonal bands
  x => x < 3 || x > 4,                                                 // two towers
];
function levelSpec(n) {
  const count = Math.min(48, 4 + Math.floor(n * 1.5));
  const rows = Math.min(12, Math.max(4 + Math.floor(n / 3), Math.ceil(count / 4.5)));
  const speedBonus = Math.min(14, Math.floor(Math.max(0, n - 20) / 4));   // past level 20 pieces also start faster
  return { count, rows, speedBonus };
}
function placeSlimes(level) {
  const { count, rows } = levelSpec(level);
  const rng = seeded(level * 7919 + 17);
  const pick = n => Math.floor(rng() * n);
  const pattern = level < 3 ? PATTERNS[0] : PATTERNS[pick(PATTERNS.length)];
  const k = pick(2), top = H - rows;
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = pick(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const inShape = [], rest = [];
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) (pattern(x, y - top, rows, k) ? inShape : rest).push([x, y]);
  let placed = 0;
  const fill = (cells, strict) => {
    for (const [x, y] of cells) {
      if (placed >= count) return;
      if (at(x, y)) continue;
      // Never the same colour two cells away, so no line is half-built at the start.
      const banned = new Set();
      [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && at(nx, ny)) banned.add(at(nx, ny).c);
      });
      // colours take turns so the mix stays even, with a random one thrown in now and then
      let c = placed % (NC + 1) === NC ? pick(NC) : placed % (NC + 1);
      let i = 0;
      while (banned.has(c) && i < NC) { c = (c + 1) % NC; i++; }
      if (banned.has(c) && strict) continue;
      G.grid[y * W + x] = { c, slime: true, link: 0, dying: false, ph: rng() * 6.28 };
      placed++;
    }
  };
  fill(shuffle(inShape), true);          // the shape first,
  fill(shuffle(rest), true);             // then anywhere in the zone if the shape is too small,
  fill(inShape.concat(rest), false);     // and as a last resort ignore the colour rule
  G.slimes = placed;
}

// How a slime feels: happy when left alone, alarmed once a matching stone is lined up with it,
// tired when the line needs just one more piece.
function slimeMood(x, y) {
  const c = at(x, y).c;
  let mood = 'happy';
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    let n = 1, stone = false;
    for (const dir of [1, -1]) {
      let nx = x + dx * dir, ny = y + dy * dir;
      while (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const o = at(nx, ny);
        if (!o || o.c !== c || o.dying) break;
        n++; if (!o.slime) stone = true;
        nx += dx * dir; ny += dy * dir;
      }
    }
    if (n >= 3) return 'tired';
    if (n === 2 && stone) mood = 'alarm';
  }
  return mood;
}

function startLevel(level, keepScore) {
  G.grid.fill(null);
  G.level = level; G.speedSel = save.speed;
  G.speedUps = 0; G.speedBonus = levelSpec(level).speedBonus; G.pieces = 0; G.combo = 0; G.revived = false;
  if (!keepScore) G.score = 0;
  placeSlimes(level);
  G.next = newPiece(); G.piece = null;
  G.mode = 'play';
  G.phase = 'spawn'; G.timer = 20; scheduleThrow(20);
  Snd.mus.pos = 0;                                       // every start of a level plays its track from the top
  In.rot.length = 0; In.pl = In.pr = false;
  save.level = level; save.runScore = G.score; Plat.store();
  Plat.msg('level_started', { world: 'cauldron', level: String(level + 1) });
  showOverlay(null);
}

function spawn() {
  G.piece = G.next; G.next = newPiece();
  G.combo = 0; G.grav = 0; G.das = 0;
  In.downLock = In.down;
  In.rot.length = 0; In.pl = In.pr = false;
  if (!fits(G.piece.x, G.piece.y, 0)) { gameOver(); return; }
  G.pieces++;
  if (G.pieces % PIECES_PER_SPEED_UP === 0 && G.speedUps < MAX_SPEED_UPS) { G.speedUps++; Snd.fx('speed'); }
  G.phase = 'control';
}
// Time the throw so the piece lands in the cauldron on the tick it spawns.
function scheduleThrow(ticks) {
  const delay = Math.max(0, ticks - SPAWN_T) * TICK_MS / 1000;
  throwAt = performance.now() / 1000 + delay;
  if (G.mode === 'play') Snd.fx('throw', delay);
}

function tryMove(dx) {
  const p = G.piece;
  if (fits(p.x + dx, p.y, p.o)) { p.x += dx; Snd.fx('move'); return true; }
  return false;
}
function rotate(dir) {
  const p = G.piece, no = (p.o + dir + 4) & 3;
  if (no & 1) {
    if (fits(p.x, p.y, no)) { p.o = no; Snd.fx('rot'); }
  } else if (fits(p.x, p.y, no)) {
    p.o = no; Snd.fx('rot');
    if (In.left && fits(p.x - 1, p.y, no)) p.x--;
  } else if (fits(p.x - 1, p.y, no)) {        // kick one cell left when the right side is blocked
    p.x--; p.o = no; Snd.fx('rot');
  }
}
function drop() {
  const p = G.piece;
  G.grav = 0;
  if (fits(p.x, p.y + 1, p.o)) { p.y++; return; }
  const cells = pieceCells(p);
  const lost = cells.some(c => c[1] < 0);
  cells.forEach(([x, y, c, link]) => {
    if (y >= 0) G.grid[y * W + x] = { c, slime: false, link: lost ? 0 : link, dying: false, ph: 0 };
  });
  G.piece = null;
  Snd.fx('lock');
  G.chain = 0;
  check();
}

function control() {
  while (In.rot.length) rotate(In.rot.shift());
  if (In.pl || In.pr) {
    G.das = 0;
    if (In.pl && !tryMove(-1)) G.das = DAS_FIRST - 1;
    if (In.pr && !tryMove(1)) G.das = DAS_FIRST - 1;
    In.pl = In.pr = false;
  } else if (In.left !== In.right) {
    if (++G.das >= DAS_FIRST) {
      G.das = DAS_RESET;
      if (!tryMove(In.left ? -1 : 1)) G.das = DAS_FIRST - 1;
    }
  }
  if (!G.piece) return;
  const speed = Math.min(SPEED_BASE[G.speedSel] + G.speedUps + (G.speedBonus || 0), GRAV.length - 1);
  if (In.down && !In.downLock && (G.tick & 1)) drop();
  else if (++G.grav > GRAV[speed]) drop();
}

function check() {
  const hit = new Set();
  const scan = (x, y, dx, dy) => {
    let run = [];
    for (; x < W && y < H; x += dx, y += dy) {
      const c = at(x, y);
      if (c && run.length && at(run[0] % W, (run[0] / W) | 0).c === c.c) run.push(y * W + x);
      else { if (run.length >= 4) run.forEach(i => hit.add(i)); run = c ? [y * W + x] : []; }
    }
    if (run.length >= 4) run.forEach(i => hit.add(i));
  };
  for (let y = 0; y < H; y++) scan(0, y, 1, 0);
  for (let x = 0; x < W; x++) scan(x, 0, 0, 1);
  if (!hit.size) { G.phase = 'spawn'; G.timer = SPAWN_T; scheduleThrow(SPAWN_T); return; }
  let killed = 0;
  hit.forEach(i => {
    const c = G.grid[i];
    c.dying = true;
    if (c.slime) {
      G.score += (G.speedSel + 1) * 100 * MULT[Math.min(G.combo, MULT.length - 1)];
      G.combo++; G.slimes--; killed++;
    }
  });
  G.chain = (G.chain || 0) + 1;                          // second and later clears from one piece are a chain
  Snd.fx(G.chain > 1 ? 'combo' : 'clear'); if (killed) Snd.fx('slime');
  G.phase = 'clear'; G.timer = CLEAR_T;
}

const LINK_D = { 1: [-1, 0], 2: [1, 0], 3: [0, -1], 4: [0, 1] };
function removeCell(i) {
  const c = G.grid[i];
  if (!c) return;
  if (c.link) {
    const [dx, dy] = LINK_D[c.link];
    const px = (i % W) + dx, py = ((i / W) | 0) + dy;
    if (px >= 0 && px < W && py >= 0 && py < H && G.grid[py * W + px]) G.grid[py * W + px].link = 0;
  }
  G.grid[i] = null;
}
function finishClear() {
  for (let i = 0; i < G.grid.length; i++) if (G.grid[i] && G.grid[i].dying) removeCell(i);
  if (G.slimes <= 0) { win(); return; }
  G.phase = 'fall'; G.timer = FALL_T;
}
function fallStep() {
  let moved = false;
  for (let y = H - 2; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      if (!c || c.slime || c.link === 1) continue;
      if (c.link === 2) {
        if (!at(x, y + 1) && !at(x + 1, y + 1)) {
          G.grid[(y + 1) * W + x] = c; G.grid[(y + 1) * W + x + 1] = at(x + 1, y);
          G.grid[y * W + x] = null; G.grid[y * W + x + 1] = null; moved = true;
        }
      } else if (!at(x, y + 1)) {
        G.grid[(y + 1) * W + x] = c; G.grid[y * W + x] = null; moved = true;
      }
    }
  }
  return moved;
}

function tick() {
  G.tick++;
  if (G.phase === 'control') control();
  else if (G.phase === 'spawn') { if (--G.timer <= 0) spawn(); }
  else if (G.phase === 'clear') { if (--G.timer <= 0) finishClear(); }
  else if (G.phase === 'fall') {
    if (--G.timer <= 0) { if (fallStep()) G.timer = FALL_T; else check(); }
  }
}

function recordScore() {
  const beaten = G.score > save.best;
  if (beaten) save.best = G.score;
  Plat.submitScore(save.best);
  $('winRecord').style.display = $('overRecord').style.display = beaten ? '' : 'none';
}
function win() {
  G.mode = 'win';
  save.unlocked = Math.max(save.unlocked, G.level + 1);
  save.level = G.level + 1; save.runScore = G.score;      // a returning player continues from the next level
  recordScore(); Plat.store();
  Snd.fx('win');
  Plat.msg('level_completed', { world: 'cauldron', level: String(G.level + 1) });
  $('winScore').textContent = G.score;
  showOverlay('ovWin');
  Plat.interstitial();
}
function gameOver() {
  G.mode = 'over';
  save.runScore = 0;                                      // a failed run starts the level again from zero
  recordScore(); Plat.store();
  Snd.fx('over');
  Plat.msg('level_failed', { world: 'cauldron', level: String(G.level + 1) });
  $('overScore').textContent = G.score;
  $('btnRevive').style.display = Plat.rewardedSupported && !G.revived ? '' : 'none';
  showOverlay('ovOver');
  if (G.revived || !Plat.rewardedSupported) Plat.interstitial();
}
// Reward: empty the upper half of the cauldron of stones and carry on.
function revive() {
  G.revived = true;
  for (let i = 0; i < W * 8; i++) if (G.grid[i] && !G.grid[i].slime) removeCell(i);
  G.piece = null; G.phase = 'fall'; G.timer = FALL_T; G.mode = 'play';
  showOverlay(null);
}
// "Restart" button: every stone leaves the cauldron, the slimes keep their places.
function askReset() {
  if (G.mode !== 'play') return;
  G.mode = 'paused';
  showOverlay('ovReset');
}
function resetStones() {
  // dying cells go too: their slimes were already counted as dissolved
  for (let i = 0; i < G.grid.length; i++) if (G.grid[i] && (!G.grid[i].slime || G.grid[i].dying)) G.grid[i] = null;
  G.mode = 'play'; last = 0; acc = 0;
  if (G.slimes <= 0) { win(); return; }
  G.piece = null; G.combo = 0; G.chain = 0;
  In.left = In.right = In.down = In.downLock = In.pl = In.pr = false; In.rot.length = 0;
  G.phase = 'spawn'; G.timer = 20; scheduleThrow(20);
  showOverlay(null);
}

// ---------------------------------------------------------------- UI
const $ = id => document.getElementById(id);
const canvas = $('c'), ctx = canvas.getContext('2d');
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let menuLevel = 0;

function showOverlay(id) {
  ['ovMenu', 'ovPause', 'ovReset', 'ovWin', 'ovOver', 'ovLeaders'].forEach(o => $(o).classList.toggle('show', o === id));
  const playing = G.mode === 'play';
  $('hudBtns').classList.toggle('show', playing);
  $('touch').classList.toggle('show', playing && isTouch);
}
function applyText() {
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  $('howto').textContent = t(isTouch ? 'howTouch' : 'howKeys');
  $('btnReset').title = t('restart'); $('btnReset').setAttribute('aria-label', t('restart'));
}
function refreshMenu() {
  menuLevel = Math.max(0, Math.min(menuLevel, save.unlocked));
  $('lvVal').textContent = menuLevel + 1;
  $('lvDown').disabled = menuLevel <= 0;
  $('lvUp').disabled = menuLevel >= save.unlocked;
  $('menuBest').textContent = save.best;
  $('btnPlay').textContent = t(menuLevel === save.level && save.level > 0 ? 'resume' : 'play');
  document.querySelectorAll('#speedSeg button').forEach(b => b.classList.toggle('on', +b.dataset.s === save.speed));
  $('btnSound').style.opacity = save.sound ? 1 : 0.4;
  $('btnLeaders').style.display = ['in_game', 'native_popup'].includes(Plat.lbType()) ? '' : 'none';
}
function openLeaders() {
  if (Plat.lbType() === 'native_popup') { try { Plat.lbPopup().catch(() => {}); } catch (e) { /* no popup */ } return; }
  showOverlay('ovLeaders');
  loadLeaders();
}
function loadLeaders() {
  const list = $('lbList'), msg = $('lbMsg');
  list.textContent = ''; msg.textContent = t('lbLoading');
  $('lbMine').textContent = save.best;
  $('btnLbLogin').style.display = Plat.canLogin ? '' : 'none';
  let req;
  try { req = Promise.resolve(Plat.lbEntries()); } catch (e) { req = Promise.reject(e); }
  req.then(rows => {
    rows = Array.isArray(rows) ? rows : [];
    msg.textContent = rows.length ? '' : t('lbEmpty');
    const me = Plat.playerId();
    rows.slice(0, 50).forEach((e, i) => {
      const li = document.createElement('li');
      if (me != null && e.id != null && String(e.id) === String(me)) li.className = 'me';
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = e.rank || i + 1;
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = e.name || t('lbAnon');
      const sc = document.createElement('b'); sc.textContent = Number(e.score) || 0;
      li.append(rk, nm, sc); list.appendChild(li);
    });
  }).catch(() => { msg.textContent = t('lbError'); });
}
function toMenu() {
  G.mode = 'menu';
  menuLevel = Math.min(save.level, save.unlocked);
  refreshMenu();
  showOverlay('ovMenu');
}
function pause() {
  if (G.mode !== 'play') return;
  G.mode = 'paused';
  Plat.msg('level_paused', { world: 'cauldron', level: String(G.level + 1) });
  showOverlay('ovPause');
}
function resume() {
  if (G.mode !== 'paused') return;
  G.mode = 'play'; last = 0; acc = 0;
  Plat.msg('level_resumed', { world: 'cauldron', level: String(G.level + 1) });
  showOverlay(null);
}
function setSysPaused(p) {
  if (sysPaused === p) return;
  sysPaused = p;
  if (p) pause();
  last = 0; acc = 0;
  Snd.refresh();
}

function bindUI() {
  const click = (id, fn) => $(id).addEventListener('click', () => { Snd.unlock(); Snd.fx('click'); fn(); });
  click('lvDown', () => { menuLevel--; refreshMenu(); });
  click('lvUp', () => { menuLevel++; refreshMenu(); });
  document.querySelectorAll('#speedSeg button').forEach(b => b.addEventListener('click', () => {
    Snd.unlock(); Snd.fx('click');
    save.speed = +b.dataset.s; Plat.store(); refreshMenu();
  }));
  click('btnPlay', () => {
    const cont = menuLevel === save.level;                // continuing keeps the score earned so far
    if (cont) G.score = save.runScore;
    startLevel(menuLevel, cont);
  });
  click('btnLeaders', openLeaders);
  click('btnLbBack', toMenu);
  click('btnLbLogin', () => {
    // after signing in, send the record again: guests' scores are not kept by some platforms
    try { Plat.login().then(() => { Plat.submitScore(save.best); loadLeaders(); }).catch(() => {}); } catch (e) { /* not supported */ }
  });
  click('btnPause', pause);
  click('btnResume', resume);
  click('btnReset', askReset);
  click('btnResetYes', resetStones);
  click('btnResetNo', resume);
  click('btnPauseMenu', toMenu);
  click('btnNext', () => startLevel(G.level + 1, true));
  click('btnWinMenu', toMenu);
  click('btnRetry', () => startLevel(G.level, false));
  click('btnOverMenu', toMenu);
  click('btnRevive', () => Plat.rewarded(revive));
  click('btnSound', () => { save.sound = !save.sound; Plat.store(); Snd.refresh(); refreshMenu(); });

  // keyboard
  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
    ArrowUp: 'cw', KeyW: 'cw', KeyX: 'cw', Space: 'cw', KeyZ: 'ccw' };
  addEventListener('keydown', e => {
    if (e.code === 'KeyP') { if (G.mode === 'play') pause(); else resume(); return; }
    const k = keyMap[e.code];
    if (!k) return;
    e.preventDefault();
    Snd.unlock();
    if (!e.repeat) press(k);
  });
  addEventListener('keyup', e => { const k = keyMap[e.code]; if (k) release(k); });

  // on-screen buttons
  document.querySelectorAll('#touch button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); Snd.unlock(); b.classList.add('held'); press(k); });
    const up = () => { b.classList.remove('held'); release(k); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });

  // gestures on the cauldron: drag to move, drag down to drop, tap to rotate
  let gs = null;
  canvas.addEventListener('pointerdown', e => {
    Snd.unlock();
    if (G.mode !== 'play') return;
    gs = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, t: performance.now(), moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!gs || e.pointerId !== gs.id) return;
    const step = L.cell * 0.9;
    while (e.clientX - gs.lx > step) { gs.lx += step; gs.moved = true; press('right'); release('right'); }
    while (gs.lx - e.clientX > step) { gs.lx -= step; gs.moved = true; press('left'); release('left'); }
    const down = e.clientY - gs.y0 > L.cell * 1.5;
    if (down && !In.down) { gs.moved = true; press('down'); }
    if (!down && In.down && gs.moved) release('down');
  });
  const end = e => {
    if (!gs || e.pointerId !== gs.id) return;
    if (In.down) release('down');
    const still = Math.hypot(e.clientX - gs.x0, e.clientY - gs.y0) < 12;
    if (!gs.moved && still && performance.now() - gs.t < 350 && e.type === 'pointerup') {
      press(e.clientX < L.fx + L.cell * W / 2 ? 'ccw' : 'cw');
    }
    gs = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', layout);
  addEventListener('blur', () => { In.left = In.right = In.down = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setSysPaused(true); else setSysPaused(false); });
  // any touch anywhere (swipes on the field included) starts or revives the audio
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(ev => addEventListener(ev, () => Snd.unlock(), { capture: true, passive: true }));
  if (/[?&]debug\b/.test(location.search)) audioDebug();
}
// ?debug on the address shows the audio state on screen, to report what a phone does
function audioDebug() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;font:11px/1.3 monospace;color:#fff;background:rgba(0,0,0,.7);padding:3px 5px;pointer-events:none;max-width:70vw';
  document.body.appendChild(el);
  setInterval(() => {
    const c = Snd.ctx;
    el.textContent = 'ctx ' + (c ? c.state : 'none') + ' | gain ' + (Snd.master ? Snd.master.gain.value : '-') + ' | sfx ' + Object.keys(Snd.buf).length +
      '/11 | music ' + Object.keys(Snd.mus.buf).length + ' voices ' + Snd.mus.voices.length + ' | snd ' + save.sound + ' audioOn ' + Plat.audioOn +
      ' sys ' + sysPaused + (navigator.audioSession ? ' | session ' + navigator.audioSession.type : '') + (Snd.err ? ' | ERR ' + Snd.err : '');
  }, 500);
}
function press(k) {
  if (G.mode !== 'play') return;
  if (k === 'left') { In.left = true; In.pl = true; }
  else if (k === 'right') { In.right = true; In.pr = true; }
  else if (k === 'down') { In.down = true; In.downLock = false; }
  else if (G.phase === 'control') In.rot.push(k === 'cw' ? -1 : 1);
}
function release(k) {
  if (k === 'left') In.left = false;
  else if (k === 'right') In.right = false;
  else if (k === 'down') { In.down = false; In.downLock = false; }
}

// ---------------------------------------------------------------- layout + drawing
const L = { w: 0, h: 0, dpr: 1, cell: 20, fx: 0, fy: 0, portrait: true };
// Cauldron art (assets/cauldron.webp): image size and the hollow inside it, which is exactly the 8×16 field.
const CAUL = { w: 908, h: 1502, x: 147, y: 188, iw: 614 };
const CAUL_K = W / CAUL.iw;                                   // image px → cells
const CAUL_SIDE = 1.35;                                       // cells of wall + handles kept on screen each side
const CAUL_BOT = (CAUL.h - CAUL.y - CAUL.iw * 2) * CAUL_K;    // cells of wall + feet below the field
const CAUL_LID = 0.8;                                         // cells from the field top up to the lid the alchemist stands on
function layout() {
  L.w = innerWidth; L.h = innerHeight;
  L.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(L.w * L.dpr); canvas.height = Math.round(L.h * L.dpr);
  L.portrait = L.h >= L.w * 1.1;
  const ctrl = isTouch ? (L.h <= 560 ? 72 : 84) : 0;
  if (L.portrait) {
    // the band above the cauldron is where the alchemist stands
    const hud = Math.max(70, Math.min(130, L.h * 0.125));
    // the cauldron's bottom wall/feet may sit behind the touch buttons, so only the 16 rows are reserved
    const bot = isTouch ? 0 : CAUL_BOT;
    L.cell = Math.floor(Math.min((L.w - 8) / (W + CAUL_SIDE * 2), (L.h - hud - ctrl - 14) / (H + bot)));
    L.fx = Math.round((L.w - L.cell * W) / 2);
    L.fy = Math.round(hud + 10 + (L.h - hud - ctrl - 14 - L.cell * (H + bot)) / 2);
    L.hud = hud;
  } else {
    const hud = Math.max(76, Math.min(170, L.h * 0.18));
    L.cell = Math.floor(Math.min((L.h - hud - 20) / (H + CAUL_BOT), (L.w - 40) / (W + 8)));
    L.fx = Math.round((L.w - L.cell * W) / 2);
    L.fy = Math.round(hud + 10 + (L.h - hud - 20 - L.cell * (H + CAUL_BOT)) / 2);
    L.hud = hud;
  }
}

function rr(x, y, w, h, r) {     // r = [tl, tr, br, bl]
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y); ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
  ctx.lineTo(x + w, y + h - r[2]); ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
  ctx.lineTo(x + r[3], y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
  ctx.lineTo(x, y + r[0]); ctx.quadraticCurveTo(x, y, x + r[0], y);
  ctx.closePath();
}
function drawStone(px, py, s, c, link, k) {
  const col = COL[c], m = s * 0.06, R = s * 0.34, r0 = s * 0.06;
  const sc = k === undefined ? 1 : k;
  const img = SPR.stones;
  if (img) {
    // atlas: one row per colour; columns: single, halves for link 1..4, shatter. 144px cells, the game cell is the middle 128.
    const A = 144, e = s * 8 / 128, burst = link === 5;
    const z = burst ? 1 + 0.35 * (1 - sc) : sc;
    ctx.save();
    ctx.translate(px + s / 2, py + s / 2); ctx.scale(z, z); ctx.translate(-s / 2, -s / 2);
    ctx.drawImage(img, link * A, c * A, A, A, -e, -e, s + 2 * e, s + 2 * e);
    ctx.restore();
    return;
  }
  if (link === 5) link = 0;
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2); ctx.scale(sc, sc); ctx.translate(-s / 2, -s / 2);
  // corners stay sharp on the side joined to the other half
  const r = [R, R, R, R];
  let x = m, y = m, w = s - 2 * m, h = s - 2 * m;
  if (link === 2) { r[1] = r[2] = r0; w += m; }
  if (link === 1) { r[0] = r[3] = r0; x -= m; w += m; }
  if (link === 3) { r[0] = r[1] = r0; y -= m; h += m; }
  if (link === 4) { r[2] = r[3] = r0; h += m; }
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, col.l); g.addColorStop(0.45, col.b); g.addColorStop(1, col.d);
  ctx.fillStyle = g; rr(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineJoin = 'round';
  const cx = s / 2, cy = s / 2, q = s * 0.19;
  ctx.beginPath();
  if (c === 0) ctx.arc(cx, cy, q, 0, 6.3);
  else if (c === 1) { ctx.moveTo(cx, cy - q * 1.1); ctx.lineTo(cx + q * 1.1, cy + q * 0.9); ctx.lineTo(cx - q * 1.1, cy + q * 0.9); ctx.closePath(); }
  else if (c === 2) { ctx.moveTo(cx, cy - q * 1.25); ctx.lineTo(cx + q, cy); ctx.lineTo(cx, cy + q * 1.25); ctx.lineTo(cx - q, cy); ctx.closePath(); }
  else { ctx.arc(cx - q * 0.15, cy, q * 1.05, 0.9, Math.PI * 2 - 0.9); }      // crescent
  ctx.stroke();
  ctx.restore();
}
function drawSlime(px, py, s, c, ph, time, k, mood) {
  const col = COL[c], sc = k === undefined ? 1 : k;
  const wob = Math.sin(time * 3.5 + ph) * 0.05;
  const img = SPR['slime-' + COL[c].name + '-' + (mood || 'happy')];
  if (img) {
    const f = s * 0.98 / 128;
    const w = img.width * f * sc * (1 - wob * 0.6), h = img.height * f * sc * (1 + wob);
    ctx.drawImage(img, px + s / 2 - w / 2, py + s * 0.97 - h - (1 - sc) * s * 0.3, w, h);
    return;
  }
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2); ctx.scale(sc * (1 - wob * 0.6), sc * (1 + wob)); ctx.translate(-s / 2, -s / 2);
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, col.l); g.addColorStop(0.6, col.b); g.addColorStop(1, col.d);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(s * 0.08, s * 0.86);
  ctx.bezierCurveTo(s * 0.0, s * 0.02, s * 1.0, s * 0.02, s * 0.92, s * 0.86);
  ctx.quadraticCurveTo(s * 0.5, s * 0.98, s * 0.08, s * 0.86);
  ctx.fill();
  if (c === 2) {                      // horns
    ctx.beginPath();
    ctx.moveTo(s * 0.26, s * 0.3); ctx.lineTo(s * 0.2, s * 0.08); ctx.lineTo(s * 0.38, s * 0.24);
    ctx.moveTo(s * 0.74, s * 0.3); ctx.lineTo(s * 0.8, s * 0.08); ctx.lineTo(s * 0.62, s * 0.24);
    ctx.fill();
  }
  const blink = Math.sin(time * 1.3 + ph * 3) > 0.96 ? 0.15 : 1;
  const eye = (ex, ey, er) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, ey, er, er * blink, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1b1230'; ctx.beginPath(); ctx.ellipse(ex + er * 0.15, ey + er * 0.1, er * 0.5, er * 0.5 * blink, 0, 0, 6.3); ctx.fill();
  };
  if (c === 0) eye(s * 0.5, s * 0.5, s * 0.17);
  else { eye(s * 0.34, s * 0.52, s * 0.12); eye(s * 0.66, s * 0.52, s * 0.12); }
  ctx.strokeStyle = '#1b1230'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.lineCap = 'round';
  ctx.beginPath();
  if (c === 1) ctx.arc(s * 0.5, s * 0.68, s * 0.1, 0.2, Math.PI - 0.2);
  else { ctx.moveTo(s * 0.4, s * 0.76); ctx.lineTo(s * 0.6, s * 0.76); }
  ctx.stroke();
  ctx.restore();
}
// Alchemist sprites, all cut from one sheet at the same scale; drawn anchored to the bottom centre.
const SPR = {};
const SPR_NAMES = ['idle', 'windup', 'throw', 'follow', 'cheer'];
const SPR_FILES = {};
SPR_NAMES.forEach(n => { SPR_FILES[n] = `alchemist-${n}`; });
SPR_FILES.stones = 'stones';
SPR_FILES.background = 'background.jpg';
SPR_FILES.backgroundPortrait = 'background-portrait.jpg';
SPR_FILES.cauldron = 'cauldron.webp';
COL.forEach(c => ['happy', 'alarm', 'tired'].forEach(m => { SPR_FILES[`slime-${c.name}-${m}`] = `slime-${c.name}-${m}`; }));
const SPR_IDLE_H = 251;
let throwAt = -1e9;                    // time of the last throw, in seconds
function loadSprites() {
  return Promise.all(Object.keys(SPR_FILES).map(n => new Promise(res => {
    const img = new Image();
    img.onload = () => { SPR[n] = img; res(); };
    img.onerror = res;                 // missing art falls back to the drawn figure
    img.src = 'assets/' + SPR_FILES[n] + (SPR_FILES[n].includes('.') ? '' : '.png');
  })));
}
function drawAlchemist(x, y, s, time) {
  const dt = time - throwAt;
  const pose = G.mode === 'win' ? 'cheer' : dt < 0 ? 'idle' : dt < 0.07 ? 'windup' : dt < 0.2 ? 'throw' : dt < 0.42 ? 'follow' : 'idle';
  const img = SPR[pose] || SPR.idle;
  if (img) {
    const k = s / SPR_IDLE_H;
    const breathe = pose === 'idle' ? 1 + Math.sin(time * 2.2) * 0.015 : 1;
    const w = img.width * k, h = img.height * k * breathe;
    ctx.drawImage(img, x + s / 2 - w / 2, y + s - h, w, h);
    return;
  }
  const bob = Math.sin(time * 2) * s * 0.02;
  ctx.save(); ctx.translate(x, y + bob);
  ctx.fillStyle = '#3a6ea5';                                   // robe
  ctx.beginPath(); ctx.moveTo(s * 0.2, s); ctx.lineTo(s * 0.32, s * 0.55); ctx.lineTo(s * 0.68, s * 0.55); ctx.lineTo(s * 0.8, s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffc94d'; ctx.fillRect(s * 0.47, s * 0.58, s * 0.06, s * 0.42);
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(s * 0.5, s * 0.42, s * 0.17, 0, 6.3); ctx.fill();   // face
  ctx.fillStyle = '#2b4f7a';                                   // hat
  ctx.beginPath(); ctx.moveTo(s * 0.26, s * 0.34); ctx.quadraticCurveTo(s * 0.5, s * 0.22, s * 0.62, s * -0.02);
  ctx.quadraticCurveTo(s * 0.66, s * 0.24, s * 0.74, s * 0.34); ctx.closePath(); ctx.fill();
  ctx.fillRect(s * 0.2, s * 0.31, s * 0.6, s * 0.06);
  ctx.strokeStyle = '#5c4326'; ctx.lineWidth = s * 0.03;      // goggles
  ctx.fillStyle = '#9fe8ff';
  [0.42, 0.58].forEach(gx => { ctx.beginPath(); ctx.arc(s * gx, s * 0.42, s * 0.065, 0, 6.3); ctx.fill(); ctx.stroke(); });
  ctx.strokeStyle = '#8a4b2a'; ctx.lineWidth = s * 0.025; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(s * 0.5, s * 0.5, s * 0.05, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.restore();
}

const FONT = { fam: null, k: 1 };
function fontCfg() {                                   // the face and size factor come from the CSS variables in index.html
  if (!FONT.fam) {
    const cs = getComputedStyle(document.documentElement);
    FONT.fam = cs.getPropertyValue('--font').trim() || 'sans-serif';
    FONT.k = parseFloat(cs.getPropertyValue('--cfs')) || 1;
  }
  return FONT;
}
function label(txt, x, y, size, color, align) {
  const f = fontCfg();
  ctx.font = `700 ${Math.round(size * f.k)}px ${f.fam}, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
  ctx.fillText(txt, x, y);
}
function stat(name, value, x, y, s, align) {
  label(name.toUpperCase(), x, y, s * 0.55, '#b3a6d9', align);
  label(String(value), x, y + s * 0.65, s, '#f3ecff', align);
}

function draw(time) {
  const s = L.cell, fx = L.fx, fy = L.fy, fw = s * W, fh = s * H;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, L.h);
  bg.addColorStop(0, '#221a40'); bg.addColorStop(1, '#120d22');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, L.w, L.h);
  const room = L.h > L.w ? (SPR.backgroundPortrait || SPR.background) : (SPR.background || SPR.backgroundPortrait);
  if (room) {
    // cover the screen, keeping the middle of the room (the empty floor) under the field
    const k = Math.max(L.w / room.width, L.h / room.height);
    const dw = room.width * k, dh = room.height * k;
    ctx.drawImage(room, (L.w - dw) / 2, (L.h - dh) / 2, dw, dh);
    // darken the top a little so the score stays readable over the shelves
    const sh = ctx.createLinearGradient(0, 0, 0, fy);
    sh.addColorStop(0, 'rgba(14,10,28,.55)'); sh.addColorStop(1, 'rgba(14,10,28,.15)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, L.w, fy);
    ctx.fillStyle = 'rgba(14,10,28,.15)'; ctx.fillRect(0, fy, L.w, L.h - fy);
  }

  // cauldron
  const caul = SPR.cauldron;
  const rim = caul ? s * CAUL_LID / 0.9 : Math.max(6, s * 0.3);
  if (caul) {
    // the art is hollow inside: fill the field with its dark stone and a checker that lines up with the cells
    ctx.fillStyle = '#1e162b'; ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 0; y < H; y++) for (let x = (y & 1); x < W; x += 2) ctx.fillRect(fx + x * s, fy + y * s, s, s);
    const k = s * CAUL_K;
    ctx.drawImage(caul, fx - CAUL.x * k, fy - CAUL.y * k, CAUL.w * k, CAUL.h * k);
  } else {
    ctx.fillStyle = '#3b3550'; rr(fx - rim, fy - rim * 0.4, fw + rim * 2, fh + rim * 1.4, [rim, rim, s * 1.4, s * 1.4]); ctx.fill();
    ctx.fillStyle = '#57506e'; rr(fx - rim * 1.5, fy - rim * 1.3, fw + rim * 3, rim * 1.3, [rim * 0.6, rim * 0.6, rim * 0.6, rim * 0.6]); ctx.fill();
    ctx.fillStyle = room ? 'rgba(14,10,28,.86)' : '#0e0a1c'; ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 0; y < H; y++) for (let x = (y & 1); x < W; x += 2) ctx.fillRect(fx + x * s, fy + y * s, s, s);
  }

  const clearK = G.phase === 'clear' ? Math.max(0, G.timer / CLEAR_T) : 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (!c) continue;
    const k = c.dying ? clearK : 1;
    const px = fx + x * s, py = fy + y * s;
    if (c.dying) { ctx.globalAlpha = 0.35 + 0.65 * clearK; }
    if (c.slime) drawSlime(px, py, s, c.c, c.ph, time, k, c.dying ? 'alarm' : slimeMood(x, y));
    else drawStone(px, py, s, c.c, c.dying ? 5 : c.link, k);
    if (c.dying && (c.slime || !SPR.stones)) {
      ctx.globalAlpha = 1 - clearK; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, s * (0.2 + 0.4 * (1 - clearK)), 0, 6.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (G.piece && G.mode !== 'menu') {
    ctx.save(); ctx.beginPath(); ctx.rect(fx, fy - s, fw, fh + s); ctx.clip();
    pieceCells(G.piece).forEach(([x, y, c, link]) => drawStone(fx + x * s, fy + y * s, s, c, link));
    ctx.restore();
  }

  if (G.mode === 'menu') return;
  // HUD
  // The alchemist stands on the left of the rim, holding the next piece out over the cauldron.
  const feet = fy - rim * 0.9;
  const size = Math.min(feet - 4, fw * 0.46);
  const ax = fx - rim * 0.5;
  drawAlchemist(ax, feet - size, size, time);
  const ns = Math.min(s * 0.66, size * 0.24);
  const hx = ax + size * 0.9, hy = feet - size * 0.62;       // where the next piece is held
  if (G.next) {
    // on a throw the piece flies from the hand to the spot where it enters the cauldron
    const dt = time - throwAt;
    const k = G.phase === 'spawn' && !G.piece ? Math.max(0, Math.min(1, (dt - 0.06) / 0.1)) : 0;
    const e = k * k * (3 - 2 * k);
    const sz = ns + (s - ns) * e;
    const px = hx + (fx + 3 * s - hx) * e;
    const py = hy + (fy - hy) * e - Math.sin(e * Math.PI) * size * 0.25;
    drawStone(px, py, sz, G.next.a, 2);
    drawStone(px + sz, py, sz, G.next.b, 1);
  }
  if (L.portrait) {
    // score, level and slimes sit to the right of the alchemist; the top right corner holds the buttons
    const ts = Math.max(12, Math.min(18, L.hud * 0.14)), top = 10;
    const x0 = hx + ns * 2 + 12;
    stat(t('score'), G.score, x0, top, ts);
    stat(t('level'), G.level + 1, x0, top + ts * 2.4, ts);
    stat(t('slimes'), G.slimes, x0 + ts * 4.4, top + ts * 2.4, ts);
  } else {
    const ts = Math.max(14, Math.min(26, s * 0.9));
    const lx = fx - (caul ? CAUL.x * s * CAUL_K : rim * 2) - 12;
    stat(t('score'), G.score, lx, fy, ts, 'right');
    stat(t('best'), Math.max(save.best, G.score), lx, fy + ts * 2.4, ts, 'right');
    stat(t('level'), G.level + 1, lx, fy + ts * 4.8, ts, 'right');
    stat(t('slimes'), G.slimes, lx, fy + ts * 7.2, ts, 'right');
  }
}

// ---------------------------------------------------------------- main loop
let last = 0, acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (G.mode === 'play' && !sysPaused) {
    if (last) acc += Math.min(100, now - last);
    last = now;
    while (acc >= TICK_MS && G.mode === 'play') { acc -= TICK_MS; tick(); }
  } else { last = 0; acc = 0; }
  Snd.music();
  draw(now / 1000);
}

async function boot() {
  layout();
  bindUI();
  Snd.preload();
  const fontReady = document.fonts ? Promise.race([Promise.all([document.fonts.load('700 20px ' + fontCfg().fam, 'Аа'), document.fonts.load('700 20px ' + fontCfg().fam, 'Aa')]), new Promise(r => setTimeout(r, 1500))]).catch(() => {}) : null;
  await Promise.all([Plat.init(), loadSprites(), fontReady]);
  applyText();
  // a few slimes behind the menu so the first frame is not empty
  placeSlimes(4);
  toMenu();
  requestAnimationFrame(frame);
  Plat.msg('game_ready');
}
window.__game = { G, In, save, Snd, Plat, refreshMenu, tick, startLevel, press, release };   // handle for debugging in the console
boot();
})();

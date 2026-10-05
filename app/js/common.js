/* 框架：屏幕管理 / 音效 / 难度记忆 / 游戏页装配 */
'use strict';

const GAMES = [];                       // 各游戏 js 调 registerGame 注册
function registerGame(def){ GAMES.push(def); }

const $ = (sel, el) => (el || document).querySelector(sel);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v === null ? d : v; }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
};

/* ---------- 轻量音效（WebAudio 本地合成，无外部资源） ---------- */
const Sfx = {
  ctx: null,
  enabled: store.get('sound', 'on') !== 'off',
  setEnabled(v){ this.enabled = v; store.set('sound', v ? 'on' : 'off'); },
  play(kind){
    if(!this.enabled) return;
    try{
      if(!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if(this.ctx.state === 'suspended') this.ctx.resume();
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination); o.type = 'sine';
      if(kind === 'place'){ o.frequency.value = 560; g.gain.setValueAtTime(.16, t); g.gain.exponentialRampToValueAtTime(.001, t + .09); o.start(t); o.stop(t + .1); }
      else if(kind === 'ai'){ o.frequency.value = 340; g.gain.setValueAtTime(.14, t); g.gain.exponentialRampToValueAtTime(.001, t + .09); o.start(t); o.stop(t + .1); }
      else if(kind === 'win'){ o.frequency.setValueAtTime(523, t); o.frequency.setValueAtTime(659, t + .12); o.frequency.setValueAtTime(784, t + .24); g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + .5); o.start(t); o.stop(t + .5); }
      else { o.frequency.setValueAtTime(392, t); o.frequency.setValueAtTime(262, t + .15); g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + .45); o.start(t); o.stop(t + .45); }
    }catch(e){}
  }
};

/* ---------- 屏幕切换 ---------- */
let currentGame = null;                 // 当前激活的控制器
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

/* ---------- 游戏页 DOM 装配 ---------- */
function buildGameScreen(def){
  const sec = document.createElement('section');
  sec.className = 'screen'; sec.id = 'screen-' + def.id;
  sec.innerHTML =
    '<header class="bar">' +
      '<button class="back">&#8249;</button><b>' + def.title + '</b><span class="sp"></span>' +
      '<button class="btn snd" data-snd>🔊</button>' +
      '<button class="btn" data-undo>悔棋</button>' +
      '<button class="btn primary" data-new>新局</button>' +
    '</header>' +
    '<div class="diffbar">' +
      '<span class="lb">模式</span><div class="seg" data-modeseg>' +
        ['ai|人机', 'pvp|双人'].map(it => {
          const d = it.split('|');
          return '<button data-m="' + d[0] + '">' + d[1] + '</button>';
        }).join('') +
      '</div>' +
      '<span class="lb" data-difflb>人机难度</span><div class="seg" data-diffseg>' +
        ['easy|简单', 'normal|普通', 'hard|困难'].map(it => {
          const d = it.split('|');
          return '<button data-d="' + d[0] + '">' + d[1] + '</button>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<div class="status"><span class="dot"></span><span class="msg"></span></div>' +
    '<div class="board-wrap"><canvas></canvas></div>' +
    '<div class="overlay hidden"><div class="panel"><h2></h2><p></p><button class="btn primary">再来一局</button></div></div>';
  $('#game-root').appendChild(sec);

  $('.back', sec).addEventListener('click', () => {
    if(currentGame && currentGame.destroy) currentGame.destroy();
    currentGame = null; showScreen('screen-home');
  });
  $('[data-new]', sec).addEventListener('click', () => game.newGame());
  $('[data-undo]', sec).addEventListener('click', () => game.undo());
  $('.overlay button', sec).addEventListener('click', () => game.newGame());
  const sndBtn = $('[data-snd]', sec);
  const syncSnd = () => { sndBtn.textContent = Sfx.enabled ? '🔊' : '🔇'; };
  sndBtn.addEventListener('click', () => { Sfx.setEnabled(!Sfx.enabled); syncSnd(); });
  syncSnd();

  const diff = store.get('diff-' + def.id, 'normal');
  const mode = store.get('mode-' + def.id, 'ai');
  syncDiffUI(sec, diff);
  syncModeUI(sec, mode);
  applyModeVisibility(sec, mode);
  sec.querySelectorAll('[data-diffseg] button').forEach(b => b.addEventListener('click', () => {
    store.set('diff-' + def.id, b.dataset.d);
    syncDiffUI(sec, b.dataset.d);
    if(game.setDifficulty) game.setDifficulty(b.dataset.d);
  }));
  sec.querySelectorAll('[data-modeseg] button').forEach(b => b.addEventListener('click', () => {
    store.set('mode-' + def.id, b.dataset.m);
    syncModeUI(sec, b.dataset.m);
    applyModeVisibility(sec, b.dataset.m);
    if(game.setMode) game.setMode(b.dataset.m);
    game.newGame();
  }));

  const game = def.create({
    root: sec,
    canvas: $('canvas', sec),
    statusMsg: $('.status .msg', sec),
    statusDot: $('.status .dot', sec),
    undoBtn: $('[data-undo]', sec),
    overlay: $('.overlay', sec)
  });
  game.difficulty = diff;
  if(game.setMode) game.setMode(mode);
  if(game.setDifficulty) game.setDifficulty(diff);
  sec._game = game;
  return sec;
}

function syncModeUI(sec, m){
  sec.querySelectorAll('[data-modeseg] button').forEach(b =>
    b.classList.toggle('on', b.dataset.m === m));
}
function applyModeVisibility(sec, m){
  const show = m === 'ai';
  sec.querySelector('[data-difflb]').style.display = show ? '' : 'none';
  sec.querySelector('[data-diffseg]').style.display = show ? '' : 'none';
}

function syncDiffUI(sec, d){
  sec.querySelectorAll('.seg button').forEach(b =>
    b.classList.toggle('on', b.dataset.d === d));
}

/* 结果面板 */
function showResult(root, title, sub){
  $('.panel h2', root).textContent = title;
  $('.panel p', root).textContent = sub;
  $('.overlay', root).classList.remove('hidden');
}
function hideResult(root){ $('.overlay', root).classList.add('hidden'); }

/* ---------- 启动 ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // 首页卡片
  const cards = $('#cards');
  GAMES.forEach(def => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<span class="glyph ' + (def.glyphClass || '') + '">' + def.glyph + '</span>' +
                     '<div><b>' + def.title + '</b><i>' + def.tagline + '</i></div>';
    card.addEventListener('click', () => openGame(def.id));
    cards.appendChild(card);
  });
});

function openGame(id){
  const def = GAMES.find(g => g.id === id);
  let sec = document.getElementById('screen-' + id);
  if(!sec) sec = buildGameScreen(def);
  showScreen(sec.id);
  currentGame = sec._game;
  window.__apps = window.__apps || {};
  window.__apps[id] = currentGame;          // 自动化测试钩子
  if(currentGame.resize) currentGame.resize();
  if(!sec._started){ sec._started = true; currentGame.newGame(); }
  else if(currentGame.redraw) currentGame.redraw();
}

window.addEventListener('resize', () => {
  if(currentGame && currentGame.resize) currentGame.resize();
});

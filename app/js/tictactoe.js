/* 井字棋：完备博弈搜索（困难难度不可战胜） */
'use strict';

registerGame({
  id: 'tictactoe', title: '井字棋', tagline: '十秒上手，老少皆宜',
  glyph: '○×', glyphClass: 'ttt',
  create(ui){
    const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const canvas = ui.canvas, ctx = canvas.getContext('2d');
    let cell = 90, pad = 26, W = 0, H = 0;
    let bd, history, over, thinking, token, difficulty, mode;
    let lastMove = -1;
    let anim = null;                   // 落子缩放动画 {i,t0}
    let winLine = null;                // 获胜三连的格子索引

    function kickAnim(){
      requestAnimationFrame(function step(){
        if(anim){
          draw();
          if(performance.now() - anim.t0 < 180) requestAnimationFrame(step);
          else { anim = null; draw(); }
        }
      });
    }

    bd = Array(9).fill(0); history = []; over = false; thinking = false; token = 0; difficulty = 'normal'; mode = 'ai';
    // 1 = 玩家 ×，2 = AI ○

    function winner(b){
      for(const L of LINES){
        if(b[L[0]] && b[L[0]] === b[L[1]] && b[L[1]] === b[L[2]]) return {p: b[L[0]], line: L};
      }
      return null;
    }
    const full = b => b.every(v => v !== 0);

    function minimax(b, turn, depth){    // 返回 AI(2) 视角分数
      const w = winner(b);
      if(w) return w.p === 2 ? 10 - depth : depth - 10;
      if(full(b)) return 0;
      const scores = [];
      for(let i=0; i<9; i++){
        if(b[i]) continue;
        b[i] = turn;
        scores.push(minimax(b, turn === 1 ? 2 : 1, depth+1));
        b[i] = 0;
      }
      return turn === 2 ? Math.max(...scores) : Math.min(...scores);
    }
    function bestMove(diff){
      const empty = [];
      for(let i=0; i<9; i++) if(!bd[i]) empty.push(i);
      if(!empty.length) return -1;
      if(diff === 'easy' && Math.random() < 0.6) return empty[(Math.random()*empty.length)|0];
      if(diff === 'normal' && Math.random() < 0.25) return empty[(Math.random()*empty.length)|0];
      let best = empty[0], bestV = -Infinity;
      for(const i of empty){
        bd[i] = 2;
        const v = minimax(bd, 1, 1);
        bd[i] = 0;
        if(v > bestV){ bestV = v; best = i; }
      }
      return best;
    }

    /* ---------- 绘制 ---------- */
    function x(c){ return pad + c*cell; }
    function y(r){ return pad + r*cell; }

    function resize(){
      const wrap = canvas.parentElement;
      const side = Math.max(180, Math.floor(Math.min(wrap.clientWidth - 20, wrap.clientHeight - 20)));
      cell = Math.floor((side - pad*2) / 3);
      if(cell > 110) cell = 110;
      W = H = cell*3 + pad*2;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W*dpr; canvas.height = H*dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw(){
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#e6b876'); grad.addColorStop(.5, '#d9a35f'); grad.addColorStop(1, '#c88d43');
      ctx.fillStyle = grad;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(0, 0, W, H, 12); else ctx.rect(0, 0, W, H);
      ctx.fill();

      ctx.strokeStyle = '#5a3717';
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      for(let i=1; i<3; i++){
        ctx.beginPath(); ctx.moveTo(x(0)+6, y(i)); ctx.lineTo(x(3)-6, y(i)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x(i), y(0)+6); ctx.lineTo(x(i), y(3)-6); ctx.stroke();
      }
      ctx.lineWidth = 1;

      const scaleOf = i => {
        if(anim && anim.i === i){
          const t = Math.min(1, (performance.now()-anim.t0)/180);
          return 0.55 + 0.45*(1 - Math.pow(1-t, 3));
        }
        return 1;
      };
      for(let i=0; i<9; i++){
        const r = (i/3)|0, c = i%3, px = x(c) + cell/2, py = y(r) + cell/2;
        const m = cell*0.28*scaleOf(i);
        if(bd[i] === 1){
          ctx.strokeStyle = '#b3342a'; ctx.lineWidth = Math.max(4, cell*0.09);
          ctx.beginPath();
          ctx.moveTo(px-m, py-m); ctx.lineTo(px+m, py+m);
          ctx.moveTo(px+m, py-m); ctx.lineTo(px-m, py+m);
          ctx.stroke();
        } else if(bd[i] === 2){
          ctx.strokeStyle = '#2c2620'; ctx.lineWidth = Math.max(4, cell*0.09);
          ctx.beginPath(); ctx.arc(px, py, m, 0, 7); ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
      if(lastMove >= 0 && !over){
        ctx.fillStyle = 'rgba(255,205,80,.9)';
        ctx.beginPath();
        ctx.arc(x(lastMove%3) + cell/2, y((lastMove/3)|0) + cell/2, 4, 0, 7);
        ctx.fill();
      }
      if(winLine){                                            // 胜利连线
        ctx.strokeStyle = 'rgba(255,205,80,.92)';
        ctx.lineWidth = Math.max(4, cell*0.1); ctx.lineCap = 'round';
        const a = winLine[0], b = winLine[2];
        const ax = x(a%3)+cell/2, ay = y((a/3)|0)+cell/2;
        const bx = x(b%3)+cell/2, by = y((b/3)|0)+cell/2;
        const dx = bx-ax, dy = by-ay, L = Math.hypot(dx, dy) || 1;
        ctx.beginPath();
        ctx.moveTo(ax - dx/L*cell*0.32, ay - dy/L*cell*0.32);
        ctx.lineTo(bx + dx/L*cell*0.32, by + dy/L*cell*0.32);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    function setStatus(msg, warn){
      ui.statusMsg.textContent = msg;
      ui.statusMsg.classList.toggle('warn', !!warn);
      ui.statusDot.classList.toggle('turn-ai', thinking || (!over && history.length % 2 === 1));
      ui.statusDot.classList.toggle('thinking', thinking);
    }
    function syncUndo(){ ui.undoBtn.disabled = thinking || history.length < (mode === 'ai' ? 2 : 1); }

    function newGame(){
      bd = Array(9).fill(0); history = []; lastMove = -1;
      over = false; thinking = false; token++;
      anim = null; winLine = null;
      hideResult(ui.root);
      setStatus(mode === 'ai' ? '你执 × 先行，点击格子落子' : '双人对弈 · × 方先行');
      syncUndo(); draw();
    }

    function endGame(kind, winnerMark){  // 'win' | 'lose' | 'draw'
      over = true; thinking = false;
      setStatus('对局结束');
      syncUndo();
      Sfx.play(kind === 'win' ? 'win' : kind === 'draw' ? 'ai' : 'lose');
      const myToken = token;
      setTimeout(() => {                       // 稍作停顿看清胜利连线再弹结算
        if(myToken !== token || !over) return;
        if(kind === 'win'){
          if(mode === 'ai') showResult(ui.root, '三连！你赢了', '× 连成一线');
          else showResult(ui.root, winnerMark === 1 ? '三连！× 方胜' : '三连！○ 方胜', '率先连成一线');
        }
        else if(kind === 'lose') showResult(ui.root, '你输了', '○ 抢先三连 · 困难模式下它从不失误');
        else showResult(ui.root, '平局', '棋逢对手，再战一局？');
      }, 700);
      draw();
    }

    function playerMove(i){
      const mark = history.length % 2 === 0 ? 1 : 2;     // × 先 ○ 后
      bd[i] = mark; history.push(i); lastMove = i;
      Sfx.play(mark === 1 ? 'place' : 'ai');
      draw();
      anim = {i, t0: performance.now()};
      kickAnim();
      const w = winner(bd);
      if(w){ winLine = w.line; endGame('win', w.p); return; }
      if(full(bd)){ endGame('draw'); return; }
      if(mode === 'ai' && mark === 1){ aiTurn(); return; }
      setStatus(mark === 1 ? '轮到 ○ 方落子' : '轮到 × 方落子');
      syncUndo();
    }

    function aiTurn(){
      thinking = true;
      setStatus('AI 思考中…'); syncUndo();
      const myToken = ++token;
      setTimeout(() => {
        if(myToken !== token) return;
        const i = bestMove(difficulty);
        if(myToken !== token || i < 0) return;
        bd[i] = 2; history.push(i); lastMove = i;
        thinking = false;
        Sfx.play('ai');
        draw();
        anim = {i, t0: performance.now()};
        kickAnim();
        const w = winner(bd);
        if(w){ winLine = w.line; endGame('lose'); return; }
        if(full(bd)){ endGame('draw'); return; }
        setStatus('轮到你落子'); syncUndo();
      }, 80);
    }

    function tap(r, c){
      const i = r*3 + c;
      if(over || thinking || bd[i]) return;
      if(mode === 'ai' && history.length % 2 === 1) return;   // 人机模式只执 ×
      playerMove(i);
    }

    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const c = Math.floor((cx - pad)/cell), r = Math.floor((cy - pad)/cell);
      if(r < 0 || r > 2 || c < 0 || c > 2) return;
      tap(r, c);
    });

    const controller = {
      newGame,
      state(){ return {over, bd: bd.slice(), history: history.length, lastMove}; },
      undo(){
        const pops = mode === 'ai' ? 2 : 1;
        if(thinking || history.length < pops) return;
        for(let i=0; i<pops; i++) bd[history.pop()] = 0;
        over = false; winLine = null;
        lastMove = history.length ? history[history.length-1] : -1;
        hideResult(ui.root);
        setStatus(mode === 'ai' ? '已悔棋，轮到你重新落子' : '已悔棋，继续对弈');
        syncUndo(); draw();
      },
      setDifficulty(d){ difficulty = d; },
      setMode(m){ mode = m; },
      resize, redraw: draw, tap,
      get thinking(){ return thinking; }
    };
    return controller;
  }
});

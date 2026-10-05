/* 五子棋：模式评分 + 双层搜索人机 AI（15 路自由规则） */
'use strict';

registerGame({
  id: 'gomoku', title: '五子棋', tagline: '黑白连五，一局三分钟',
  glyph: '', glyphClass: 'stones',
  create(ui){
    const N = 15;
    const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
    const canvas = ui.canvas, ctx = canvas.getContext('2d');
    let cell = 30, pad = 20, W = 0, H = 0;
    let bd, history, over, thinking, token, difficulty, mode;
    let lastMove = null;
    let anim = null;                   // 落子缩放动画 {r,c,t0}
    let winLine = null;                // 获胜五子的坐标数组

    function kickAnim(){
      requestAnimationFrame(function step(){
        if(anim){
          draw();
          if(performance.now() - anim.t0 < 180) requestAnimationFrame(step);
          else { anim = null; draw(); }
        }
      });
    }

    function newBoard(){ return Array.from({length:N}, () => Array(N).fill(0)); }
    bd = newBoard(); history = []; over = false; thinking = false; token = 0; difficulty = 'normal'; mode = 'ai';
    // 1 = 玩家黑子，2 = AI 白子

    function inB(r,c){ return r>=0 && r<N && c>=0 && c<N; }

    /* ---------- AI ---------- */
    function candidates(){
      const set = new Set(); let any = false;
      for(let r=0; r<N; r++) for(let c=0; c<N; c++){
        if(!bd[r][c]) continue;
        any = true;
        for(let dr=-2; dr<=2; dr++) for(let dc=-2; dc<=2; dc++){
          const rr=r+dr, cc=c+dc;
          if(inB(rr,cc) && !bd[rr][cc]) set.add(rr*N+cc);
        }
      }
      return any ? [...set] : [7*N+7];
    }

    function pattern(cnt, open2, open1){
      if(cnt >= 5) return 1000000;
      if(cnt === 4) return open2 ? 100000 : (open1 ? 12000 : 0);
      if(cnt === 3) return open2 ? 8000 : (open1 ? 900 : 0);
      if(cnt === 2) return open2 ? 350 : (open1 ? 80 : 0);
      return open2 ? 25 : 0;
    }
    function lineScore(r, c, color){   // 假设 (r,c) 落 color 后四方向的分值和
      let total = 0;
      for(const [dr,dc] of DIRS){
        let cnt = 1, openA = false, openB = false;
        let rr=r+dr, cc=c+dc;
        while(inB(rr,cc) && bd[rr][cc] === color){ cnt++; rr+=dr; cc+=dc; }
        if(inB(rr,cc) && bd[rr][cc] === 0) openA = true;
        rr=r-dr; cc=c-dc;
        while(inB(rr,cc) && bd[rr][cc] === color){ cnt++; rr-=dr; cc-=dc; }
        if(inB(rr,cc) && bd[rr][cc] === 0) openB = true;
        total += pattern(cnt, openA && openB, openA || openB);
      }
      return total;
    }

    function aiPick(diff){
      const cands = candidates();
      const scored = cands.map(k => {
        const r = (k/N)|0, c = k%N;
        return {k, a: lineScore(r,c,2), d: lineScore(r,c,1)};
      });
      const win = scored.find(e => e.a >= 1000000);
      if(win) return win.k;                              // 直接连五
      const block = scored.find(e => e.d >= 1000000);
      if(block) return block.k;                          // 挡对方连五

      if(diff === 'easy'){
        scored.forEach(e => { e.s = e.a + 0.7*e.d + Math.random()*600; });
        scored.sort((x,y) => y.s - x.s);
        const top = scored.slice(0, Math.min(8, scored.length));
        return top[(Math.random()*top.length)|0].k;
      }
      scored.forEach(e => { e.s = e.a + 0.85*e.d; });
      scored.sort((x,y) => y.s - x.s);
      if(diff === 'normal') return scored[0].k;

      // hard：再往后看一手（对方最强回应）
      const top = scored.slice(0, 12);
      let best = top[0].k, bestV = -Infinity;
      for(const e of top){
        const r = (e.k/N)|0, c = e.k%N;
        bd[r][c] = 2;
        let oppBest = 0;
        for(const k2 of candidates()){
          const r2 = (k2/N)|0, c2 = k2%N;
          const v = lineScore(r2,c2,1) + 0.85*lineScore(r2,c2,2);
          if(v > oppBest) oppBest = v;
          if(oppBest >= 1000000) break;
        }
        bd[r][c] = 0;
        const v = e.s - 0.9*oppBest;
        if(v > bestV){ bestV = v; best = e.k; }
      }
      return best;
    }

    function winAt(r, c){
      const p = bd[r][c]; if(!p) return null;
      for(const [dr,dc] of DIRS){
        const cells = [[r, c]];
        for(let k=1; k<5; k++){ const rr=r+dr*k, cc=c+dc*k; if(!inB(rr,cc) || bd[rr][cc] !== p) break; cells.push([rr,cc]); }
        for(let k=1; k<5; k++){ const rr=r-dr*k, cc=c-dc*k; if(!inB(rr,cc) || bd[rr][cc] !== p) break; cells.unshift([rr,cc]); }
        if(cells.length >= 5) return cells;
      }
      return null;
    }

    /* ---------- 绘制 ---------- */
    function x(c){ return pad + c*cell; }
    function y(r){ return pad + r*cell; }

    function resize(){
      const wrap = canvas.parentElement;
      const availW = wrap.clientWidth - 10, availH = wrap.clientHeight - 10;
      cell = Math.max(18, Math.floor(Math.min((availW-12)/14, (availH-12)/14)));
      if(cell > 44) cell = 44;
      pad = Math.round(cell*0.62);
      W = cell*14 + pad*2; H = W;
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
      if(ctx.roundRect) ctx.roundRect(0, 0, W, H, 10); else ctx.rect(0, 0, W, H);
      ctx.fill();

      ctx.strokeStyle = '#5a3717'; ctx.lineWidth = 1;
      for(let i=0; i<N; i++){
        ctx.beginPath(); ctx.moveTo(x(0), y(i)); ctx.lineTo(x(14), y(i)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x(i), y(0)); ctx.lineTo(x(i), y(14)); ctx.stroke();
      }
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x(0)-4, y(0)-4, cell*14+8, cell*14+8);
      ctx.lineWidth = 1;
      ctx.fillStyle = '#5a3717';
      for(const [sr,sc] of [[3,3],[3,11],[11,3],[11,11],[7,7]]){
        ctx.beginPath(); ctx.arc(x(sc), y(sr), cell*0.11, 0, 7); ctx.fill();
      }

      for(let r=0; r<N; r++) for(let c=0; c<N; c++){
        const p = bd[r][c]; if(!p) continue;
        const px = x(c), py = y(r), R = cell*0.46;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
        const g2 = ctx.createRadialGradient(px-R*0.35, py-R*0.4, R*0.1, px, py, R);
        if(p === 1){ g2.addColorStop(0, '#5f5f5f'); g2.addColorStop(1, '#0c0c0c'); }
        else { g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#cfc9bd'); }
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.fill();
        if(p === 2){ ctx.strokeStyle = 'rgba(120,110,95,.7)'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.restore();
        if(lastMove && lastMove[0] === r && lastMove[1] === c){
          ctx.fillStyle = '#e53935';
          ctx.beginPath(); ctx.arc(px, py, R*0.28, 0, 7); ctx.fill();
        }
      }
      if(winLine && winLine.length >= 5){                     // 胜利连线
        ctx.strokeStyle = 'rgba(255,205,80,.92)';
        ctx.lineWidth = Math.max(3, cell*0.14); ctx.lineCap = 'round';
        const a = winLine[0], b = winLine[winLine.length-1];
        ctx.beginPath();
        ctx.moveTo(x(a[1]), y(a[0]));
        ctx.lineTo(x(b[1]), y(b[0]));
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    function setStatus(msg, warn){
      ui.statusMsg.textContent = msg;
      ui.statusMsg.classList.toggle('warn', !!warn);
      ui.statusDot.classList.toggle('turn-ai', thinking || (!over && bd && isAiTurn()));
      ui.statusDot.classList.toggle('thinking', thinking);
    }
    function isAiTurn(){
      const moves = history.length;
      return moves % 2 === 1;      // 黑先：奇数手后轮白
    }
    function syncUndo(){ ui.undoBtn.disabled = thinking || history.length < (mode === 'ai' ? 2 : 1); }

    function place(r, c, who){
      bd[r][c] = who;
      history.push({r, c, side: who === 1 ? 'p' : 'a'});
      lastMove = [r, c];
    }

    function newGame(){
      bd = newBoard(); history = []; lastMove = null;
      over = false; thinking = false; token++;
      anim = null; winLine = null;
      hideResult(ui.root);
      setStatus(mode === 'ai' ? '你执黑先行，点击交叉点落子' : '双人对弈 · 黑方先行');
      syncUndo(); draw();
    }

    function endGame(blackWon, draw_){
      over = true; thinking = false;
      setStatus('对局结束');
      syncUndo();
      Sfx.play(blackWon && !draw_ ? 'win' : 'lose');
      const myToken = token;
      setTimeout(() => {                       // 稍作停顿看清胜利连线再弹结算
        if(myToken !== token || !over) return;
        if(draw_) showResult(ui.root, '和棋', '棋盘下满了，棋逢对手');
        else if(mode === 'ai'){
          if(blackWon) showResult(ui.root, '五连！你赢了', '黑棋率先连成五子');
          else showResult(ui.root, '你输了', '白棋五连 · 下次抢先堵住它的活三');
        } else {
          if(blackWon) showResult(ui.root, '五连！黑方胜', '黑棋率先连成五子');
          else showResult(ui.root, '五连！白方胜', '白棋率先连成五子');
        }
      }, 700);
      draw();
    }

    function playerMove(r, c){
      const who = history.length % 2 === 0 ? 1 : 2;      // 黑先白后
      place(r, c, who);
      Sfx.play(who === 1 ? 'place' : 'ai');
      draw();
      anim = {r, c, t0: performance.now()};
      kickAnim();
      const line = winAt(r, c);
      if(line){ winLine = line; endGame(who === 1); return; }
      if(history.length === N*N){ endGame(false, true); return; }
      if(mode === 'ai' && who === 1){ aiTurn(); return; }
      setStatus(who === 1 ? '轮到白方落子' : '轮到黑方落子');
      syncUndo();
    }

    function aiTurn(){
      thinking = true;
      setStatus('AI 思考中…'); syncUndo();
      const myToken = ++token;
      setTimeout(() => {
        if(myToken !== token) return;
        const k = aiPick(difficulty);
        if(myToken !== token) return;
        if(k == null){ thinking = false; setStatus('轮到你落子'); syncUndo(); return; }   // 兜底
        const r = (k/N)|0, c = k%N;
        place(r, c, 2);
        thinking = false;
        Sfx.play('ai');
        draw();
        anim = {r, c, t0: performance.now()};
        kickAnim();
        const line = winAt(r, c);
        if(line){ winLine = line; endGame(false); return; }
        if(history.length === N*N){ endGame(false, true); return; }
        setStatus('轮到你落子'); syncUndo();
      }, 80);
    }

    function tap(r, c){
      if(over || thinking || bd[r][c]) return;
      if(mode === 'ai' && history.length % 2 === 1) return;   // 人机模式只执黑
      playerMove(r, c);
    }

    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const c = Math.round((cx - pad)/cell), r = Math.round((cy - pad)/cell);
      if(!inB(r, c)) return;
      const dx = cx - x(c), dy = cy - y(r);
      if(dx*dx + dy*dy > (cell*0.48)*(cell*0.48)) return;
      tap(r, c);
    });

    const controller = {
      newGame,
      state(){ return {over, history: history.length, lastMove}; },
      undo(){
        const pops = mode === 'ai' ? 2 : 1;
        if(thinking || history.length < pops) return;
        for(let i=0; i<pops; i++){ const h = history.pop(); bd[h.r][h.c] = 0; }
        over = false; winLine = null;
        lastMove = history.length ? [history[history.length-1].r, history[history.length-1].c] : null;
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

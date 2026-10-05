/* 中国象棋：完整规则引擎 + α-β 剪枝人机 AI（纯本地计算） */
'use strict';

registerGame({
  id: 'xiangqi', title: '中国象棋', tagline: '楚河汉界，车马炮对弈',
  glyph: '帥', glyphClass: 'red',
  create(ui){
    /* ================= 引擎 ================= */
    const ORTH = [[1,0],[-1,0],[0,1],[0,-1]];
    const DIAG = [[2,2],[2,-2],[-2,2],[-2,-2]];
    const KNIGHT = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
    const VAL = {K:100000, R:900, C:450, N:400, B:120, A:120, P:100};
    const CHAR = {
      r:{K:'帥',A:'仕',B:'相',N:'馬',R:'車',C:'炮',P:'兵'},
      b:{K:'將',A:'士',B:'象',N:'馬',R:'車',C:'炮',P:'卒'}
    };

    const inBoard = (r,c) => r>=0 && r<10 && c>=0 && c<9;
    const inPalace = (r,c,color) => c>=3 && c<=5 && (color==='r' ? (r>=7 && r<=9) : (r>=0 && r<=2));
    const crossed = (color,r) => color==='r' ? r<=4 : r>=5;

    function initialBoard(){
      const bd = Array.from({length:10}, () => Array(9).fill(null));
      const back = ['R','N','B','A','K','A','B','N','R'];
      back.forEach((t,c) => { bd[0][c] = {t, c:'b'}; bd[9][c] = {t, c:'r'}; });
      bd[2][1] = {t:'C',c:'b'}; bd[2][7] = {t:'C',c:'b'};
      bd[7][1] = {t:'C',c:'r'}; bd[7][7] = {t:'C',c:'r'};
      for(let c=0; c<9; c+=2){ bd[3][c] = {t:'P',c:'b'}; bd[6][c] = {t:'P',c:'r'}; }
      return bd;
    }

    function genMoves(bd, color){
      const ms = [];
      const push = (fr,fc,tr,tc) => { const t = bd[tr][tc]; if(!t || t.c !== color) ms.push([fr,fc,tr,tc]); };
      for(let r=0; r<10; r++) for(let c=0; c<9; c++){
        const p = bd[r][c]; if(!p || p.c !== color) continue;
        switch(p.t){
          case 'K':
            for(const [dr,dc] of ORTH){ const nr=r+dr, nc=c+dc; if(inPalace(nr,nc,color)) push(r,c,nr,nc); }
            break;
          case 'A':
            for(const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const nr=r+dr, nc=c+dc; if(inPalace(nr,nc,color)) push(r,c,nr,nc); }
            break;
          case 'B':
            for(const [dr,dc] of DIAG){
              const nr=r+dr, nc=c+dc;
              if(!inBoard(nr,nc)) continue;
              const mr=r+dr/2, mc=c+dc/2;
              if(crossed(color,nr) || bd[mr][mc]) continue;   // 不过河、不塞象眼
              push(r,c,nr,nc);
            }
            break;
          case 'N':
            for(const [dr,dc] of KNIGHT){
              const nr=r+dr, nc=c+dc;
              if(!inBoard(nr,nc)) continue;
              const lr=r+(Math.abs(dr)===2 ? dr/2 : 0), lc=c+(Math.abs(dc)===2 ? dc/2 : 0);
              if(bd[lr][lc]) continue;                        // 不蹩马腿
              push(r,c,nr,nc);
            }
            break;
          case 'R':
            for(const [dr,dc] of ORTH){
              let nr=r+dr, nc=c+dc;
              while(inBoard(nr,nc)){
                if(!bd[nr][nc]){ push(r,c,nr,nc); }
                else { if(bd[nr][nc].c !== color) push(r,c,nr,nc); break; }
                nr+=dr; nc+=dc;
              }
            }
            break;
          case 'C':
            for(const [dr,dc] of ORTH){
              let nr=r+dr, nc=c+dc, screen=false;
              while(inBoard(nr,nc)){
                const q = bd[nr][nc];
                if(!screen){ if(!q) push(r,c,nr,nc); else screen = true; }
                else if(q){ if(q.c !== color) push(r,c,nr,nc); break; }
                nr+=dr; nc+=dc;
              }
            }
            break;
          case 'P': {
            const f = color==='r' ? -1 : 1;
            if(inBoard(r+f, c)) push(r, c, r+f, c);
            if(crossed(color, r)){
              if(c-1 >= 0) push(r, c, r, c-1);
              if(c+1 <= 8) push(r, c, r, c+1);
            }
            break;
          }
        }
      }
      return ms;
    }

    /* color 方的将是否被攻击（含白脸将） */
    function isAttacked(bd, kings, color){
      const K = kings[color], enemy = color==='r' ? 'b' : 'r';
      for(const [dr,dc] of ORTH){
        let nr=K.r+dr, nc=K.c+dc, first=false;
        while(inBoard(nr,nc)){
          const q = bd[nr][nc];
          if(q){
            if(!first){
              if(q.c === enemy && (q.t === 'R' || (q.t === 'K' && dc === 0))) return true;
              first = true;
            } else {
              if(q.c === enemy && q.t === 'C') return true;
              break;
            }
          }
          nr+=dr; nc+=dc;
        }
      }
      const f = enemy==='r' ? -1 : 1;
      if(inBoard(K.r-f, K.c) && bd[K.r-f][K.c] && bd[K.r-f][K.c].c === enemy && bd[K.r-f][K.c].t === 'P') return true;
      const sideCrossed = crossed(enemy, K.r);
      if(sideCrossed){
        for(const dc of [-1,1]){
          const nc = K.c+dc;
          if(nc>=0 && nc<9 && bd[K.r][nc] && bd[K.r][nc].c === enemy && bd[K.r][nc].t === 'P') return true;
        }
      }
      for(const [dr,dc] of KNIGHT){
        const hr=K.r+dr, hc=K.c+dc;
        if(!inBoard(hr,hc)) continue;
        const q = bd[hr][hc];
        if(q && q.c === enemy && q.t === 'N'){
          const lr = Math.abs(dr)===2 ? K.r+dr/2 : K.r;
          const lc = Math.abs(dc)===2 ? K.c+dc/2 : K.c;
          if(!bd[lr][lc]) return true;
        }
      }
      return false;
    }

    function doMove(bd, kings, m){
      const [fr,fc,tr,tc] = m, p = bd[fr][fc], cap = bd[tr][tc];
      bd[tr][tc] = p; bd[fr][fc] = null;
      if(p.t === 'K') kings[p.c] = {r:tr, c:tc};
      return cap;
    }
    function undoMove(bd, kings, m, cap){
      const [fr,fc,tr,tc] = m, p = bd[tr][tc];
      bd[fr][fc] = p; bd[tr][tc] = cap;
      if(p.t === 'K') kings[p.c] = {r:fr, c:fc};
    }

    function legalMoves(bd, kings, color){
      const out = [];
      for(const m of genMoves(bd, color)){
        const cap = doMove(bd, kings, m);
        if(!isAttacked(bd, kings, color)) out.push(m);
        undoMove(bd, kings, m, cap);
      }
      return out;
    }

    /* ---------- 局面评估（红方视角） ---------- */
    function evaluate(bd){
      let s = 0;
      for(let r=0; r<10; r++) for(let c=0; c<9; c++){
        const p = bd[r][c]; if(!p) continue;
        let v = VAL[p.t];
        switch(p.t){
          case 'P':
            if(p.c === 'r'){ if(r <= 4) v += 70 + (4-r)*15; }
            else if(r >= 5) v += 70 + (r-5)*15;
            break;
          case 'N': v += (4-Math.abs(c-4))*5 + (p.c==='r' ? (r<=4?8:0) : (r>=5?8:0)); break;
          case 'C': v += (4-Math.abs(c-4))*3; break;
          case 'R': v += (4-Math.abs(c-4))*4 + (p.c==='r' ? (r<=4?12:0) : (r>=5?12:0)); break;
        }
        s += p.c === 'r' ? v : -v;
      }
      return s;
    }
    const opp = color => color === 'r' ? 'b' : 'r';

    /* ---------- α-β 搜索（时间上限保护） ---------- */
    let bd, kings;                       // 搜索期间使用的引用（由外层赋值）
    let nodes = 0, deadline = 0, aborted = false;

    function orderMoves(board, ms){
      ms.sort((m1, m2) => {
        const v1 = board[m1[2]][m1[3]], v2 = board[m2[2]][m2[3]];
        const s1 = v1 ? VAL[v1.t]*10 - VAL[board[m1[0]][m1[1]].t] : 0;
        const s2 = v2 ? VAL[v2.t]*10 - VAL[board[m2[0]][m2[1]].t] : 0;
        return s2 - s1;
      });
    }
    function quiesce(alpha, beta, color, qd){
      if(((++nodes) & 1023) === 0 && Date.now() > deadline) aborted = true;
      if(aborted) return 0;
      const stand = color === 'r' ? evaluate(bd) : -evaluate(bd);
      if(stand >= beta || qd <= 0) return stand;
      if(stand > alpha) alpha = stand;
      const ms = genMoves(bd, color).filter(m => bd[m[2]][m[3]]);
      orderMoves(bd, ms);
      for(const m of ms){
        const cap = doMove(bd, kings, m);
        if(isAttacked(bd, kings, color)){ undoMove(bd, kings, m, cap); continue; }
        const v = -quiesce(-beta, -alpha, opp(color), qd-1);
        undoMove(bd, kings, m, cap);
        if(aborted) return 0;
        if(v > alpha){ alpha = v; if(alpha >= beta) return v; }
      }
      return alpha;
    }
    function negamax(depth, alpha, beta, color, ply){
      if(((++nodes) & 1023) === 0 && Date.now() > deadline) aborted = true;
      if(aborted) return 0;
      if(depth <= 0) return quiesce(alpha, beta, color, 4);
      const ms = legalMoves(bd, kings, color);
      if(ms.length === 0) return -100000 + ply;          // 被绝杀/困毙
      orderMoves(bd, ms);
      let best = -Infinity;
      for(const m of ms){
        const cap = doMove(bd, kings, m);
        const v = -negamax(depth-1, -beta, -alpha, opp(color), ply+1);
        undoMove(bd, kings, m, cap);
        if(aborted) return 0;
        if(v > best){ best = v; if(v > alpha){ alpha = v; if(alpha >= beta) break; } }
      }
      return best;
    }

    function searchRoot(rootBd, rootKings, color, diff){
      bd = rootBd; kings = rootKings;
      const ms = legalMoves(bd, kings, color);
      if(!ms.length) return null;
      const maxDepth = diff === 'easy' ? 2 : diff === 'normal' ? 3 : 5;
      deadline = Date.now() + (diff === 'easy' ? 250 : diff === 'normal' ? 900 : 1700);
      nodes = 0; aborted = false;
      let scored = ms.map(m => ({m, score: -Infinity}));
      let bestList = scored.slice();
      for(let d=1; d<=maxDepth; d++){
        let alpha = -Infinity, ok = true;
        for(const e of scored){
          const a = diff === 'hard' ? alpha : -Infinity;   // easy/normal 全窗口：分数可比、可随机
          const cap = doMove(bd, kings, e.m);
          e.score = -negamax(d-1, -Infinity, -a, opp(color), 1);
          undoMove(bd, kings, e.m, cap);
          if(aborted){ ok = false; break; }
          if(e.score > alpha) alpha = e.score;
        }
        if(ok){
          scored.sort((x,y) => y.score - x.score);
          bestList = scored.map(e => ({m: e.m, score: e.score}));
          if(bestList[0].score > 90000) break;             // 已见绝杀
        } else break;
        if(Date.now() > deadline) break;
      }
      if(diff === 'hard') return bestList[0].m;          // 困难档：严格最强
      if(diff === 'normal'){
        // 普通档全窗口搜索，分数精确：前 15 分内随机，避免每局雷同
        if(bestList[0].score >= 90000) return bestList[0].m;
        const top = bestList.filter(e => e.score >= bestList[0].score - 15);
        return top[Math.floor(Math.random()*top.length)].m;
      }
      const top = bestList.filter(e => e.score >= bestList[0].score - 120);   // easy
      return top[Math.floor(Math.random()*top.length)].m;
    }

    /* ================= 界面与对局流程 ================= */
    const canvas = ui.canvas, ctx = canvas.getContext('2d');
    let cell = 34, pad = 24, W = 0, H = 0;
    let sel = null, selMoves = [], lastMove = null;
    let history = [], over = false, thinking = false, token = 0;
    let difficulty = 'normal';
    let mode = 'ai';                   // 'ai' 人机 | 'pvp' 双人同屏
    let anim = null;                   // 落子缩放动画 {r,c,t0}

    function kickAnim(){
      requestAnimationFrame(function step(){
        if(anim){
          draw();
          if(performance.now() - anim.t0 < 180) requestAnimationFrame(step);
          else { anim = null; draw(); }
        }
      });
    }

    function x(c){ return pad + c*cell; }
    function y(r){ return pad + r*cell; }

    function resize(){
      const wrap = canvas.parentElement;
      const availW = wrap.clientWidth - 10, availH = wrap.clientHeight - 10;
      cell = Math.max(26, Math.floor(Math.min((availW-14)/8, (availH-14)/9)));
      if(cell > 64) cell = 64;
      pad = Math.round(cell*0.72);
      W = cell*8 + pad*2; H = cell*9 + pad*2;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W*dpr; canvas.height = H*dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function line(x1,y1,x2,y2){
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    function mark(r,c){ // 炮/兵位角标
      const g = cell*0.09, L = cell*0.2;
      for(const qx of [-1,1]) for(const qy of [-1,1]){
        const cx = x(c)+qx*g, cy = y(r)+qy*g;
        if(cx < x(0)-1 || cx > x(8)+1) continue;
        line(cx, cy, cx - qx*L, cy);
        line(cx, cy, cx, cy - qy*L);
      }
    }

    function draw(){
      // 木纹底
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#e6b876'); grad.addColorStop(.5, '#d9a35f'); grad.addColorStop(1, '#c88d43');
      ctx.fillStyle = grad;
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(0, 0, W, H, 10); else ctx.rect(0, 0, W, H);
      ctx.fill();

      ctx.strokeStyle = '#5a3717'; ctx.lineWidth = 1;
      for(let r=0; r<10; r++) line(x(0), y(r), x(8), y(r));
      for(let c=0; c<9; c++){
        if(c === 0 || c === 8) line(x(c), y(0), x(c), y(9));
        else { line(x(c), y(0), x(c), y(4)); line(x(c), y(5), x(c), y(9)); }
      }
      line(x(3), y(0), x(5), y(2)); line(x(5), y(0), x(3), y(2));
      line(x(3), y(7), x(5), y(9)); line(x(5), y(7), x(3), y(9));
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x(0)-5, y(0)-5, cell*8+10, cell*9+10);
      ctx.lineWidth = 1;

      [[2,1],[2,7],[7,1],[7,7],
       [3,0],[3,2],[3,4],[3,6],[3,8],
       [6,0],[6,2],[6,4],[6,6],[6,8]].forEach(pt => mark(pt[0], pt[1]));

      ctx.fillStyle = 'rgba(90,55,23,.78)';
      ctx.font = Math.round(cell*0.6) + 'px "KaiTi","STKaiti",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('楚　河', x(2), y(4.5));
      ctx.fillText('漢　界', x(6), y(4.5));

      // 选中提示
      if(sel){
        ctx.fillStyle = 'rgba(180,50,30,.28)';
        ctx.beginPath(); ctx.arc(x(sel[1]), y(sel[0]), cell*0.46, 0, 7); ctx.fill();
      }
      // 上一步
      if(lastMove){
        ctx.strokeStyle = 'rgba(255,205,80,.95)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x(lastMove[1]), y(lastMove[0]), cell*0.18, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(x(lastMove[3]), y(lastMove[2]), cell*0.46 + 2.5, 0, 7); ctx.stroke();
        ctx.lineWidth = 1;
      }
      // 可落点
      for(const m of selMoves){
        const tr = m[2], tc = m[3];
        if(bd[tr][tc]){
          ctx.strokeStyle = 'rgba(180,50,30,.9)'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.arc(x(tc), y(tr), cell*0.46, 0, 7); ctx.stroke();
          ctx.lineWidth = 1;
        } else {
          ctx.fillStyle = 'rgba(150,45,25,.85)';
          ctx.beginPath(); ctx.arc(x(tc), y(tr), cell*0.13, 0, 7); ctx.fill();
        }
      }
      // 被将军的王
      if(!over && isAttacked(bd, kings, turnColor())){
        const K = kings[turnColor()];
        ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3;
        ctx.shadowColor = '#e53935'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(x(K.c), y(K.r), cell*0.5, 0, 7); ctx.stroke();
        ctx.shadowBlur = 0; ctx.lineWidth = 1;
      }
      // 棋子
      for(let r=0; r<10; r++) for(let c=0; c<9; c++){
        const p = bd[r][c]; if(!p) continue;
        const px = x(c), py = y(r);
        let R = cell*0.44;
        if(anim && anim.r === r && anim.c === c){
          const t = Math.min(1, (performance.now()-anim.t0)/180);
          R *= 0.55 + 0.45*(1 - Math.pow(1-t, 3));
        }
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
        const g2 = ctx.createRadialGradient(px-R*0.35, py-R*0.4, R*0.15, px, py, R);
        g2.addColorStop(0, '#f7ead0'); g2.addColorStop(1, '#d5b98a');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(px, py, R, 0, 7); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = p.c === 'r' ? '#c23a2b' : '#43382c';
        ctx.lineWidth = R*0.1;
        ctx.beginPath(); ctx.arc(px, py, R*0.86, 0, 7); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = p.c === 'r' ? '#b3342a' : '#2c2620';
        ctx.font = 'bold ' + Math.round(R*1.05) + 'px "KaiTi","STKaiti","Noto Serif SC",serif';
        if(mode === 'pvp' && p.c === 'b'){      // 双人模式：黑方棋子字面反向，朝对家玩家
          ctx.save();
          ctx.translate(px, py + R*0.06);
          ctx.rotate(Math.PI);
          ctx.fillText(CHAR[p.c][p.t], 0, 0);
          ctx.restore();
        } else {
          ctx.fillText(CHAR[p.c][p.t], px, py + R*0.06);
        }
      }
    }

    function setStatus(msg, warn){
      ui.statusMsg.textContent = msg;
      ui.statusMsg.classList.toggle('warn', !!warn);
      ui.statusDot.classList.toggle('turn-ai', thinking || (!over && state.side === 'b'));
      ui.statusDot.classList.toggle('thinking', thinking);
    }
    function syncUndo(){
      ui.undoBtn.disabled = thinking || history.length < (mode === 'ai' ? 2 : 1);
    }

    /* ---------- 对局状态 ---------- */
    const state = { side: 'r' };       // 轮到谁走
    bd = initialBoard();
    kings = { r:{r:9,c:4}, b:{r:0,c:4} };

    function turnColor(){ return state.side; }

    function newGame(){
      bd = initialBoard();
      kings = { r:{r:9,c:4}, b:{r:0,c:4} };
      history = []; sel = null; selMoves = []; lastMove = null;
      over = false; thinking = false; token++; state.side = 'r'; anim = null;
      hideResult(ui.root);
      setStatus(mode === 'ai' ? '你执红先行，点击棋子开始对弈' : '双人对弈 · 红方先行，黑方棋子已反向');
      syncUndo(); draw();
    }

    function endGame(playerWin){
      over = true; thinking = false;
      setStatus('对局结束');
      syncUndo();
      Sfx.play(playerWin ? 'win' : 'lose');
      const myToken = token;
      setTimeout(() => {                       // 稍作停顿看清终局再弹结算
        if(myToken !== token || !over) return;
        if(playerWin) showResult(ui.root, '绝杀！红方胜', mode === 'ai' ? 'AI 无路可走' : '黑方无路可走');
        else showResult(ui.root, '绝杀！黑方胜', mode === 'ai' ? '想想哪里走亏了？' : '红方无路可走');
      }, 700);
      draw();
    }

    function afterMove(){
      lastMove = history.length ? history[history.length-1].mv : null;
      draw();
    }

    function playerMove(m){
      const mover = state.side;
      const cap = doMove(bd, kings, m);
      history.push({mv: m, side: mover, cap});
      state.side = mover === 'r' ? 'b' : 'r';
      Sfx.play('place');
      sel = null; selMoves = [];
      afterMove();
      anim = {r: m[2], c: m[3], t0: performance.now()};
      kickAnim();
      if(legalMoves(bd, kings, state.side).length === 0){ endGame(mover === 'r'); return; }
      if(mode === 'ai'){ aiTurn(); return; }
      const chk = isAttacked(bd, kings, state.side);
      setStatus((state.side === 'r' ? '轮到红方行棋' : '轮到黑方行棋') + (chk ? ' · 将军！' : ''), chk);
      syncUndo();
    }

    function aiTurn(){
      thinking = true;
      setStatus('AI 思考中…'); syncUndo();
      const myToken = ++token;
      setTimeout(() => {
        if(myToken !== token) return;
        const t0 = Date.now();
        const m = searchRoot(bd, kings, 'b', difficulty);
        if(myToken !== token) return;
        if(!m){ thinking = false; endGame(true); return; }   // 兜底：AI 无棋可走即被绝杀
        const apply = () => {
          if(myToken !== token) return;
          const cap = doMove(bd, kings, m);
          history.push({mv: m, side: 'a', cap});
          state.side = 'r';
          thinking = false;
          Sfx.play('ai');
          sel = null; selMoves = [];
          afterMove();
          anim = {r: m[2], c: m[3], t0: performance.now()};
          kickAnim();
          if(legalMoves(bd, kings, 'r').length === 0){ endGame(false); return; }
          setStatus(isAttacked(bd, kings, 'r') ? '将军！快保护你的帅' : '轮到你落子', isAttacked(bd, kings, 'r'));
          syncUndo();
        };
        const wait = Math.max(0, 380 - (Date.now() - t0));   // 最短思考停顿，更有对弈感
        if(wait > 0) setTimeout(apply, wait); else apply();
      }, 90);
    }

    function tap(r, c){
      if(over || thinking) return;
      const p = bd[r][c];
      if(sel){
        const m = selMoves.find(v => v[2] === r && v[3] === c);
        if(m){ playerMove(m); return; }
      }
      if(p && p.c === state.side){
        if(sel && sel[0] === r && sel[1] === c){ sel = null; selMoves = []; draw(); return; }
        sel = [r, c];
        selMoves = legalMoves(bd, kings, state.side).filter(v => v[0] === r && v[1] === c);
        Sfx.play('place');
        draw();
      } else if(sel){
        sel = null; selMoves = []; draw();
      }
    }

    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const c = Math.round((cx - pad)/cell), r = Math.round((cy - pad)/cell);
      if(!inBoard(r, c)) return;
      const dx = cx - x(c), dy = cy - y(r);
      if(dx*dx + dy*dy > (cell*0.52)*(cell*0.52)) return;
      tap(r, c);
    });

    const controller = {
      newGame,
      state(){ return {over, side: state.side, history: history.length, thinking, lastMove}; },
      legal(color){ return legalMoves(bd, kings, color); },
      engineMove(color, diff){ return searchRoot(bd, kings, color, diff || difficulty); },
      applyMove(m){
        const cap = doMove(bd, kings, m);
        history.push({mv: m, side: state.side === 'r' ? 'p' : 'a', cap});
        state.side = state.side === 'r' ? 'b' : 'r';
        lastMove = m;
        draw();
      },
      undo(){
        const pops = mode === 'ai' ? 2 : 1;
        if(thinking || history.length < pops) return;
        for(let i=0; i<pops; i++){
          const h = history.pop();
          undoMove(bd, kings, h.mv, h.cap);
          state.side = state.side === 'r' ? 'b' : 'r';
        }
        over = false; sel = null; selMoves = [];
        lastMove = history.length ? history[history.length-1].mv : null;
        hideResult(ui.root);
        setStatus(mode === 'ai' ? '已悔棋，轮到你重新考虑'
          : '已悔棋，轮到' + (state.side === 'r' ? '红方' : '黑方') + '行棋');
        syncUndo(); draw();
      },
      setDifficulty(d){ difficulty = d; },
      setMode(m){ mode = m; },
      debugSet(list){                    // 测试钩子：直接摆局面 [[color,type,row,col],...]
        bd = Array.from({length:10}, () => Array(9).fill(null));
        for(const [pc, t, r, c] of list) bd[r][c] = {t, c: pc};
        kings = {r:{r:9,c:4}, b:{r:0,c:4}};
        for(let r=0; r<10; r++) for(let c=0; c<9; c++){
          const p = bd[r][c];
          if(p && p.t === 'K') kings[p.c] = {r, c};
        }
        history = []; sel = null; selMoves = []; lastMove = null;
        over = false; thinking = false; anim = null;
        state.side = 'r';
        draw();
      },
      resize, redraw: draw, tap,
      get thinking(){ return thinking; }
    };
    return controller;
  }
});

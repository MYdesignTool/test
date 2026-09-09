/* 自考冲刺刷题台 —— 纯前端，数据全部留在本机浏览器 */
(function () {
  'use strict';

  var BANK = window.QB.questions;
  var LSKEY = 'zk60_progress_v1';
  var EXAM_MIN = 150;

  /* ---------------- 进度 ---------------- */
  var P = {};
  try { P = JSON.parse(localStorage.getItem(LSKEY) || '{}'); } catch (e) { P = {}; }
  function save() { try { localStorage.setItem(LSKEY, JSON.stringify(P)); } catch (e) {} }
  function rec(id) {
    if (!P[id]) P[id] = { n: 0, w: 0, lw: 0, star: 0, ok: 0 };
    return P[id];
  }

  /* ---------------- 状态 ---------------- */
  var S = {
    subject: '14237', mode: 'practice',
    types: [], eras: ['new', 'mid'], chapters: [], status: 'all', kw: '',
    queue: [], idx: 0, answered: false, shuffled: false
  };

  var TYPE_ORDER = ['单选题', '多选题', '判断题', '填空题', '名词解释', '简答题', '论述题', '材料分析题', '综合应用题'];
  var OBJ = { '单选题': 1, '多选题': 1, '判断题': 1, '填空题': 1 };
  var ERA_LABEL = { new: '新大纲核心', mid: '通用/参考', legacy: '旧大纲（仅参考）' };
  var EXAM_TPL = {
    '14237': [['单选题', 25, 1], ['名词解释', 5, 4], ['简答题', 5, 5], ['论述题', 1, 9], ['材料分析题', 1, 9], ['综合应用题', 1, 12]],
    '08257': [['单选题', 20, 1], ['多选题', 5, 2], ['判断题', 10, 1], ['名词解释', 4, 3], ['简答题', 4, 6], ['论述题', 2, 12]]
  };

  var IDX = {};
  BANK.forEach(function (q) { IDX[q.id] = q; });

  /* ---------------- 小工具 ---------------- */
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function na(a) { return String(a == null ? '' : a).replace(/[\s　,.，。、；;：:]/g, '').toUpperCase(); }
  /* 判分匹配用归一化：去空白与中英文标点、转小写 */
  function na2(a) { return String(a == null ? '' : a).toLowerCase().replace(/[\s　,.，。、；;：:？?！!（）()\[\]【】“”"‘’'·…\-—－_《》〈〉]/g, ''); }
  function pill(text, cls) { return '<span class="anspill ' + cls + '">' + esc(text) + '</span>'; }
  function optContent(q, L) {
    if (!q.options) return null;
    for (var k in q.options) if (na(k) === L) return q.options[k];
    return null;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* 判断题：选项 key 0=对 1=错 */
  function tfAnswerIsWrong(q) { var a = na(q.answer); return a.indexOf('错') >= 0 || a === 'ERROR' || a === 'F'; }
  function tfRightKey(q) { return tfAnswerIsWrong(q) ? '1' : '0'; }

  /* ---------------- 倒计时 ---------------- */
  (function () {
    var d = Math.ceil((new Date('2026-10-25T09:00:00') - new Date()) / 86400000);
    $('#ddlText').textContent = d > 0 ? ('距离 10/25 考试还有 ' + d + ' 天') : '考试加油！';
  })();

  /* ---------------- 筛选 ---------------- */
  function subjQs() { return BANK.filter(function (q) { return q.subject === S.subject; }); }
  function passFilter(q) {
    if (q.subject !== S.subject) return false;
    if (S.types.length && S.types.indexOf(q.type) < 0) return false;
    if (S.eras.length && S.eras.indexOf(q.era) < 0) return false;
    if (S.chapters.length && S.chapters.indexOf(q.chapter) < 0) return false;
    var r = P[q.id];
    if (S.status === 'todo' && r && r.n) return false;
    if (S.status === 'wrong' && !(r && r.lw)) return false;
    if (S.status === 'star' && !(r && r.star)) return false;
    if (S.status === 'done' && !(r && r.n)) return false;
    if (S.kw) {
      var hay = (q.stem + ' ' + (q.answer || '') + ' ' + (q.chapter || '') + ' ' + (q.paper || '')).toLowerCase();
      if (hay.indexOf(S.kw.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function rebuildQueue() {
    var ids = subjQs().filter(passFilter).map(function (x) { return x.id; });
    S.queue = S.shuffled ? shuffle(ids) : ids;
    if (S.idx >= S.queue.length) S.idx = Math.max(0, S.queue.length - 1);
    $('#fCount').textContent = '命中 ' + S.queue.length + ' 题 / 本科目共 ' + subjQs().length + ' 题';
    renderQuestion();
  }

  function renderFilters() {
    var list = subjQs();
    var tm = {}; list.forEach(function (q) { tm[q.type] = (tm[q.type] || 0) + 1; });
    $('#fType').innerHTML = ['<button class="chip' + (S.types.length ? '' : ' on') + '" data-k="__all">全部</button>']
      .concat(TYPE_ORDER.filter(function (t) { return tm[t]; }).map(function (t) {
        return '<button class="chip' + (S.types.indexOf(t) >= 0 ? ' on' : '') + '" data-t="' + t + '">' + t +
          '<i style="font-style:normal;opacity:.55;font-size:11px"> ' + tm[t] + '</i></button>';
      })).join('');

    var em = {}; list.forEach(function (q) { em[q.era] = (em[q.era] || 0) + 1; });
    $('#fEra').innerHTML = Object.keys(ERA_LABEL).filter(function (e) { return em[e]; }).map(function (e) {
      return '<button class="chip era-' + e + (S.eras.indexOf(e) >= 0 ? ' on' : '') + '" data-e="' + e + '">' +
        ERA_LABEL[e] + '<i style="font-style:normal;opacity:.55;font-size:11px"> ' + em[e] + '</i></button>';
    }).join('');

    $('#fStatus').innerHTML = [['all', '全部'], ['todo', '未做'], ['wrong', '做错过'], ['done', '已做'], ['star', '已收藏']]
      .map(function (x) { return '<button class="chip' + (S.status === x[0] ? ' on' : '') + '" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('');

    var m = {};
    list.forEach(function (q) { if (q.chapter) m[q.chapter] = 1; });
    $('#fChapter').innerHTML = ['<button class="chip' + (S.chapters.length ? '' : ' on') + '" data-c="__all">全部</button>']
      .concat(Object.keys(m).sort().map(function (c) {
        return '<button class="chip' + (S.chapters.indexOf(c) >= 0 ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>';
      })).join('');
    $('#fChapter').classList.add('scroll');
  }

  /* ---------------- 题目渲染 ---------------- */
  function highlightStem(s) {
    return esc(s).replace(/(_{3,}|（\s*）|\(\s*\))/g,
      '<span style="border-bottom:2px solid var(--primary);display:inline-block;min-width:58px;padding:0 6px">&nbsp;</span>');
  }

  function renderQuestion() {
    if (!S.queue.length) {
      $('#qBody').style.display = 'none';
      $('#emptyTip').style.display = '';
      $('#emptyTip').innerHTML = '没有符合条件的题目。<br><button class="mini" onclick="document.getElementById(\'btnReset\').click()">重置筛选</button>';
      return;
    }
    $('#qBody').style.display = '';
    $('#emptyTip').style.display = 'none';

    var q = IDX[S.queue[S.idx]];
    if (!q) return;
    S.answered = false;
    S.multiSel = [];

    $('#qType').textContent = q.type;
    $('#qSrc').textContent = (q.paper || q.source || '').slice(0, 42);
    var eb = $('#qEra');
    eb.textContent = ERA_LABEL[q.era] || '';
    eb.className = 'badge era era-' + q.era;
    var r = P[q.id];
    $('#btnStar').textContent = (r && r.star) ? '★' : '☆';
    $('#btnStar').classList.toggle('on', !!(r && r.star));

    $('#qPos').textContent = (S.idx + 1) + ' / ' + S.queue.length;
    $('#qBar').style.width = ((S.idx + 1) / S.queue.length * 100) + '%';
    $('#qStem').innerHTML = highlightStem(q.stem);

    var box = $('#qOptions'); box.innerHTML = ''; box.style.display = 'none';
    $('#fillBox').style.display = 'none';
    $('#fillTip').innerHTML = '';
    $('#answerBox').style.display = 'none';
    $('#answerBox').className = 'answerbox' + (OBJ[q.type] ? '' : ' subjective');
    setShowBtn(null);

    if (q.type === '判断题') {
      box.style.display = 'flex';
      box.appendChild(mkOpt('0', '对', q, 'A'));
      box.appendChild(mkOpt('1', '错', q, 'B'));
    } else if (q.options && Object.keys(q.options).length) {
      box.style.display = 'flex';
      Object.keys(q.options).sort().forEach(function (k) { box.appendChild(mkOpt(k, q.options[k], q, k)); });
    } else if (q.type === '填空题') {
      $('#fillBox').style.display = 'flex';
      $('#fillInput').value = '';
    } else {
      // 主观题
      $('#answerBox').style.display = 'none';
    }

    if (S.mode === 'recite') { showAnswer(true); }
    else { $('#btnShow').textContent = OBJ[q.type] ? '看答案' : '看答案（自评）'; }
  }

  function mkOpt(k, text, q, label) {
    var b = document.createElement('button');
    b.className = 'opt'; b.dataset.k = k;
    b.innerHTML = '<span class="k">' + esc(label || k) + '</span><span>' + esc(text) + '</span>';
    b.onclick = function () { onPick(q, b); };
    return b;
  }

  /* btnShow 的行为切换 */
  function setShowBtn(fn) {
    $('#btnShow').onclick = fn || defaultShow;
  }
  function defaultShow() {
    var q = IDX[S.queue[S.idx]]; if (!q) return;
    var ab = $('#answerBox');
    if (ab.style.display === 'none' || !ab.style.display) {  // 答案尚未显示
      if (!OBJ[q.type] && !S.answered) { var r = rec(q.id); r.n++; save(); }
      S.answered = true;
      showAnswer(true);
    } else nextQ();
  }

  function onPick(q, btn) {
    if (S.answered) return;
    if (q.type === '多选题') {
      btn.classList.toggle('sel');
      S.multiSel = $$('#qOptions .opt.sel').map(function (o) { return o.dataset.k; });
      $('#btnShow').textContent = '对答案（已选 ' + S.multiSel.sort().join('') + '）';
      setShowBtn(function () { finishMulti(q); });
      return;
    }
    S.answered = true;
    var right = (q.type === '判断题') ? (btn.dataset.k === tfRightKey(q)) : (na(btn.dataset.k) === na(q.answer));
    $$('#qOptions .opt').forEach(function (o) {
      o.classList.add('locked');
      var ok = (q.type === '判断题') ? (o.dataset.k === tfRightKey(q)) : (na(o.dataset.k) === na(q.answer));
      if (ok) o.classList.add('right');
    });
    if (!right) btn.classList.add('wrong');
    markResult(q, right);
    showAnswer(false);
  }

  function finishMulti(q) {
    if (S.answered) return;
    S.answered = true;
    var sel = S.multiSel.slice().sort().join('');
    var right = na(sel) === na(q.answer);
    $$('#qOptions .opt').forEach(function (o) {
      o.classList.add('locked');
      if (na(q.answer).indexOf(o.dataset.k) >= 0) o.classList.add('right');
      else if (o.classList.contains('sel')) o.classList.add('wrong');
    });
    markResult(q, right);
    showAnswer(false);
  }

  function markResult(q, right) {
    var r = rec(q.id);
    r.n++;
    if (right) { r.ok++; r.lw = 0; } else { r.w++; r.lw = 1; }
    save();
  }

  function showAnswer(silent) {
    var q = IDX[S.queue[S.idx]];
    var ab = $('#answerBox');
    ab.className = 'answerbox' + (OBJ[q.type] ? '' : ' subjective');
    $('#aText').innerHTML = esc(q.answer || '（本题暂无参考答案）');
    $('#alabel').textContent = OBJ[q.type] ? '正确答案' : '参考答案（踩分点）';
    if (q.analysis) { $('#aAnalysis').style.display = ''; $('#aAnalysis').innerHTML = '💡 ' + esc(q.analysis); }
    else $('#aAnalysis').style.display = 'none';
    $('.selfgrade').style.display = OBJ[q.type] ? 'none' : 'flex';
    ab.style.display = '';
    $('#btnShow').textContent = '下一题 →';
    setShowBtn(defaultShow);
    if (!silent && ab.scrollIntoView) ab.scrollIntoView({ block: 'nearest' });
  }

  function submitFill() {
    var q = IDX[S.queue[S.idx]];
    if (!q || S.answered) return;
    var v = $('#fillInput').value.trim();
    if (!v) { $('#fillInput').focus(); return; }
    S.answered = true;
    var a = na(q.answer), u = na(v);
    var right = (u === a) || (u.length >= 2 && a.indexOf(u) >= 0) || (a.length >= 3 && u.indexOf(a) >= 0);
    $('#fillTip').innerHTML = '你的答案：<b style="color:' + (right ? 'var(--ok)' : 'var(--no)') + '">' + esc(v) +
      (right ? ' ✓' : ' ✗') + '</b>　正确答案：<b style="color:var(--ok)">' + esc(q.answer) + '</b>';
    markResult(q, right);
    showAnswer(false);
  }

  function nextQ() {
    if (S.idx < S.queue.length - 1) { S.idx++; renderQuestion(); }
    else {
      $('#qBody').style.display = 'none';
      $('#emptyTip').style.display = '';
      $('#emptyTip').innerHTML = '🎉 这一轮 ' + S.queue.length + ' 题刷完了。<br><br>' +
        '<button class="btn primary" onclick="location.reload()">再来一轮 / 换筛选</button>';
    }
  }
  function prevQ() { if (S.idx > 0) { S.idx--; renderQuestion(); } }

  /* ---------------- 模拟考试 ---------------- */
  var EX = { paper: [], tpl: [], left: 0, timer: null, submitted: false };

  function buildExam() {
    var tpl = EXAM_TPL[S.subject];
    var onlyNew = $('#examOnlyNew') && $('#examOnlyNew').checked;
    var pool = subjQs().filter(function (q) { return !onlyNew || q.era !== 'legacy'; });
    var paper = [], warn = [];
    tpl.forEach(function (t) {
      var cand = shuffle(pool.filter(function (q) { return q.type === t[0]; })).slice(0, t[1]);
      if (cand.length < t[1]) warn.push(t[0] + '仅 ' + cand.length + '/' + t[1] + '题');
      cand.forEach(function (q) { paper.push({ q: q, score: t[2], ans: null, grade: null }); });
    });
    EX.paper = paper; EX.tpl = tpl; EX.submitted = false;
    $('#examTpl').innerHTML = tpl.map(function (t) {
      return '<div class="tplbox">' + t[0] + ' <b>' + t[1] + '</b>题 × ' + t[2] + '分</div>';
    }).join('') + (warn.length ? '<div class="tplbox" style="color:var(--warn)">⚠ ' + warn.join('；') + '</div>' : '');
  }

  function renderExamPaper() {
    $('#examPaper').innerHTML = EX.paper.map(function (it, i) {
      var q = it.q, h = '<div class="ex-item"><div class="ex-no">第 ' + (i + 1) + ' 题 · ' + q.type + ' · ' + it.score + ' 分</div>';
      h += '<div class="ex-q">' + highlightStem(q.stem) + '</div>';
      if (q.type === '判断题') {
        h += '<div class="ex-opts">' + [['0', '对', 'A'], ['1', '错', 'B']].map(function (x) {
          return '<button class="ex-opt" data-i="' + i + '" data-k="' + x[0] + '"><span class="k">' + x[2] + '</span><span>' + x[1] + '</span></button>';
        }).join('') + '</div>';
      } else if (q.options && Object.keys(q.options).length) {
        h += '<div class="ex-opts">' + Object.keys(q.options).sort().map(function (k) {
          return '<button class="ex-opt" data-i="' + i + '" data-k="' + k + '"><span class="k">' + esc(k) + '</span><span>' + esc(q.options[k]) + '</span></button>';
        }).join('') + '</div>';
      } else {
        h += '<textarea class="ex-answer" data-i="' + i + '" placeholder="写下你的答案（主观题按踩分点写）"></textarea>';
      }
      return h + '</div>';
    }).join('');

    $$('#examPaper .ex-opt').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.i, k = b.dataset.k, it = EX.paper[i];
        if (it.q.type === '多选题') {
          b.classList.toggle('on');
          it.ans = $$('#examPaper .ex-opt.on[data-i="' + i + '"]').map(function (o) { return o.dataset.k; }).sort().join('');
        } else {
          $$('#examPaper .ex-opt[data-i="' + i + '"]').forEach(function (o) { o.classList.remove('on'); });
          b.classList.add('on'); it.ans = k;
        }
      };
    });
    $$('#examPaper .ex-answer').forEach(function (t) {
      t.oninput = function () { EX.paper[+t.dataset.i].ans = t.value; };
    });
  }

  function startExam() {
    buildExam();
    if (!EX.paper.length) { alert('没有可用题目，请取消「只从新大纲抽题」。'); return; }
    renderExamPaper();
    $('#examSetup').style.display = 'none';
    $('#examRun').style.display = '';
    $('#examResult').style.display = 'none';
    $('#examProg').textContent = '共 ' + EX.paper.length + ' 题 · 满分 100 分';
    EX.left = EXAM_MIN * 60;
    clearInterval(EX.timer);
    if ($('#examTimer').checked) {
      EX.timer = setInterval(function () {
        EX.left--;
        var m = Math.floor(EX.left / 60), s = EX.left % 60, c = $('#examClock');
        c.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        if (EX.left <= 600) c.classList.add('warn');
        if (EX.left <= 0) { clearInterval(EX.timer); gradeExam(); }
      }, 1000);
    } else $('#examClock').textContent = '不计时';
    window.scrollTo(0, 0);
  }

  function gradeExam() {
    if (EX.submitted) return;
    EX.submitted = true;
    clearInterval(EX.timer);
    var got = 0, total = 0, rows = [];
    EX.paper.forEach(function (it) {
      total += it.score;
      var g = 0;
      if (OBJ[it.q.type]) {
        var a = na(it.ans || ''), b = na(it.q.answer);
        if (it.q.type === '判断题') g = (a === tfRightKey(it.q)) ? 1 : 0;
        else if (it.q.type === '填空题') g = (a && (a === b || (a.length >= 2 && b.indexOf(a) >= 0))) ? 1 : 0;
        else g = (a === b) ? 1 : 0;
        var r = rec(it.q.id);
        r.n++;
        if (g) { r.ok++; r.lw = 0; } else { r.w++; r.lw = 1; }
        save();
      } else {
        /* 主观题：没写 0 分；写了按参考答案关键词命中比例给分（0.5 分步进）；手动自评后以手动为准 */
        if (!it.manual) {
          var txt = String(it.ans || '').trim();
          if (!txt) { g = 0; it.hitKws = []; }
          else {
            var kws = it.q.kws || [];
            if (!kws.length) { g = 0.5; it.hitKws = []; }   // 无关键词可判时退回保守估算
            else {
              var hay = na2(txt);
              it.hitKws = kws.filter(function (k) { return hay.indexOf(na2(k)) >= 0; });
              g = it.score ? (Math.round(it.score * it.hitKws.length / kws.length * 2) / 2) / it.score : 0;
            }
          }
          it.grade = g;
        } else g = it.grade;
      }
      got += it.score * g;
      rows.push({ it: it, g: g });
    });
    var score = Math.round(got * 10) / 10, pass = score >= 60;
    var h = '<div class="score-big ' + (pass ? 'pass' : 'fail') + '">' + score + '<span style="font-size:20px"> / 100</span></div>' +
      '<div class="score-sub">' + (pass ? '✅ 按当前估分已过 60 分线' : '❌ 还差 ' + (60 - score).toFixed(1) + ' 分，继续刷') +
      '<br><span style="font-size:12.5px">主观题判分：没写 0 分；写了按参考答案关键词命中比例自动给分，可逐题自评修正</span></div>';

    h += '<table class="st"><tr><th>题型</th><th>题量</th><th>满分</th><th>得分</th></tr>';
    EX.tpl.forEach(function (t) {
      var rs = rows.filter(function (x) { return x.it.q.type === t[0]; });
      if (!rs.length) return;
      var g2 = rs.reduce(function (s, x) { return s + x.it.score * x.g; }, 0);
      h += '<tr><td>' + t[0] + '</td><td>' + rs.length + '</td><td>' + rs.length * t[2] + '</td><td>' + (Math.round(g2 * 10) / 10) + '</td></tr>';
    });
    h += '</table><h4 class="sec">逐题回顾</h4>';

    rows.forEach(function (row, i) {
      var it = row.it, q = it.q;
      h += '<div class="ex-item"><div class="ex-no">第 ' + (i + 1) + ' 题 · ' + q.type + ' · <b>' +
        (Math.round(it.score * row.g * 10) / 10) + '/' + it.score + '</b> 分</div>';
      h += '<div class="ex-q">' + highlightStem(q.stem) + '</div>';
      if (OBJ[q.type]) {
        var cls = row.g ? 'good' : 'bad', mineHtml = '', corrHtml = '';
        if (q.type === '判断题') {
          mineHtml = (it.ans === '0' || it.ans === '1') ? pill(it.ans === '0' ? '对' : '错', cls) : '<b style="color:var(--no)">未答</b>';
          corrHtml = pill(tfAnswerIsWrong(q) ? '错' : '对', 'good');
        } else if (q.type === '填空题') {
          mineHtml = it.ans ? pill(it.ans, cls) : '<b style="color:var(--no)">未答</b>';
          corrHtml = pill(q.answer || '', 'good');
        } else {
          if (it.ans) {
            mineHtml = String(it.ans).split('').map(function (L) {
              return pill(L + '. ' + (optContent(q, L) || ''), cls);
            }).join('');
          } else mineHtml = '<b style="color:var(--no)">未答</b>';
          var letters = na(q.answer).replace(/[^A-Z0-9]/g, '').split('');
          var allFound = letters.length > 0 && letters.every(function (L) { return optContent(q, L) != null; });
          corrHtml = allFound
            ? letters.map(function (L) { return pill(L + '. ' + optContent(q, L), 'good'); }).join('')
            : pill(q.answer || '', 'good');
        }
        h += '<div style="font-size:14px;margin-top:2px">你的答案：' + mineHtml + '</div>' +
          '<div style="font-size:14px;margin:4px 0 2px">正确答案：' + corrHtml + '</div>';
      } else {
        if (q.kws && q.kws.length) {
          var hk = it.hitKws || [];
          h += '<div style="font-size:13px;margin-top:4px">关键词命中 <b>' + hk.length + '/' + q.kws.length + '</b>：' +
            q.kws.map(function (k) {
              return '<span class="kwchip ' + (hk.indexOf(k) >= 0 ? 'hit' : 'miss') + '">' + esc(k) + '</span>';
            }).join('') + '</div>';
        }
        var autoOn = !it.manual;
        h += '<div class="ex-flag" data-i="' + i + '">自评：' +
          [['auto', '按关键词'], ['1', '满分'], ['0.5', '一半'], ['0', '不会']].map(function (x) {
            var on = (x[0] === 'auto') ? autoOn : (!autoOn && String(row.g) === x[0]);
            return '<button data-g="' + x[0] + '"' + (on ? ' class="on"' : '') + '>' + x[1] + '</button>';
          }).join('') + '</div>';
      }
      h += '<details style="margin-top:6px"><summary style="font-size:13.5px;color:var(--primary);cursor:pointer">参考答案</summary>' +
        '<div class="cram-a">' + esc(q.answer || '暂无') + '</div></details></div>';
    });
    h += '<button class="btn primary big" onclick="location.reload()">结束查看，回到练习</button>';

    $('#examResult').innerHTML = h;
    $('#examRun').style.display = 'none';
    $('#examResult').style.display = '';
    $$('#examResult .ex-flag button').forEach(function (b) {
      b.onclick = function () {
        var it = EX.paper[+b.parentNode.dataset.i];
        if (b.dataset.g === 'auto') it.manual = false;          // 回到按关键词自动判分
        else { it.grade = parseFloat(b.dataset.g); it.manual = true; }
        EX.submitted = false; gradeExam();
      };
    });
    window.scrollTo(0, 0);
  }

  /* ---------------- 考点速背 ---------------- */
  var CRAM_TYPES = ['名词解释', '简答题', '论述题', '材料分析题', '综合应用题'];
  var CRAM = { types: CRAM_TYPES.slice(), hide: false };
  function renderCram() {
    $('#cramType').innerHTML = CRAM_TYPES.map(function (t) {
      return '<button class="chip' + (CRAM.types.indexOf(t) >= 0 ? ' on' : '') + '" data-t="' + t + '">' + t + '</button>';
    }).join('');
    var list = subjQs().filter(function (q) { return CRAM.types.indexOf(q.type) >= 0 && q.era !== 'legacy'; });
    if (!list.length) { $('#cramList').innerHTML = '<div class="empty">暂无</div>'; return; }
    $('#cramList').innerHTML = list.map(function (q, i) {
      return '<div class="cram-item"><div class="cram-q"><span class="n">' + (i + 1) + '.</span><span>' + esc(q.stem) + '</span></div>' +
        '<div class="cram-a"' + (CRAM.hide ? ' style="display:none"' : '') + '>' + esc(q.answer || '暂无答案') + '</div></div>';
    }).join('');
    if (CRAM.hide) {
      $$('#cramList .cram-q').forEach(function (el) {
        el.onclick = function () {
          var a = el.parentNode.querySelector('.cram-a');
          a.style.display = (a.style.display === 'none') ? '' : 'none';
        };
      });
    }
  }

  /* ---------------- 统计 ---------------- */
  function renderStats() {
    var list = subjQs();
    var rel = list.filter(function (q) { return q.era !== 'legacy'; });
    var done = 0, wrong = 0, star = 0, objDone = 0, objRight = 0, tstat = {}, cstat = {};
    list.forEach(function (q) {
      var r = P[q.id];
      if (r && r.n) done++;
      if (r && r.lw) wrong++;
      if (r && r.star) star++;
      if (r && r.n && OBJ[q.type]) { objDone++; if (!r.lw) objRight++; }
      if (!tstat[q.type]) tstat[q.type] = { n: 0, done: 0, right: 0 };
      tstat[q.type].n++;
      if (r && r.n) { tstat[q.type].done++; if (!r.lw) tstat[q.type].right++; }
      if (q.chapter) {
        if (!cstat[q.chapter]) cstat[q.chapter] = { n: 0, done: 0, right: 0, rel: q.era !== 'legacy' };
        cstat[q.chapter].n++;
        if (r && r.n) { cstat[q.chapter].done++; if (!r.lw) cstat[q.chapter].right++; }
      }
    });
    var rate = objDone ? Math.round(objRight / objDone * 100) : 0;
    var h = '<div class="stat-grid">' +
      '<div class="stat-box"><div class="v">' + rel.length + '</div><div class="l">新大纲范围题量</div></div>' +
      '<div class="stat-box"><div class="v">' + done + '</div><div class="l">已练题数</div></div>' +
      '<div class="stat-box"><div class="v">' + rate + '%</div><div class="l">客观题正确率</div></div>' +
      '<div class="stat-box"><div class="v" style="color:var(--no)">' + wrong + '</div><div class="l">待消灭错题</div></div>' +
      '<div class="stat-box"><div class="v" style="color:#f59e0b">' + star + '</div><div class="l">收藏</div></div></div>';

    h += '<h4 class="sec">各题型掌握情况</h4><table class="st"><tr><th>题型</th><th>题量</th><th>已练</th><th>正确率</th><th style="width:110px"></th></tr>';
    TYPE_ORDER.forEach(function (t) {
      if (!tstat[t]) return;
      var s = tstat[t], p = s.done ? Math.round(s.right / s.done * 100) : 0;
      h += '<tr><td>' + t + '</td><td>' + s.n + '</td><td>' + s.done + '</td><td>' + (s.done ? p + '%' : '—') +
        '</td><td class="bar-cell"><i style="width:' + Math.max(2, p) + '%"></i></td></tr>';
    });
    h += '</table>';

    var cs = Object.keys(cstat).filter(function (c) { return cstat[c].rel; });
    if (cs.length) {
      h += '<h4 class="sec">章节覆盖与薄弱点</h4><table class="st"><tr><th>章节</th><th>题量</th><th>已练</th><th>正确率</th></tr>';
      cs.forEach(function (c) {
        var s = cstat[c], p = s.done ? Math.round(s.right / s.done * 100) : 0;
        h += '<tr><td>' + esc(c) + '</td><td>' + s.n + '</td><td>' + s.done + '</td><td style="color:' +
          (s.done && p < 60 ? 'var(--no)' : 'inherit') + '">' + (s.done ? p + '%' : '—') + '</td></tr>';
      });
      h += '</table>';
    }

    h += '<div style="font-size:13.5px;color:var(--ink2);line-height:1.95;border-top:1px dashed var(--line);padding-top:12px">' +
      '<b>及格打法（目标 60，稳拿 70+）</b><br>' +
      '· <b>14237 手机媒体概论</b>：单选 25 分 + 名解 20 分 + 简答 25 分 = 70 分，是基本盘。论述 9 分、材料 9 分、综合 12 分，按要点分条写满就能拿一半以上（15 分）。<br>' +
      '· <b>08257 舆论学</b>：客观题（单选/多选/判断）+ 名词解释保底，简答论述务必<b>分条列点</b>，阅卷按踩分点给分。<br>' +
      '· 节奏建议：先把「新大纲核心」客观题刷到 85%，再背名词解释和简答踩分点，最后做 2~3 套模拟考。</div>';

    $('#statsBody').innerHTML = h;
  }

  /* ---------------- 模式切换 ---------------- */
  function setMode(m) {
    S.mode = m;
    $$('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.mode === m); });
    $('#filterBar').style.display = (m === 'practice' || m === 'recite') ? '' : 'none';
    $('#cardView').style.display = (m === 'practice' || m === 'recite' || m === 'wrong') ? '' : 'none';
    $('#examView').style.display = (m === 'exam') ? '' : 'none';
    $('#cramView').style.display = (m === 'cram') ? '' : 'none';
    $('#statsView').style.display = (m === 'stats') ? '' : 'none';
    if (m === 'wrong') {
      S.status = 'wrong'; S.eras = ['new', 'mid', 'legacy']; S.types = []; S.chapters = []; S.kw = ''; $('#fKw').value = '';
      renderFilters(); rebuildQueue();
    } else if (m === 'practice' || m === 'recite') {
      if (S.status === 'wrong') {          // 从错题本切回，恢复默认范围
        S.status = 'all'; S.eras = ['new', 'mid']; S.idx = 0;
      }
      renderFilters(); rebuildQueue();
    } else if (m === 'cram') renderCram();
    else if (m === 'stats') renderStats();
    else if (m === 'exam') {
      buildExam();
      $('#examSetup').style.display = ''; $('#examRun').style.display = 'none'; $('#examResult').style.display = 'none';
    }
    window.scrollTo(0, 0);
  }

  function setSubject(sub) {
    S.subject = sub;
    $$('.sub-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.sub === sub); });
    S.types = []; S.chapters = []; S.status = 'all'; S.kw = ''; $('#fKw').value = ''; S.idx = 0;
    renderFilters(); setMode(S.mode);
  }

  /* ---------------- 绑定 ---------------- */
  function bind() {
    $$('.sub-btn').forEach(function (b) { b.onclick = function () { setSubject(b.dataset.sub); }; });
    $$('.tab').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); }; });

    $('#fType').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      if (b.dataset.k === '__all') S.types = [];
      else { var t = b.dataset.t, i = S.types.indexOf(t); i >= 0 ? S.types.splice(i, 1) : S.types.push(t); }
      S.idx = 0; renderFilters(); rebuildQueue();
    };
    $('#fEra').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var v = b.dataset.e, i = S.eras.indexOf(v); i >= 0 ? S.eras.splice(i, 1) : S.eras.push(v);
      S.idx = 0; renderFilters(); rebuildQueue();
    };
    $('#fStatus').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      S.status = b.dataset.s; S.idx = 0; renderFilters(); rebuildQueue();
    };
    $('#fChapter').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var c = b.dataset.c;
      if (c === '__all') S.chapters = [];
      else { var i = S.chapters.indexOf(c); i >= 0 ? S.chapters.splice(i, 1) : S.chapters.push(c); }
      S.idx = 0; renderFilters(); rebuildQueue();
    };
    var kwt;
    $('#fKw').oninput = function (e) {
      clearTimeout(kwt); var v = e.target.value.trim();
      kwt = setTimeout(function () { S.kw = v; S.idx = 0; rebuildQueue(); }, 220);
    };
    $('#btnReset').onclick = function () {
      S.types = []; S.chapters = []; S.status = 'all'; S.eras = ['new', 'mid']; S.kw = ''; $('#fKw').value = ''; S.idx = 0;
      renderFilters(); rebuildQueue();
    };
    $('#btnShuffle').onclick = function () {
      S.shuffled = !S.shuffled;
      $('#btnShuffle').textContent = S.shuffled ? '恢复顺序' : '打乱顺序';
      S.idx = 0; rebuildQueue();
    };

    $('#btnPrev').onclick = prevQ;
    $('#btnNext').onclick = nextQ;
    $('#fillSubmit').onclick = submitFill;
    $('#fillInput').onkeydown = function (e) { if (e.key === 'Enter') submitFill(); };
    $$('.gbtn').forEach(function (b) {
      b.onclick = function () {
        var q = IDX[S.queue[S.idx]]; if (!q) return;
        var ok = b.dataset.g === '1', r = rec(q.id);
        if (ok) { r.ok++; r.lw = 0; } else { r.w++; r.lw = 1; }
        save(); nextQ();
      };
    });
    $('#btnStar').onclick = function () {
      var q = IDX[S.queue[S.idx]]; if (!q) return;
      var r = rec(q.id);
      r.star = r.star ? 0 : 1; save();
      $('#btnStar').textContent = r.star ? '★' : '☆';
      $('#btnStar').classList.toggle('on', !!r.star);
    };

    $('#btnStartExam').onclick = startExam;
    $('#btnSubmitExam').onclick = gradeExam;
    $('#btnSubmitExam2').onclick = gradeExam;

    $('#cramType').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      var t = b.dataset.t, i = CRAM.types.indexOf(t); i >= 0 ? CRAM.types.splice(i, 1) : CRAM.types.push(t);
      renderCram();
    };
    $('#cramHide').onchange = function (e) { CRAM.hide = e.target.checked; renderCram(); };

    $('#btnExport').onclick = function () {
      var blob = new Blob([JSON.stringify(P)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '刷题进度_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
    };
    $('#btnImport').onclick = function () {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
      inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try { var d = JSON.parse(fr.result); Object.keys(d).forEach(function (k) { P[k] = d[k]; }); save(); alert('导入成功'); renderStats(); }
          catch (e2) { alert('文件格式不对'); }
        };
        fr.readAsText(f);
      };
      inp.click();
    };
    $('#btnResetAll').onclick = function () {
      if (confirm('确定清空全部刷题进度？不可恢复。')) { P = {}; save(); renderStats(); }
    };

    document.onkeydown = function (e) {
      if (/input|textarea/i.test(e.target.tagName)) return;
      if (['practice', 'recite', 'wrong'].indexOf(S.mode) < 0) return;
      if (e.key >= '1' && e.key <= '5') {
        var o = $$('#qOptions .opt')[+e.key - 1]; if (o) o.click();
      } else if (e.key === ' ') { e.preventDefault(); $('#btnShow').click(); }
      else if (e.key === 'ArrowRight') nextQ();
      else if (e.key === 'ArrowLeft') prevQ();
      else if (e.key === 's' || e.key === 'S') $('#btnStar').click();
    };
  }

  /* ---------------- 启动 ---------------- */
  renderFilters();
  bind();
  setMode('practice');
  buildExam();
})();

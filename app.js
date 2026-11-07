(() => {
  const CATS = {
    expense: ['식비', '교통', '주거/통신', '쇼핑', '의료', '문화/여가', '교육', '기타'],
    income: ['급여', '용돈', '부수입', '기타'],
  };
  const KEY = 'ledger.v1';
  const $ = (id) => document.getElementById(id);
  const won = (n) => n.toLocaleString('ko-KR') + '원';

  let items = load();
  let view = new Date(); view.setDate(1);
  let editingId = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const today = () => {
    const d = new Date();
    return `${ym(d)}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function render() {
    const key = ym(view);
    $('monthLabel').textContent = `${view.getFullYear()}년 ${view.getMonth() + 1}월`;
    const month = items.filter((i) => i.date.startsWith(key))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const sum = (t) => month.filter((i) => i.type === t).reduce((s, i) => s + i.amount, 0);
    const inc = sum('income'), exp = sum('expense'), bal = inc - exp;
    $('sumIncome').textContent = won(inc);
    $('sumExpense').textContent = won(exp);
    $('sumBalance').textContent = won(bal);
    $('sumBalance').className = bal < 0 ? 'expense' : '';

    // 카테고리별 지출
    const byCat = {};
    month.filter((i) => i.type === 'expense').forEach((i) => { byCat[i.category] = (byCat[i.category] || 0) + i.amount; });
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    $('statsCard').hidden = rows.length === 0;
    $('stats').replaceChildren(...rows.map(([c, v]) => {
      const row = document.createElement('div'); row.className = 'bar-row';
      const head = document.createElement('div'); head.className = 'head';
      const pct = Math.round((v / exp) * 100);
      head.append(Object.assign(document.createElement('span'), { textContent: c }),
        Object.assign(document.createElement('span'), { textContent: `${won(v)} (${pct}%)` }));
      const bar = document.createElement('div'); bar.className = 'bar';
      const fill = document.createElement('i'); fill.style.width = pct + '%';
      bar.append(fill); row.append(head, bar); return row;
    }));

    // 내역 (날짜별)
    const list = $('list');
    if (!month.length) {
      list.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: '이번 달 내역이 없어요. + 버튼으로 추가해 보세요.' }));
      return;
    }
    const nodes = [];
    let lastDate = null;
    for (const i of month) {
      if (i.date !== lastDate) {
        lastDate = i.date;
        const d = new Date(i.date + 'T00:00:00');
        const dayTotal = month.filter((x) => x.date === i.date).reduce((s, x) => s + (x.type === 'income' ? x.amount : -x.amount), 0);
        const h = document.createElement('div'); h.className = 'day';
        h.append(Object.assign(document.createElement('span'), { textContent: `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})` }),
          Object.assign(document.createElement('span'), { textContent: (dayTotal > 0 ? '+' : '') + dayTotal.toLocaleString('ko-KR') }));
        nodes.push(h);
      }
      const b = document.createElement('button'); b.className = 'item'; b.type = 'button';
      const left = document.createElement('div');
      left.append(Object.assign(document.createElement('div'), { className: 'cat', textContent: i.category }));
      if (i.memo) left.append(Object.assign(document.createElement('div'), { className: 'memo', textContent: i.memo }));
      const amt = Object.assign(document.createElement('div'), {
        className: 'amt ' + i.type,
        textContent: (i.type === 'income' ? '+' : '-') + i.amount.toLocaleString('ko-KR'),
      });
      b.append(left, amt);
      b.addEventListener('click', () => openDialog(i));
      nodes.push(b);
    }
    list.replaceChildren(...nodes);
  }

  // ---- 입력 다이얼로그 ----
  const dlg = $('dlg'), form = $('form');
  function fillCategories(type, selected) {
    const sel = form.elements.category;
    sel.replaceChildren(...CATS[type].map((c) => Object.assign(document.createElement('option'), { value: c, textContent: c })));
    if (selected && CATS[type].includes(selected)) sel.value = selected;
  }
  function openDialog(item) {
    editingId = item ? item.id : null;
    $('dlgTitle').textContent = item ? '내역 수정' : '내역 추가';
    $('delBtn').hidden = !item;
    const type = item ? item.type : 'expense';
    form.elements.type.value = type;
    fillCategories(type, item && item.category);
    form.elements.amount.value = item ? item.amount : '';
    form.elements.date.value = item ? item.date : (ym(new Date()) === ym(view) ? today() : `${ym(view)}-01`);
    form.elements.memo.value = item ? item.memo : '';
    dlg.showModal();
    form.elements.amount.focus();
  }
  form.addEventListener('change', (e) => {
    if (e.target.name === 'type') fillCategories(e.target.value);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const amount = Math.round(Number(f.amount.value));
    if (!(amount > 0)) return;
    const rec = {
      id: editingId ?? Date.now(),
      type: f.type.value, amount, category: f.category.value,
      date: f.date.value, memo: f.memo.value.trim(),
    };
    items = editingId ? items.map((i) => (i.id === editingId ? rec : i)) : [...items, rec];
    save();
    view = new Date(rec.date + 'T00:00:00'); view.setDate(1);
    dlg.close(); render();
  });
  $('cancelBtn').addEventListener('click', () => dlg.close());
  $('delBtn').addEventListener('click', () => {
    if (!confirm('이 내역을 삭제할까요?')) return;
    items = items.filter((i) => i.id !== editingId);
    save(); dlg.close(); render();
  });
  $('fab').addEventListener('click', () => openDialog(null));

  // ---- 월 이동 ----
  const shift = (n) => { view = new Date(view.getFullYear(), view.getMonth() + n, 1); render(); };
  $('prev').addEventListener('click', () => shift(-1));
  $('next').addEventListener('click', () => shift(1));

  // ---- CSV 내보내기 ----
  $('exportBtn').addEventListener('click', () => {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const head = ['날짜', '구분', '카테고리', '금액', '메모'];
    const rows = [...items].sort((a, b) => a.date.localeCompare(b.date))
      .map((i) => [i.date, i.type === 'income' ? '수입' : '지출', i.category, i.amount, i.memo].map(esc).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `가계부_${today()}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  });

  // ---- CSV 불러오기 ----
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((x) => x !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.some((x) => x !== '')) rows.push(row);
    return rows;
  }
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const rows = parseCSV(await file.text());
    if (!rows.length || rows[0][0].trim() !== '날짜') {
      alert('이 앱에서 내보낸 CSV 파일이 아니에요. (첫 줄이 "날짜,구분,카테고리,금액,메모"여야 해요)');
      return;
    }
    const seen = new Set(items.map((i) => [i.date, i.type, i.category, i.amount, i.memo].join('|')));
    let added = 0, dup = 0, bad = 0, n = 0;
    const base = Date.now();
    for (const r of rows.slice(1)) {
      const [date, kind, cat, amt, memo = ''] = r.map((x) => x.trim());
      const type = kind === '수입' ? 'income' : kind === '지출' ? 'expense' : null;
      const amount = Math.round(Number(amt));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !type || !(amount > 0)) { bad++; continue; }
      const category = CATS[type].includes(cat) ? cat : '기타';
      const sig = [date, type, category, amount, memo].join('|');
      if (seen.has(sig)) { dup++; continue; }
      seen.add(sig);
      items.push({ id: base + n++, type, amount, category, date, memo });
      added++;
    }
    save(); render();
    alert(`${added}건을 불러왔어요.` + (dup ? `\n이미 있는 ${dup}건은 건너뛰었어요.` : '') + (bad ? `\n형식이 맞지 않는 ${bad}건은 제외했어요.` : ''));
  });

  // ---- 색상 테마 ----
  const THEMES = [
    ['green', '초록', '#39ff6a'], ['amber', '호박', '#ffb000'], ['cyan', '하늘', '#4de1ff'],
    ['pink', '분홍', '#ff6ad5'], ['white', '흰색', '#e8e8e8'], ['gameboy', '게임보이', '#9bbc0f'],
  ];
  const root = document.documentElement;
  function applyTheme(name, persist) {
    if (!THEMES.some((t) => t[0] === name)) name = 'green';
    root.dataset.theme = name;
    if (persist) { try { localStorage.setItem('ledger.theme', name); } catch {} }
    document.querySelectorAll('#themes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === name)));
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();
  }
  $('themes').replaceChildren(...THEMES.map(([id, label, color]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.t = id; b.title = label; b.setAttribute('aria-label', label + ' 테마');
    b.style.background = color;
    b.addEventListener('click', () => applyTheme(id, true));
    return b;
  }));
  applyTheme(root.dataset.theme || 'green', false);

  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

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

  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

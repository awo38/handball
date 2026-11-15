// Parser für die handball4all "Presseinformation - lang" PDFs (sboPublicReports.php?sGID=…)
// Läuft im Browser und in Node. inflate(Uint8Array) -> Promise<Uint8Array> wird übergeben.
(function (root) {
  const latin1 = u => { let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return s; };

  function decodeStr(raw) {
    // PDF-Literal-String: Escapes auflösen, dann UTF-16BE (mPDF) oder Latin-1
    let out = [];
    for (let i = 0; i < raw.length; i++) {
      let c = raw[i];
      if (c === '\\') {
        const n = raw[++i];
        if (n >= '0' && n <= '7') { let o = n; while (o.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') o += raw[++i]; out.push(parseInt(o, 8)); }
        else out.push(({n:10, r:13, t:9, b:8, f:12})[n] ?? n.charCodeAt(0));
      } else out.push(c.charCodeAt(0));
    }
    if (out.length >= 2 && out.length % 2 === 0 && out.filter((b, i) => i % 2 === 0 && b === 0).length >= out.length / 4) {
      let s = ''; for (let i = 0; i < out.length; i += 2) s += String.fromCharCode((out[i] << 8) | out[i + 1]); return s;
    }
    return String.fromCharCode(...out);
  }
  const hexStr = h => { let s = ''; for (let k = 0; k + 3 < h.length; k += 4) s += String.fromCharCode(parseInt(h.slice(k, k + 4), 16)); return s; };

  async function pdfLines(bytes, inflate) {
    const s = latin1(bytes);
    const ids = [...s.matchAll(/\/Contents (\d+) 0 R/g)].map(m => m[1]);
    const pages = [];
    for (const id of ids) {
      const i = s.indexOf('\n' + id + ' 0 obj'); if (i < 0) continue;
      const st0 = s.indexOf('stream', i); const st = s.indexOf('\n', st0) + 1;
      const len = +((/\/Length (\d+)/.exec(s.slice(i, st0)) || [])[1] || 0);
      const dict = s.slice(i, st0);
      let data = bytes.subarray(st, st + len);
      if (/FlateDecode/.test(dict)) data = await inflate(data);
      const t = latin1(data);
      const items = []; let x = 0, y = 0;
      const tok = /(-?[\d.]+) (-?[\d.]+) Td|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm|<([0-9A-Fa-f]*)> ?Tj|\(((?:\\.|[^\\)])*)\) ?Tj|\[((?:\\.|[^\]\\])*)\] ?TJ|\bBT\b/g;
      let m;
      while ((m = tok.exec(t))) {
        if (m[0] === 'BT') { x = 0; y = 0; continue; }
        if (m[1] !== undefined) { x += +m[1]; y += +m[2]; continue; }
        if (m[3] !== undefined) { x = +m[7]; y = +m[8]; continue; }
        let str = '';
        if (m[9] !== undefined) str = hexStr(m[9]);
        else if (m[10] !== undefined) str = decodeStr(m[10]);
        else for (const p of m[11].matchAll(/<([0-9A-Fa-f]*)>|\(((?:\\.|[^\\)])*)\)/g)) str += p[1] !== undefined ? hexStr(p[1]) : decodeStr(p[2]);
        str = str.replace(/\u0000/g, '').trim();
        if (str) items.push({ x: Math.round(x), y: Math.round(y), s: str });
      }
      const byY = new Map();
      items.forEach(it => { const k = [...byY.keys()].find(k => Math.abs(k - it.y) <= 2) ?? it.y; if (!byY.has(k)) byY.set(k, []); byY.get(k).push(it); });
      pages.push([...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x)));
    }
    return pages;
  }

  const toSec = t => { const m = /(\d+):(\d+)/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };

  async function parseReport(bytes, inflate) {
    const pages = await pdfLines(bytes, inflate);
    const res = { home: null, guest: null, result: null, half: null, spectators: null, refs: [], players: { h: [], g: [] }, officials: { h: [], g: [] }, events: [] };
    let section = null, mode = null;
    for (const rows of pages) for (const row of rows) {
      const first = row[0].s, txt = row.map(r => r.s).join(' ');
      if (/^Heim - Gast$/.test(first) && row[1]) { const p = row[1].s.split(' - '); res.home = p[0].trim(); res.guest = p.slice(1).join(' - ').trim(); continue; }
      if (first === 'Endstand' && row[1]) { const m = /(\d+):(\d+)\s*\((\d+):(\d+)\)/.exec(row[1].s); if (m) { res.result = [+m[1], +m[2]]; res.half = [+m[3], +m[4]]; } const z = row.find(r => r.x > 500); if (z && /\d/.test(z.s)) res.spectators = +z.s.replace(/\D/g, ''); continue; }
      if (first === 'Name' && row.length > 1 && mode !== 'pl') { res.refs = row.slice(1).map(r => r.s).filter(s => !/N\.N\./.test(s)); continue; }
      if (/^Heim:/.test(first)) { section = 'h'; mode = 'pl'; continue; }
      if (/^Gast:/.test(first)) { section = 'g'; mode = 'pl'; continue; }
      if (first === 'Spielverlauf') { mode = 'ev'; continue; }
      if (mode === 'pl' && section) {
        if (row[0].x > 70 || !/^(\d+|[A-E])$/.test(first)) continue;
        const cell = (a, b) => row.filter(r => r.x >= a && r.x < b).map(r => r.s).join(' ');
        const name = cell(75, 200).replace(/\s*\(\d+->\d+\)\s*$/, '').trim();
        if (!name || /^N\.N\./.test(name)) continue;
        if (/^[A-E]$/.test(first)) { res.officials[section].push({ r: first, name, warn: !!cell(345, 375), two: cell(375, 460).split(/\s+/).filter(Boolean).length, disq: !!cell(460, 490) }); continue; }
        const sm = /(\d+)\s*\/\s*(\d+)/.exec(cell(315, 345));
        const twos = cell(375, 460).split(/\s+/).filter(x => /\d+:\d+/.test(x));
        res.players[section].push({
          nr: +first, name, goals: +(cell(285, 315) || 0) || 0, s7a: sm ? +sm[1] : 0, s7g: sm ? +sm[2] : 0,
          warn: /\d+:\d+/.test(cell(345, 375)), two: twos.length, disq: !!cell(460, 490).trim(), ber: !!cell(490, 520).trim(), tw: cell(255, 270) === 'X' || /\bTW\b/.test(cell(255, 290))
        });
        continue;
      }
      if (mode === 'ev') {
        if (row.length < 2 || !/^\d+:\d+:\d+$/.test(first)) continue;
        const gt = row.find(r => r.x >= 110 && r.x < 170), sc = row.find(r => r.x >= 170 && r.x < 225), act = row.find(r => r.x >= 225);
        if (!gt || !act) continue;
        const a = act.s; let type = null;
        if (/^7m-Tor/.test(a)) type = '7';
        else if (/^7m, KEIN Tor/.test(a)) type = 'x';
        else if (/^Tor/.test(a)) type = 't';
        else if (/^2-min/.test(a)) type = '2';
        else if (/^Verwarnung/.test(a)) type = 'v';
        else if (/^Disqualifikation/.test(a)) type = 'd';
        else if (/^Auszeit/.test(a)) type = 'a';
        else continue;
        const pm = /(?:durch|für) (.+?) \((\d+), (.+)\)\s*$/.exec(a);
        const ev = { t: toSec(gt.s), type };
        if (sc) { const m = /(\d+):(\d+)/.exec(sc.s); if (m) ev.sc = [+m[1], +m[2]]; }
        if (pm) { ev.name = pm[1].replace(/\s*\(\d+->\d+\)\s*$/, '').trim(); ev.nr = +pm[2]; ev.team = pm[3]; }
        else if (type === 'a') ev.team = a.replace(/^Auszeit\s*/, '');
        res.events.push(ev);
      }
    }
    // Seite der Ereignisse bestimmen (über Kader)
    const find = (side, ev) => res.players[side].some(p => p.nr === ev.nr && p.name === ev.name);
    let lastSc = [0, 0];
    res.events.forEach(ev => {
      if (ev.nr != null) ev.side = find('h', ev) ? 'h' : find('g', ev) ? 'g' : null;
      if (!ev.side && ev.sc) ev.side = ev.sc[0] > lastSc[0] ? 'h' : ev.sc[1] > lastSc[1] ? 'g' : null;
      if (!ev.side && ev.team) { const n = ev.team.replace(/\.$/, ''); ev.side = res.home && res.home.startsWith(n) ? 'h' : res.guest && res.guest.startsWith(n) ? 'g' : null; }
      if (ev.sc) lastSc = ev.sc;
    });
    return res;
  }

  // kompaktes Format für stats.json
  function compactReport(r) {
    const P = p => [p.nr, p.name, p.goals, p.s7a, p.s7g, p.warn ? 1 : 0, p.two, p.disq ? 1 : 0];
    const T = { t: 0, '7': 1, x: 2, '2': 3, v: 4, d: 5, a: 6 };
    return {
      res: r.result, ht: r.half, spec: r.spectators, refs: r.refs,
      ph: r.players.h.map(P), pg: r.players.g.map(P),
      oh: r.officials.h.map(o => [o.r, o.name, o.warn ? 1 : 0, o.two, o.disq ? 1 : 0]), og: r.officials.g.map(o => [o.r, o.name, o.warn ? 1 : 0, o.two, o.disq ? 1 : 0]),
      ev: r.events.map(e => [e.t, T[e.type], e.side === 'h' ? 0 : e.side === 'g' ? 1 : -1, e.nr ?? 0])
    };
  }

  const api = { pdfLines, parseReport, compactReport };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.H4AReport = api;
})(typeof self !== 'undefined' ? self : this);

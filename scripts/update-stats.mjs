// Liest für alle Ligen aus config.json die Spielberichte von handball4all
// und schreibt data/stats.json (Torschützen, 7m, Strafen, Spielverlauf).
// Aufruf: node scripts/update-stats.mjs
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('./report-parser.js');
const API = 'https://spo.handball4all.de/service/if_g_json.php';
const REP = 'https://spo.handball4all.de/misc/sboPublicReports.php?sGID=';
const OUT = 'data/stats.json';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (handball-team-app; github actions)', 'Accept': '*/*' };

const inflate = async u => new Uint8Array(zlib.inflateSync(Buffer.from(u)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, type = 'json', tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return type === 'json' ? await r.json() : new Uint8Array(await r.arrayBuffer());
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}
const parseDate = d => { const m = /(\d+)\.(\d+)\.(\d+)/.exec(d || ''); return m ? new Date(2000 + +m[3], m[2] - 1, +m[1]) : null; };

const cfg = JSON.parse(await fs.readFile('config.json', 'utf8'));
let prev = { leagues: {} };
try { prev = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch {}

const out = { updated: Date.now(), leagues: {} };
let fetched = 0, reused = 0, failed = 0;

for (const lg of cfg.leagues) {
  const key = `${lg.og}-${lg.lId}`;
  const url = ct => `${API}?ca=0&cl=${lg.lId}&cmd=ps&og=${lg.og}${ct ? '&ct=' + ct : ''}`;
  const old = (prev.leagues[key] && prev.leagues[key].reports) || {};
  const reports = {};
  let base;
  try { base = (await get(url()))[0]; } catch (e) { console.error(`Liga ${key}: ${e.message}`); if (prev.leagues[key]) out.leagues[key] = prev.leagues[key]; continue; }
  const games = {};
  for (const t of base.content.teamsList || []) {
    try {
      const j = (await get(url(t.teamID)))[0];
      const list = Array.isArray(j.content.futureGames) ? j.content.futureGames : (j.content.futureGames?.games || []);
      for (const g of list) if (g.sGID && String(g.sGID) !== '0') games[g.gID] = { sgid: String(g.sGID), date: parseDate(g.gDate) };
    } catch (e) { console.error(`Team ${t.teamID}: ${e.message}`); }
  }
  const recent = Date.now() - 7 * 864e5;
  for (const [gid, g] of Object.entries(games)) {
    const o = old[gid];
    if (o && o.sgid === g.sgid && g.date && g.date.getTime() < recent) { reports[gid] = o; reused++; continue; }
    try {
      const bytes = await get(REP + g.sgid, 'bin');
      const r = await P.parseReport(bytes, inflate);
      reports[gid] = { ...P.compactReport(r), sgid: g.sgid };
      fetched++;
      await sleep(300);
    } catch (e) {
      failed++; console.error(`Bericht ${gid}/${g.sgid}: ${e.message}`);
      if (o) reports[gid] = o;
    }
  }
  out.leagues[key] = { name: (base.head.name || '').trim(), reports };
  console.log(`${key} ${out.leagues[key].name}: ${Object.keys(reports).length} Berichte`);
}

// nur schreiben, wenn sich inhaltlich etwas geändert hat
const strip = o => JSON.stringify(o.leagues);
if (strip(out) !== strip(prev)) {
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out));
  console.log(`geschrieben: ${fetched} neu, ${reused} übernommen, ${failed} Fehler`);
} else console.log(`unverändert (${fetched} geprüft, ${reused} übernommen)`);

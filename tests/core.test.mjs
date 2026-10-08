import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(process.argv[2] ?? new URL('../index.html', import.meta.url), 'utf8');
const m = html.match(/\/\* CORE-START \*\/([\s\S]*?)\/\* CORE-END \*\//);
if (!m) throw new Error('core block not found');
const C = new Function(m[1] + '; return BlendCore;')();

const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a}`);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('doc example: empty tank, E30 + E75 -> E40, 10 gal', () => {
  const p = C.planFill({ vr: 0, er: 0, add: 10, el: 30, eh: 75, et: 40 });
  assert.equal(p.status, 'ok');
  near(p.vh, 10 * 10 / 45, 1e-12, 'vh');
  near(p.vl, 10 - 10 * 10 / 45, 1e-12, 'vl');
  near(p.vl / p.vh, 3.5, 1e-12, 'ratio');
  near(p.ef, 40, 1e-12, 'ef');
});

t('residual 3 gal E38 + fill 12 gal with E10/E85 -> E40', () => {
  const p = C.planFill({ vr: 3, er: 38, add: 12, el: 10, eh: 85, et: 40 });
  assert.equal(p.status, 'ok');
  near(p.vh, 4.88, 1e-12); near(p.vl, 7.12, 1e-12); near(p.ef, 40, 1e-12);
});

t('residual too rich -> all low fuel, report min add', () => {
  const p = C.planFill({ vr: 10, er: 80, add: 5, el: 10, eh: 85, et: 40 });
  assert.equal(p.status, 'rich');
  assert.equal(p.vh, 0); near(p.vl, 5);
  near(p.ef, (800 + 50) / 15, 1e-12);
  near(p.minAdd, 10 * 40 / 30, 1e-12);
});

t('too lean even with all high fuel -> all high, report min add', () => {
  const p = C.planFill({ vr: 10, er: 10, add: 5, el: 10, eh: 85, et: 40 });
  assert.equal(p.status, 'lean');
  near(p.vh, 5); assert.equal(p.vl, 0);
  near(p.ef, 35, 1e-12);
  near(p.minAdd, 10 * 30 / 45, 1e-12);
});

t('high fuel at or below target can never reach it', () => {
  const p = C.planFill({ vr: 0, er: 0, add: 10, el: 10, eh: 40, et: 45 });
  assert.equal(p.status, 'lean');
  assert.equal(p.minAdd, Infinity);
});

t('no room in tank', () => {
  const p = C.planFill({ vr: 15, er: 38, add: 0, el: 10, eh: 85, et: 40 });
  assert.equal(p.status, 'noroom'); assert.equal(p.ef, 38);
});

t('second fuel: pumped 8 gal E10 onto 3 gal E38 -> E85 needed', () => {
  const s = C.solveSecond({ vr: 3, er: 38, e1: 10, v1: 8, e2: 85, et: 40 });
  assert.equal(s.status, 'ok');
  near(s.v2, (440 - 194) / 45, 1e-12); near(s.ef, 40, 1e-12);
});

t('second fuel: pumped E85 first -> E10 needed', () => {
  const s = C.solveSecond({ vr: 3, er: 38, e1: 85, v1: 4, e2: 10, et: 40 });
  assert.equal(s.status, 'ok');
  near(s.v2, (114 + 340 - 280) / 30, 1e-12); near(s.ef, 40, 1e-12);
});

t('second fuel in the wrong direction is rejected', () => {
  const s = C.solveSecond({ vr: 3, er: 38, e1: 85, v1: 4, e2: 85, et: 40 });
  assert.equal(s.status, 'wrongdir');
});

t('cheapest: E10+E85 beats E30+E85 at these prices', () => {
  const fuels = [
    { key: 'E10', e: 10, price: 3.0 }, { key: 'E30', e: 30, price: 3.4 }, { key: 'HIGH', e: 85, price: 2.8 },
  ];
  const opts = C.cheapest({ vr: 0, er: 0, add: 15, et: 40, fuels });
  assert.equal(opts[0].id, 'E10+HIGH');
  near(opts[0].cost, 9 * 3.0 + 6 * 2.8, 1e-9);
  assert.equal(opts.length, 2); // E10+E30 cannot reach E40
});

t('quick table E10 -> E40: step, exact optimum at E85 1.50:1, raw-value optimal', () => {
  const cols = []; for (let c = 85; c >= 60; c--) cols.push(c);
  const T = C.quickTable({ el: 10, et: 40, cols });
  assert.equal(T.kind, 'ok');
  assert.equal(T.step, 0.02);
  const j85 = cols.indexOf(85), j60 = cols.indexOf(60), j70 = cols.indexOf(70);
  assert.equal(T.rows[T.colOpt[j85]], 1.5);
  near(T.cells[T.colOpt[j85]][j85], 40, 1e-12);
  assert.equal(T.rows[T.colOpt[j60]], 0.66);
  const i1 = T.rows.indexOf(1);
  assert.equal(T.rowOpt[i1], j70);
  // every optimum meets the target on raw values; nothing below target is marked
  T.rows.forEach((r, i) => T.cols.forEach((c, j) => {
    assert.equal(T.meets[i][j], T.cells[i][j] >= 40 - 1e-9);
  }));
  T.colOpt.forEach((i, j) => {
    if (i < 0) return;
    assert.ok(T.cells[i][j] >= 40 - 1e-9);
    if (i + 1 < T.rows.length) assert.ok(T.cells[i + 1][j] < 40 - 1e-9, 'next row must be below target');
  });
  T.rowOpt.forEach((j, i) => {
    if (j < 0) return;
    if (j + 1 < T.cols.length) assert.ok(T.cells[i][j + 1] < 40 - 1e-9, 'next (lower) column must be below target');
  });
  // first and last rows leave a margin around the feasible band
  assert.ok(T.rows[0] < 20 / 30 && T.rows.at(-1) > 1.5);
});

t('quick table step choice for each base fuel', () => {
  const cols = []; for (let c = 85; c >= 60; c--) cols.push(c);
  const steps = Object.fromEntries([0, 10, 15, 30].map((el) => [el, C.quickTable({ el, et: 40, cols })]));
  assert.equal(steps[0].step, 0.02); assert.equal(steps[10].step, 0.02);
  assert.equal(steps[15].step, 0.02); assert.equal(steps[30].step, 0.1);
  for (const T of Object.values(steps)) assert.ok(T.rows.length <= 60, 'row cap');
  assert.equal(C.quickTable({ el: 40, et: 40, cols }).kind, 'baseAbove');
  assert.equal(C.quickTable({ el: 10, et: 90, cols }).kind, 'noHigh');
});

// ---- randomized properties ----
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a, b) => a + (b - a) * rnd();

t('planFill: ok plans hit target exactly and are non-negative (20k random)', () => {
  for (let k = 0; k < 20000; k++) {
    const cap = pick(5, 30), vr = pick(0, cap), er = pick(0, 90), add = pick(0.01, cap - vr + 0.01);
    const el = pick(0, 35), eh = pick(el + 1, 100), et = pick(1, 99);
    const p = C.planFill({ vr, er, add, el, eh, et });
    assert.ok(p.vh >= 0 && p.vl >= -1e-12);
    near(p.vh + p.vl, add, 1e-9);
    if (p.status === 'ok') near(p.ef, et, 1e-9, 'ok plan ef');
    if (p.status === 'rich') assert.ok(p.ef > et);
    if (p.status === 'lean') assert.ok(p.ef < et);
  }
});

t('solveSecond: ok results hit target exactly (20k random)', () => {
  for (let k = 0; k < 20000; k++) {
    const vr = pick(0, 10), er = pick(0, 90), v1 = pick(0.1, 10), e1 = pick(0, 100), e2 = pick(0, 100), et = pick(1, 99);
    const s = C.solveSecond({ vr, er, e1, v1, e2, et });
    if (s.status === 'ok') { assert.ok(s.v2 >= 0); near(s.ef, et, 1e-9); }
    if (s.status === 'wrongdir') assert.ok((s.ec - et) * (e2 - et) > 0, 'fuel 2 on the same side as current mix');
  }
});

t('cheapest: no three-fuel mix beats the best pair (2k random)', () => {
  for (let k = 0; k < 2000; k++) {
    const fuels = [0, 10, 15, 30, pick(60, 85)].map((e, i) => ({ key: 'F' + i, e, price: pick(2, 5) }));
    const vr = pick(0, 5), er = pick(0, 60), add = pick(3, 15), et = pick(15, 60);
    const opts = C.cheapest({ vr, er, add, et, fuels });
    const need = et * (vr + add) - er * vr;
    for (const o of opts) {
      near(o.parts.reduce((s, p) => s + p.v, 0), add, 1e-9);
      near(o.parts.reduce((s, p) => s + p.fuel.e * p.v, 0), need, 1e-6);
    }
    const best = opts.length ? opts[0].cost : Infinity;
    // sample feasible 3-fuel mixes: x+y+z=add, ea x+eb y+ec z=need, z=t
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) {
      const [A, B, Cc] = [fuels[a], fuels[b], fuels[c]];
      for (let s = 0; s <= 20; s++) {
        const z = add * s / 20;
        const rest = add - z, restN = need - Cc.e * z;
        const y = (restN - A.e * rest) / (B.e - A.e), x = rest - y;
        if (x < -1e-9 || y < -1e-9) continue;
        const cost = A.price * x + B.price * y + Cc.price * z;
        assert.ok(cost >= best - 1e-6, `3-fuel mix ${cost} beat best pair ${best}`);
      }
    }
  }
});

console.log(`\n${n} checks passed`);

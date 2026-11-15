import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { computeAnalogueFidelity } from './analogueFidelity';
import { computeSampleFingerprint, sha256Hex } from './fingerprint';
import { parseCompositionList, parseCsv, parseUserInjectedData } from './spectralEngine';

// ---------------------------------------------------------------- fingerprint

test('sha256Hex matches Node crypto for assorted inputs', () => {
  const inputs = ['', 'abc', 'African Analogs — Dallol ✓', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(1000)];
  for (const input of inputs) {
    assert.equal(sha256Hex(input), createHash('sha256').update(input, 'utf8').digest('hex'), `input length ${input.length}`);
  }
});

test('sample fingerprint is stable under key order and changes with the data', () => {
  const a = computeSampleFingerprint({ name: 'A', minerals: { Gesso: 20, Halita: 30 }, pH: 3 });
  const b = computeSampleFingerprint({ pH: 3, minerals: { Halita: 30, Gesso: 20 }, name: 'A' });
  const c = computeSampleFingerprint({ name: 'A', minerals: { Gesso: 20, Halita: 31 }, pH: 3 });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

// ---------------------------------------------------------------- AFI

test('an empty sample scores 0, not a high default', () => {
  const r = computeAnalogueFidelity({}, 'Mars');
  assert.equal(r.total, 0);
  assert.equal(r.coverage, 0);
});

test('a Mars-like evaporite scores far above a wet, unrelated sample', () => {
  const marsLike = computeAnalogueFidelity(
    { minerals: { Jarosita: 30, Gesso: 25, Hematita: 20, Perclorato: 10, Esmectita: 15 }, waterActivity: 0.3, pH: 3 },
    'Mars'
  );
  const unrelated = computeAnalogueFidelity({ minerals: { Gelo: 80, Turfa: 20 }, waterActivity: 0.99, pH: 7 }, 'Mars');
  assert.ok(marsLike.total >= 90, `mars-like total ${marsLike.total}`);
  assert.ok(unrelated.total < 40, `unrelated total ${unrelated.total}`);
});

test('unmeasured placeholders do not count towards the score', () => {
  const measured = computeAnalogueFidelity({ minerals: { Gesso: 50 }, waterActivity: 0.3, pH: 4 }, 'Mars');
  const placeholders = computeAnalogueFidelity(
    { minerals: { Gesso: 50 }, waterActivity: 0.3, pH: 4, unmeasured: ['waterActivity', 'pH'] },
    'Mars'
  );
  assert.ok(placeholders.total < measured.total);
  assert.ok(placeholders.coverage < 1);
});

test('gas giants have no mineral analogue', () => {
  const r = computeAnalogueFidelity({ minerals: { Basalto: 100 }, waterActivity: 0.1, pH: 7 }, 'Jupiter');
  assert.equal(r.total, 0);
});

test('site axes come from the reference site and do not change the sample total', () => {
  const sample = { minerals: { Trona: 40, Calcita: 20 }, waterActivity: 0.95, pH: 10.5 };
  const site = { name: 'Natron', radarAxes: { mineralogy: 1, geomorphology: 77, geochemistry: 1, radiation: 66, thermal: 55 } };
  const withSite = computeAnalogueFidelity(sample, 'Enceladus', site);
  const withoutSite = computeAnalogueFidelity(sample, 'Enceladus');
  assert.equal(withSite.total, withoutSite.total);
  assert.equal(withSite.geomorphology, 77);
  assert.equal(withSite.thermal, 55);
});

// ---------------------------------------------------------------- CSV / JSON import

test('parseCsv handles quotes, escaped quotes, commas and newlines inside fields', () => {
  const rows = parseCsv('a,b,c\n"x, y","he said ""hi""","line1\nline2"\n');
  assert.deepEqual(rows, [
    ['a', 'b', 'c'],
    ['x, y', 'he said "hi"', 'line1\nline2'],
  ]);
});

test('parseCompositionList reads "Mineral: %" lists', () => {
  assert.deepEqual(parseCompositionList('Hematita: 30; Gesso=20 | Halita: 12,5%'), { Hematita: 30, Gesso: 20, Halita: 12.5 });
});

test('CSV import keeps the file minerals/oxides and invents nothing', () => {
  const csv = [
    'name,lat,lng,aw,ph,target,minerals,SiO2,Fe2O3',
    '"Crosta, Dallol",14.24,40.30,0.28,3.2,Mars,"Jarosita: 30; Halita: 25",42.1,18.3',
    'Sem dados,,,,,,,,',
  ].join('\n');
  const [full, empty] = parseUserInjectedData(csv, 'amostras.csv');

  assert.equal(full.name, 'Crosta, Dallol');
  assert.deepEqual(full.coordinates, [14.24, 40.3]);
  assert.deepEqual(full.minerals, { Jarosita: 30, Halita: 25 });
  assert.deepEqual(full.xrfComposition, { SiO2: 42.1, Fe2O3: 18.3 });
  assert.equal(full.waterActivity, 0.28);
  assert.ok(!full.unmeasured.includes('minerals'));

  assert.equal(empty.coordinates, undefined);
  assert.equal(empty.waterActivity, undefined);
  assert.deepEqual(empty.minerals, {});
  for (const field of ['coordinates', 'waterActivity', 'pH', 'minerals', 'xrfComposition'] as const) {
    assert.ok(empty.unmeasured.includes(field), `${field} should be unmeasured`);
  }
});

test('semicolon-separated CSV (Excel in PT locales) is detected', () => {
  const [row] = parseUserInjectedData('nome;aw;ph\nAmostra;0,4;8,1', 'excel.csv');
  assert.equal(row.name, 'Amostra');
  assert.equal(row.waterActivity, 0.4);
  assert.equal(row.pH, 8.1);
});

test('JSON import accepts minerals objects and coordinates arrays', () => {
  const [row] = parseUserInjectedData(
    JSON.stringify([{ name: 'J', coordinates: [1, 2], minerals: { Gesso: 10 }, pH: 6 }]),
    'dados.json'
  );
  assert.deepEqual(row.coordinates, [1, 2]);
  assert.deepEqual(row.minerals, { Gesso: 10 });
  assert.ok(!row.unmeasured.includes('coordinates'));
  assert.ok(row.unmeasured.includes('waterActivity'));
});

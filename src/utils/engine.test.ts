import test from 'node:test';
import assert from 'node:assert/strict';
import { rollInput } from './engine.ts';

test('Seção 8: Rolagens determinísticas sem dado e precedência matemática', () => {
  assert.equal(rollInput('5+3')[0].results[0].t, 8);
  assert.equal(rollInput('5+3')[0].results[0].d, '5 + 3');

  assert.equal(rollInput('(2+3)*2')[0].results[0].t, 10);
  assert.equal(rollInput('(2+3)*2')[0].results[0].d, '(2 + 3) * 2');

  assert.equal(rollInput('-2+5')[0].results[0].t, 3);
  assert.equal(rollInput('10/4')[0].results[0].t, 2.5);

  const rep = rollInput('4#5+10');
  assert.equal(rep.length, 1);
  assert.equal(rep[0].results.length, 4);
  for (const r of rep[0].results) {
    assert.equal(r.t, 15);
  }
});

test('Seção 8: Repetições N#, labels, operadores soltos no label, prefixos e colchetes', () => {
  const atk = rollInput('4#1d20+10 ataque');
  assert.equal(atk.length, 1);
  assert.equal(atk[0].label, 'ataque');
  assert.equal(atk[0].formula, '1d20+10');
  assert.equal(atk[0].results.length, 4);
  for (const r of atk[0].results) {
    assert.ok(r.t >= 11 && r.t <= 30, `Esperado entre 11 e 30, veio ${r.t}`);
  }

  const dashLabel = rollInput('1d20 - espada');
  assert.equal(dashLabel[0].label, '- espada');
  assert.equal(dashLabel[0].formula, '1d20');

  const pref = rollInput('/r 2d8+4');
  assert.equal(pref[0].formula, '2d8+4');

  const multi = rollInput('ataco [d20+5 espada] e causo [2d6 fogo]');
  assert.equal(multi.length, 2);
  assert.equal(multi[0].label, 'espada');
  assert.equal(multi[0].formula, 'd20+5');
  assert.equal(multi[1].label, 'fogo');
  assert.equal(multi[1].formula, '2d6');
});

test('Seção 8: Erros em português e limites', () => {
  assert.throws(() => rollInput('101d6'), /máximo de 100 dados por rolagem/);
  assert.throws(() => rollInput('1d1'), /o dado precisa ter 2 ou mais lados/);
  assert.throws(() => rollInput('10/0'), /divisão por zero/);
  assert.throws(() => rollInput('(2+3'), /falta fechar \)/);
  assert.throws(() => rollInput('   '), /digite uma rolagem/);
});

test('Seção 8: Vantagem, Desvantagem, Keep/Drop e Fudge', () => {
  const adv = rollInput('1d20+5', 'adv')[0];
  assert.ok(adv.formula.endsWith('(vantagem)'));
  assert.match(adv.results[0].d, /~\d+~/);

  const dis = rollInput('1d20+5', 'dis')[0];
  assert.ok(dis.formula.endsWith('(desvantagem)'));
  assert.match(dis.results[0].d, /~\d+~/);

  const kh = rollInput('2d20kh1+5', 'adv')[0];
  assert.ok(!kh.formula.endsWith('(vantagem)'));
  assert.equal(kh.formula, '2d20kh1+5');

  const dl = rollInput('4d6dl1')[0];
  const detailMatch = /^\[([^\]]+)\]$/.exec(dl.results[0].d);
  assert.ok(detailMatch);
  const parts = detailMatch[1].split(',').map((s) => s.trim());
  assert.equal(parts.length, 4);
  const dropped = parts.filter((p) => p.startsWith('~') && p.endsWith('~'));
  const kept = parts.filter((p) => !p.startsWith('~'));
  assert.equal(dropped.length, 1);
  assert.equal(kept.length, 3);
  const droppedVal = Number(dropped[0].slice(1, -1));
  const keptVals = kept.map(Number);
  assert.ok(keptVals.every((v) => v >= droppedVal));
  assert.equal(
    dl.results[0].t,
    keptVals.reduce((a, b) => a + b, 0)
  );

  const fudge = rollInput('4dF')[0];
  assert.ok(fudge.results[0].t >= -4 && fudge.results[0].t <= 4);
});

test('Seção 8: Monte Carlo 2000 rolagens de 1d20 com vantagem e desvantagem', () => {
  let sumAdv = 0;
  let sumDis = 0;
  const N = 2000;

  for (let i = 0; i < N; i++) {
    const rAdv = rollInput('1d20', 'adv')[0].results[0];
    const numsAdv = [...rAdv.d.matchAll(/\d+/g)].map((m) => Number(m[0]));
    assert.equal(numsAdv.length, 2);
    assert.equal(rAdv.t, Math.max(numsAdv[0], numsAdv[1]));
    sumAdv += rAdv.t;

    const rDis = rollInput('1d20', 'dis')[0].results[0];
    const numsDis = [...rDis.d.matchAll(/\d+/g)].map((m) => Number(m[0]));
    assert.equal(numsDis.length, 2);
    assert.equal(rDis.t, Math.min(numsDis[0], numsDis[1]));
    sumDis += rDis.t;
  }

  const avgAdv = sumAdv / N;
  const avgDis = sumDis / N;
  assert.ok(avgAdv > 12.8 && avgAdv < 14.8, `Média adv inesperada: ${avgAdv}`);
  assert.ok(avgDis > 6.2 && avgDis < 8.2, `Média dis inesperada: ${avgDis}`);
});

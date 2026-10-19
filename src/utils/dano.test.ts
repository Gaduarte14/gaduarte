import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEffect, rollEffects, applyEffect, runLine } from './dano.ts';

test('Seção 9: Entradas determinísticas de dano, resistência, cura e vida temporária', () => {
  assert.equal(parseEffect('10 ash').final, 10);
  assert.equal(parseEffect('10 ash').kind, 'dano');

  assert.equal(parseEffect('10 ash R').final, 5);
  assert.equal(parseEffect('7 ash R').final, 3);

  const partialR = parseEffect('10+6 ash R 6');
  assert.equal(partialR.bruto, 16);
  assert.equal(partialR.final, 13);

  const multi = rollEffects('[5 ash] [8 thorin R]');
  assert.equal(multi.length, 2);
  assert.equal(multi[0].final, 5);
  assert.equal(multi[1].final, 4);

  const cu = parseEffect('6 cu ash');
  assert.equal(cu.kind, 'cura');
  assert.equal(cu.final, 6);

  const negCu = parseEffect('-3 cu ash');
  assert.equal(negCu.kind, 'cura');
  assert.equal(negCu.final, 0);

  const vdt = parseEffect('6 vdt ash');
  assert.equal(vdt.kind, 'vdt');
  assert.equal(vdt.final, 6);

  const curaName = parseEffect('6 cura ash');
  assert.equal(curaName.kind, 'dano');
  assert.equal(curaName.nome, 'cura ash');

  for (let i = 0; i < 500; i++) {
    const r = parseEffect('1d8+6 cu Ash');
    assert.equal(r.kind, 'cura');
    assert.equal(r.nome, 'ash');
    assert.ok(r.final >= 7 && r.final <= 14);
  }
});

test('Seção 9: Erros em português', () => {
  assert.throws(() => parseEffect('5'), /Faltou o nome do personagem/);
  assert.throws(
    () => parseEffect('5 cu'),
    /Faltou o nome do personagem\. Ex\.: 1d8\+6 cu ash/
  );
  assert.throws(
    () => parseEffect('4#5 ash'),
    /Repetição com # não funciona aqui/
  );
  assert.throws(
    () => parseEffect('5 ash R 9'),
    /Resistência: não achei "9" na fórmula\./
  );
  assert.throws(
    () => runLine('5 thorin', [{ name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 }]),
    /Não achei a ficha de "thorin"\./
  );
});

test('Seção 9: Aplicação na ficha (PV, PV máximo, PV temporário)', () => {
  // dano 4 -> PV 6
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 };
    applyEffect(s, parseEffect('4 ash'));
    assert.equal(s.pv, 6);
  }
  // dano 15 -> PV 0
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 };
    applyEffect(s, parseEffect('15 ash'));
    assert.equal(s.pv, 0);
  }
  // dano 5 com PV temporário 3 -> PV temporário 0, PV 8
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 3 };
    applyEffect(s, parseEffect('5 ash'));
    assert.equal(s.pvTemp, 0);
    assert.equal(s.pv, 8);
  }
  // dano 5 com PV temporário 9 -> PV temporário 4, PV 10
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 9 };
    applyEffect(s, parseEffect('5 ash'));
    assert.equal(s.pvTemp, 4);
    assert.equal(s.pv, 10);
  }
  // cura 3 -> PV 13
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 };
    applyEffect(s, parseEffect('3 cu ash'));
    assert.equal(s.pv, 13);
  }
  // cura 15 -> PV 20 (5 perdidos)
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 };
    const rep = applyEffect(s, parseEffect('15 cu ash'));
    assert.equal(s.pv, 20);
    assert.equal(rep.perdido, 5);
  }
  // cura 5 com PV 25 e máximo 20 -> PV continua 25
  {
    const s = { name: 'Ash', pv: 25, pvMax: 20, pvTemp: 0 };
    applyEffect(s, parseEffect('5 cu ash'));
    assert.equal(s.pv, 25);
  }
  // vida temporária 8 com PV temporário 3 -> PV temporário 11
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 3 };
    applyEffect(s, parseEffect('8 vdt ash'));
    assert.equal(s.pvTemp, 11);
  }
  // vida temporária 50 -> PV temporário 50, PV não muda
  {
    const s = { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 };
    applyEffect(s, parseEffect('50 vdt ash'));
    assert.equal(s.pvTemp, 50);
    assert.equal(s.pv, 10);
  }
});

test('Seção 9: Linha inteira e Tudo ou Nada (atomicidade)', () => {
  const sheets = [
    { name: 'Ash', pv: 10, pvMax: 20, pvTemp: 0 },
    { name: 'Thorin', pv: 30, pvMax: 30, pvTemp: 0 },
  ];

  runLine('[5 ash] [6 cu ash] [4 vdt thorin] [10 thorin R]', sheets);
  assert.equal(sheets[0].pv, 11);
  assert.equal(sheets[1].pv, 29);
  assert.equal(sheets[1].pvTemp, 0);

  // Tudo ou nada: [5 ash] [5 fantasma] não pode mudar o PV do Ash
  assert.throws(() => runLine('[5 ash] [5 fantasma]', sheets), /Não achei a ficha de "fantasma"\./);
  assert.equal(sheets[0].pv, 11);
});

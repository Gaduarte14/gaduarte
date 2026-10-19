// Dano, cura e vida temporária. Depende só de rollInput (engine.ts).
// Não mexe em DOM, rede nem storage: recebe texto e fichas, devolve resultados.
import { rollInput } from './engine.ts';

export interface DamageTerm {
  sign: '+' | '-';
  body: string;
  v: number;
  d: string;
  res: boolean;
}

export interface ParsedDamageEffect {
  kind: 'dano' | 'cura' | 'vdt';
  nome: string;
  alvo: string;
  formula: string;
  terms: DamageTerm[];
  d?: string;
  hasR: boolean;
  bruto: number;
  resSum?: number;
  halved?: number;
  final: number;
}

export interface SheetHpAdapter {
  id?: string;
  name: string;
  pv: number;
  pvMax: number;
  pvTemp: number;
}

export interface EffectApplicationReport {
  kind: 'dano' | 'cura' | 'vdt';
  alvo: string;
  final: number;
  antes: { pv: number; temp: number };
  depois: { pv: number; temp: number };
  absorvido: number;
  perdido: number;
}

export interface DamageHistoryEntry {
  id: string;
  ts: number;
  items: Array<{
    effect: ParsedDamageEffect;
    report: EffectApplicationReport;
    targetDisplayName: string;
  }>;
}

// Nome sem acento, minúsculo, espaços colapsados. É assim que o nome digitado é comparado com o da ficha.
export const norm = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const key = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

// Divide a fórmula em termos de soma/subtração fora de parênteses: "1d10+15-2d4" → 3 termos.
function splitTop(f: string): Array<{ sign: '+' | '-'; body: string }> {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of f) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === '+' || ch === '-') && depth === 0 && cur.trim() && !/[*/]\s*$/.test(cur)) {
      out.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => {
    const trimmed = s.trim();
    return {
      sign: trimmed[0] === '-' ? '-' : '+',
      body: trimmed.replace(/^[+-]\s*/, '').trim(),
    };
  });
}

// Rola UM trecho ("1d10+15 ash R 2d6", "1d8+6 cu thorin", "2d6 vdt ash") e devolve o efeito.
// kind: "dano" | "cura" | "vdt". final: número inteiro ou decimal >= 0 que vai para a ficha.
export function parseEffect(seg: string): ParsedDamageEffect {
  if (/^\s*\d{1,2}#/.test(seg)) {
    throw new Error('Repetição com # não funciona aqui. Role uma de cada vez.');
  }
  const first = rollInput(seg)[0];

  // Cura (cu) e vida temporária (vdt): a palavra tem que ser a primeira do label.
  const km = /^(cu|vdt)(?:\s+(.*))?$/i.exec(first.label.trim());
  if (km) {
    const alvo = (km[2] || '').trim();
    if (!alvo) throw new Error('Faltou o nome do personagem. Ex.: 1d8+6 cu ash');
    const r = first.results[0];
    return {
      kind: km[1].toLowerCase() === 'cu' ? 'cura' : 'vdt',
      nome: norm(alvo),
      alvo,
      formula: first.formula,
      terms: [],
      d: r.d,
      hasR: false,
      bruto: r.t,
      final: Math.max(0, r.t),
    };
  }

  // Dano: "nome", "nome R" (tudo resistido) ou "nome R trecho" (só o trecho resistido).
  let nome = first.label;
  let hasR = false;
  let spec = '';
  const rm = /^(.*?)\s+r(?:\s+(.*))?$/i.exec(first.label);
  if (rm) {
    nome = rm[1];
    hasR = true;
    spec = rm[2] || '';
  }
  nome = nome.trim();
  if (!nome) throw new Error('Faltou o nome do personagem. Ex.: 1d10+15 ash');

  const rkeys = new Set<string>();
  if (hasR && spec.trim()) {
    for (const tok of spec.split(/[\s,;]+/).filter(Boolean)) {
      for (const t of splitTop(tok)) rkeys.add(key(t.body));
    }
  }

  // Cada termo é rolado separado (os dados do rollInput acima só serviram para separar fórmula e label).
  const terms: DamageTerm[] = splitTop(first.formula).map((t) => {
    const r = rollInput(t.body)[0].results[0];
    return {
      sign: t.sign,
      body: t.body,
      v: t.sign === '-' ? -r.t : r.t,
      d: r.d,
      res: hasR && (!rkeys.size || rkeys.has(key(t.body))),
    };
  });

  if (rkeys.size && !terms.some((t) => t.res)) {
    throw new Error('Resistência: não achei "' + spec.trim() + '" na fórmula.');
  }

  let normal = 0;
  let resSum = 0;
  terms.forEach((t) => {
    if (t.res) resSum += t.v;
    else normal += t.v;
  });
  const halved = resSum > 0 ? Math.floor(resSum / 2) : resSum;

  return {
    kind: 'dano',
    nome: norm(nome),
    alvo: nome,
    formula: first.formula,
    terms,
    hasR,
    bruto: normal + resSum,
    resSum,
    halved,
    final: Math.max(0, normal + halved),
  };
}

// "ataco [2d6 ash] [1d8+3 thorin R] [1d8+6 cu ash]" → lista de efeitos (máx. 10). Se algum trecho der erro, nada é aplicado.
export function rollEffects(raw: string): ParsedDamageEffect[] {
  const segs = [...raw.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return (segs.length ? segs.slice(0, 10) : [raw]).map(parseEffect);
}

export function findSheet<T extends SheetHpAdapter>(sheets: T[], eff: ParsedDamageEffect): T {
  let hits = sheets.filter((s) => norm(s.name) === eff.nome);
  if (!hits.length) {
    hits = sheets.filter((s) => norm(s.name).split(' ')[0] === eff.nome);
  }
  if (!hits.length) throw new Error('Não achei a ficha de "' + eff.alvo + '".');
  if (hits.length > 1) throw new Error('Mais de uma ficha com o nome "' + eff.alvo + '".');
  return hits[0];
}

// Aplica UM efeito numa ficha { pv, pvMax, pvTemp } (muda a ficha) e devolve o relatório.
export function applyEffect(
  sheet: SheetHpAdapter,
  eff: ParsedDamageEffect
): EffectApplicationReport {
  const antes = { pv: sheet.pv, temp: sheet.pvTemp };
  let absorvido = 0;
  let perdido = 0;
  if (eff.kind === 'dano') {
    absorvido = Math.min(sheet.pvTemp, eff.final); // a vida temporária é gasta primeiro
    sheet.pvTemp -= absorvido;
    sheet.pv = Math.max(0, sheet.pv - (eff.final - absorvido)); // o PV da ficha para em 0
  } else if (eff.kind === 'cura') {
    const novo = Math.max(sheet.pv, Math.min(sheet.pvMax, sheet.pv + eff.final)); // nunca passa do máximo
    perdido = sheet.pv + eff.final - novo; // o que sobrou da cura some
    sheet.pv = novo;
  } else {
    sheet.pvTemp += eff.final; // sem limite: soma o resultado completo
  }
  return {
    kind: eff.kind,
    alvo: eff.alvo,
    final: eff.final,
    antes,
    depois: { pv: sheet.pv, temp: sheet.pvTemp },
    absorvido,
    perdido,
  };
}

// Rola tudo, acha todas as fichas e só então aplica (erro em qualquer trecho = nada muda).
export function runLine<T extends SheetHpAdapter>(
  raw: string,
  sheets: T[]
): Array<{ effect: ParsedDamageEffect; report: EffectApplicationReport; target: T }> {
  const t = raw.trim();
  if (!t) throw new Error('digite uma rolagem');
  const effects = rollEffects(t);
  const targets = effects.map((e) => findSheet(sheets, e));
  return effects.map((e, i) => ({
    effect: e,
    report: applyEffect(targets[i], e),
    target: targets[i],
  }));
}

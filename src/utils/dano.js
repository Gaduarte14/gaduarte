// Dano, cura e vida temporária. Depende só de rollInput (engine.js).
// Não mexe em DOM, rede nem storage: recebe texto e fichas, devolve resultados.
import { rollInput } from "./engine.js";

// Nome sem acento, minúsculo, espaços colapsados. É assim que o nome digitado é comparado com o da ficha.
export const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const key = s => s.toLowerCase().replace(/\s+/g, "");

// Divide a fórmula em termos de soma/subtração fora de parênteses: "1d10+15-2d4" → 3 termos.
function splitTop(f) {
  const out = []; let depth = 0, cur = "";
  for (const ch of f) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if ((ch === "+" || ch === "-") && depth === 0 && cur.trim() && !/[*\/]\s*$/.test(cur)) { out.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(s => { s = s.trim(); return { sign: s[0] === "-" ? "-" : "+", body: s.replace(/^[+-]\s*/, "").trim() }; });
}

// Rola UM trecho ("1d10+15 ash R 2d6", "1d8+6 cu thorin", "2d6 vdt ash") e devolve o efeito.
// kind: "dano" | "cura" | "vdt". final: número inteiro ou decimal >= 0 que vai para a ficha.
export function parseEffect(seg) {
  if (/^\s*\d{1,2}#/.test(seg)) throw new Error("Repetição com # não funciona aqui. Role uma de cada vez.");
  const first = rollInput(seg)[0];

  // Cura (cu) e vida temporária (vdt): a palavra tem que ser a primeira do label.
  const km = /^(cu|vdt)(?:\s+(.*))?$/i.exec(first.label.trim());
  if (km) {
    const alvo = (km[2] || "").trim();
    if (!alvo) throw new Error("Faltou o nome do personagem. Ex.: 1d8+6 cu ash");
    const r = first.results[0];
    return { kind: km[1].toLowerCase() === "cu" ? "cura" : "vdt", nome: norm(alvo), alvo, formula: first.formula, terms: [], d: r.d, hasR: false, bruto: r.t, final: Math.max(0, r.t) };
  }

  // Dano: "nome", "nome R" (tudo resistido) ou "nome R trecho" (só o trecho resistido).
  let nome = first.label, hasR = false, spec = "";
  const rm = /^(.*?)\s+r(?:\s+(.*))?$/i.exec(first.label);
  if (rm) { nome = rm[1]; hasR = true; spec = rm[2] || ""; }
  nome = nome.trim();
  if (!nome) throw new Error("Faltou o nome do personagem. Ex.: 1d10+15 ash");
  const rkeys = new Set();
  if (hasR && spec.trim())
    for (const tok of spec.split(/[\s,;]+/).filter(Boolean))
      for (const t of splitTop(tok)) rkeys.add(key(t.body));
  // Cada termo é rolado separado (os dados do rollInput acima só serviram para separar fórmula e label).
  const terms = splitTop(first.formula).map(t => {
    const r = rollInput(t.body)[0].results[0];
    return { sign: t.sign, body: t.body, v: t.sign === "-" ? -r.t : r.t, d: r.d, res: hasR && (!rkeys.size || rkeys.has(key(t.body))) };
  });
  if (rkeys.size && !terms.some(t => t.res)) throw new Error("Resistência: não achei \"" + spec.trim() + "\" na fórmula.");
  let normal = 0, resSum = 0;
  terms.forEach(t => { if (t.res) resSum += t.v; else normal += t.v; });
  const halved = resSum > 0 ? Math.floor(resSum / 2) : resSum;
  return { kind: "dano", nome: norm(nome), alvo: nome, formula: first.formula, terms, hasR, bruto: normal + resSum, resSum, halved, final: Math.max(0, normal + halved) };
}

// "ataco [2d6 ash] [1d8+3 thorin R] [1d8+6 cu ash]" → lista de efeitos (máx. 10). Se algum trecho der erro, nada é aplicado.
export function rollEffects(raw) {
  const segs = [...raw.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
  return (segs.length ? segs.slice(0, 10) : [raw]).map(parseEffect);
}

export function findSheet(sheets, eff) {
  let hits = sheets.filter(s => norm(s.name) === eff.nome);
  if (!hits.length) hits = sheets.filter(s => norm(s.name).split(" ")[0] === eff.nome);
  if (!hits.length) throw new Error("Não achei a ficha de \"" + eff.alvo + "\".");
  if (hits.length > 1) throw new Error("Mais de uma ficha com o nome \"" + eff.alvo + "\".");
  return hits[0];
}

// Aplica UM efeito numa ficha { pv, pvMax, pvTemp } (muda a ficha) e devolve o relatório.
export function applyEffect(sheet, eff) {
  const antes = { pv: sheet.pv, temp: sheet.pvTemp };
  let absorvido = 0, perdido = 0;
  if (eff.kind === "dano") {
    absorvido = Math.min(sheet.pvTemp, eff.final);          // a vida temporária é gasta primeiro
    sheet.pvTemp -= absorvido;
    sheet.pv = Math.max(0, sheet.pv - (eff.final - absorvido)); // o PV da ficha para em 0
  } else if (eff.kind === "cura") {
    const novo = Math.max(sheet.pv, Math.min(sheet.pvMax, sheet.pv + eff.final)); // nunca passa do máximo
    perdido = sheet.pv + eff.final - novo;                  // o que sobrou da cura some
    sheet.pv = novo;
  } else {
    sheet.pvTemp += eff.final;                              // sem limite: soma o resultado completo
  }
  return { kind: eff.kind, alvo: eff.alvo, final: eff.final, antes, depois: { pv: sheet.pv, temp: sheet.pvTemp }, absorvido, perdido };
}

// Rola tudo, acha todas as fichas e só então aplica (erro em qualquer trecho = nada muda).
export function runLine(raw, sheets) {
  const t = raw.trim();
  if (!t) throw new Error("digite uma rolagem");
  const effects = rollEffects(t);
  const targets = effects.map(e => findSheet(sheets, e));
  return effects.map((e, i) => ({ effect: e, report: applyEffect(targets[i], e) }));
}

/**
 * Motor Puro do Sistema de Notas / Ficha em Texto (Estilo Quest Portal)
 * ---------------------------------------------------------------------
 * Totalmente desacoplado de UI e do restante do VTT.
 * - Avaliador matemático seguro (recursive-descent parser, ZERO eval / Function)
 * - Resolução reativa de variáveis e modificadores entre múltiplas notas com detecção de ciclo
 * - Tokenizador / AST de Markdown estilo Discord (incluindo `-# subtexto`, `__sublinhado__`, tabelas, etc.)
 * - Detecção automática de rolagens inline (`1d20-100`, `1d20+ 100`, `2d6 + {mod_for}`) e botões `[rolar: Rótulo | Expressão]`
 */

export interface QuestPortalFolder {
  id: string;
  nome: string;
  criadorId: string;
  criadoEm: number;
}

export interface QuestPortalNote {
  id: string;
  titulo: string;
  conteudo: string;
  atualizadoEm: number;
  pastaId?: string | null;
  criadorId?: string;
}

export interface VariableDefinition {
  nomeOriginal: string;
  chaveNormalizada: string;
  expressaoBruta: string;
  notaId: string;
  notaTitulo: string;
  linha: number;
}

export interface EvaluatedVariable {
  nomeOriginal: string;
  chaveNormalizada: string;
  expressaoBruta: string;
  valor: number | null;
  erro?: string;
  ciclo?: boolean;
  notaId: string;
  notaTitulo: string;
}

export interface RollOriginContext {
  rotulo?: string;
  expressaoOriginal: string;
  expressaoResolvida: string;
  notaId?: string;
  notaTitulo?: string;
  personagemId?: string;
}

export type OnQuestPortalRollCallback = (
  expressaoResolvida: string,
  origem: RollOriginContext
) => void;

/**
 * Normaliza o identificador de uma variável para comparação case-insensitive e sem acentos.
 * Ex.: "Força" -> "forca", "mod_des" -> "mod_des"
 */
export function normalizeVarName(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/**
 * Formata um número calculado exibindo sinal '+' quando solicitado ou para modificadores.
 */
export function formatCalculatedNumber(val: number, forcePlusSign = false): string {
  const rounded = Number.isInteger(val) ? val : Number(val.toFixed(2));
  if (forcePlusSign && rounded >= 0) {
    return `+${rounded}`;
  }
  return String(rounded);
}

// ============================================================================
// 1. AVALIADOR MATEMÁTICO SEGURO (SEM EVAL) + FUNÇÕES DE RPG (mod, floor, etc)
// ============================================================================

type MathToken =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' };

function tokenizeMathExpression(expr: string): MathToken[] {
  const tokens: MathToken[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'comma' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < s.length && /[0-9.]/.test(s[i])) {
        if (s[i] === '.') dotCount++;
        if (dotCount > 1) {
          throw new Error(`Número inválido perto de '${numStr}${s[i]}'`);
        }
        numStr += s[i];
        i++;
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) {
        throw new Error(`Número inválido '${numStr}'`);
      }
      tokens.push({ type: 'number', value: parsed });
      continue;
    }
    // Identificador de variável ou função (aceita letras acentuadas, números e _)
    if (/[\p{L}_]/u.test(ch)) {
      let idStr = '';
      while (i < s.length && /[\p{L}\p{N}_]/u.test(s[i])) {
        idStr += s[i];
        i++;
      }
      tokens.push({ type: 'ident', value: idStr });
      continue;
    }
    // Caso o usuário envolva uma variável em {var} dentro de outra fórmula
    if (ch === '{') {
      const closeIdx = s.indexOf('}', i + 1);
      if (closeIdx === -1) {
        throw new Error("Chave '{' não fechada na expressão");
      }
      const innerIdent = s.slice(i + 1, closeIdx).trim();
      if (!innerIdent) {
        throw new Error('Referência vazia {}');
      }
      tokens.push({ type: 'ident', value: innerIdent });
      i = closeIdx + 1;
      continue;
    }

    throw new Error(`Caractere inesperado '${ch}' na fórmula`);
  }

  return tokens;
}

export class CircularDependencyError extends Error {
  constructor(public readonly cyclePath: string[]) {
    super(`Referência circular detectada: ${cyclePath.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Avalia uma expressão matemática pura usando um resolvedor de variáveis customizado.
 * Funções suportadas:
 * - floor(x) / baixo(x)
 * - ceil(x) / cima(x)
 * - round(x) / arred(x)
 * - abs(x)
 * - min(a, b, ...)
 * - max(a, b, ...)
 * - mod(atributo) -> floor((atributo - 10) / 2)
 */
export function evaluateSafeMathExpression(
  expr: string,
  resolveIdentifier: (identName: string) => number
): number {
  const tokens = tokenizeMathExpression(expr);
  if (tokens.length === 0) {
    throw new Error('Expressão vazia');
  }

  let pos = 0;

  function peek(): MathToken | undefined {
    return tokens[pos];
  }

  function consume(): MathToken {
    const t = tokens[pos];
    if (!t) throw new Error('Fim inesperado da expressão');
    pos++;
    return t;
  }

  // Gramática:
  // Expr -> Term (( '+' | '-' ) Term)*
  // Term -> Factor (( '*' | '/' ) Factor)*
  // Factor -> ('+' | '-') Factor | Primary
  // Primary -> NUMBER | '(' Expr ')' | IDENT '(' Args ')' | IDENT

  function parseExpr(): number {
    let left = parseTerm();
    while (pos < tokens.length) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        consume();
        const right = parseTerm();
        left = t.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (pos < tokens.length) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/')) {
        consume();
        const right = parseFactor();
        if (t.value === '/') {
          if (right === 0) {
            throw new Error('Divisão por zero');
          }
          left = left / right;
        } else {
          left = left * right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parseFactor(): number {
    const t = peek();
    if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
      consume();
      const val = parseFactor();
      return t.value === '-' ? -val : val;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = peek();
    if (!t) {
      throw new Error('Expressão incompleta');
    }

    if (t.type === 'number') {
      consume();
      return t.value;
    }

    if (t.type === 'paren' && t.value === '(') {
      consume(); // '('
      const val = parseExpr();
      const closing = peek();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error("Parêntese ')' esperado");
      }
      consume(); // ')'
      return val;
    }

    if (t.type === 'ident') {
      consume();
      const identName = t.value;
      const next = peek();

      // Chamada de função: ident(arg1, arg2, ...)
      if (next && next.type === 'paren' && next.value === '(') {
        consume(); // '('
        const args: number[] = [];
        const afterOpen = peek();
        if (!afterOpen || !(afterOpen.type === 'paren' && afterOpen.value === ')')) {
          args.push(parseExpr());
          while (peek()?.type === 'comma') {
            consume(); // ','
            args.push(parseExpr());
          }
        }
        const closeFn = peek();
        if (!closeFn || closeFn.type !== 'paren' || closeFn.value !== ')') {
          throw new Error(`Parêntese ')' esperado ao fechar função '${identName}'`);
        }
        consume(); // ')'
        return executeBuiltinMathFunction(identName, args);
      }

      // Variável
      return resolveIdentifier(identName);
    }

    throw new Error('Sintaxe inválida na expressão');
  }

  const result = parseExpr();
  if (pos < tokens.length) {
    throw new Error('Termos extras inesperados na expressão');
  }
  if (!Number.isFinite(result)) {
    throw new Error('Resultado numérico inválido');
  }
  return result;
}

function executeBuiltinMathFunction(rawName: string, args: number[]): number {
  const fn = normalizeVarName(rawName);
  switch (fn) {
    case 'floor':
    case 'baixo':
    case 'int': {
      if (args.length !== 1) throw new Error(`${rawName}() espera 1 argumento`);
      return Math.floor(args[0]);
    }
    case 'ceil':
    case 'cima': {
      if (args.length !== 1) throw new Error(`${rawName}() espera 1 argumento`);
      return Math.ceil(args[0]);
    }
    case 'round':
    case 'arred': {
      if (args.length !== 1) throw new Error(`${rawName}() espera 1 argumento`);
      return Math.round(args[0]);
    }
    case 'abs': {
      if (args.length !== 1) throw new Error(`${rawName}() espera 1 argumento`);
      return Math.abs(args[0]);
    }
    case 'mod': {
      // Atalho de D&D 5e: mod(18) -> floor((18 - 10) / 2) = +4
      if (args.length !== 1) throw new Error(`mod() espera 1 argumento (ex.: mod(destreza))`);
      return Math.floor((args[0] - 10) / 2);
    }
    case 'min': {
      if (args.length < 1) throw new Error(`min() espera pelo menos 1 argumento`);
      return Math.min(...args);
    }
    case 'max': {
      if (args.length < 1) throw new Error(`max() espera pelo menos 1 argumento`);
      return Math.max(...args);
    }
    default:
      throw new Error(`Função desconhecida '${rawName}()'`);
  }
}

// ============================================================================
// 2. EXTRAÇÃO E RESOLUÇÃO REATIVA DE VARIÁVEIS ENTRE TODAS AS NOTAS DA FICHA
// ============================================================================

/**
 * Sintaxe de definição de variável no texto:
 *   [forca = 16]
 *   [mod_for = floor((forca - 10) / 2)]
 *   [ca = 10 + mod_des]
 *
 * Não captura links ou botões `[rolar: ...]` ou `[Botão: ...]` porque exige `=`
 * sem `:` antes do `=`.
 */
const VARIABLE_DEF_REGEX = /\[([^\[\]=:|]+?)\s*=\s*([^\[\]]+?)\]/g;

export function extractVariablesFromNotes(
  notes: QuestPortalNote[]
): Map<string, VariableDefinition> {
  const definitions = new Map<string, VariableDefinition>();

  for (const note of notes) {
    const lines = note.conteudo.split(/\r?\n/);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      // Ignora linhas de bloco de código
      if (line.trim().startsWith('```')) continue;

      VARIABLE_DEF_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = VARIABLE_DEF_REGEX.exec(line)) !== null) {
        const rawName = match[1].trim();
        const rawExpr = match[2].trim();
        const key = normalizeVarName(rawName);
        if (!key) continue;

        definitions.set(key, {
          nomeOriginal: rawName,
          chaveNormalizada: key,
          expressaoBruta: rawExpr,
          notaId: note.id,
          notaTitulo: note.titulo,
          linha: lineIdx + 1,
        });
      }
    }
  }

  return definitions;
}

/**
 * Resolve recursivamente todas as variáveis definidas nas notas de um personagem,
 * detectando referências circulares e erros de sintaxe.
 */
export function evaluateAllNoteVariables(
  notes: QuestPortalNote[]
): Map<string, EvaluatedVariable> {
  const definitions = extractVariablesFromNotes(notes);
  const evaluated = new Map<string, EvaluatedVariable>();
  const visiting = new Set<string>();

  function resolveKey(key: string, stack: string[]): number {
    if (evaluated.has(key)) {
      const cached = evaluated.get(key)!;
      if (cached.ciclo) {
        throw new CircularDependencyError([...stack, key]);
      }
      if (cached.erro || cached.valor === null) {
        throw new Error(cached.erro || `Variável '${key}' com erro`);
      }
      return cached.valor;
    }

    const def = definitions.get(key);
    if (!def) {
      throw new Error(`Variável '${key}' não definida`);
    }

    if (visiting.has(key)) {
      throw new CircularDependencyError([...stack, def.nomeOriginal]);
    }

    visiting.add(key);
    try {
      const val = evaluateSafeMathExpression(def.expressaoBruta, (childIdent) => {
        const childKey = normalizeVarName(childIdent);
        return resolveKey(childKey, [...stack, def.nomeOriginal]);
      });

      evaluated.set(key, {
        nomeOriginal: def.nomeOriginal,
        chaveNormalizada: key,
        expressaoBruta: def.expressaoBruta,
        valor: val,
        notaId: def.notaId,
        notaTitulo: def.notaTitulo,
      });
      visiting.delete(key);
      return val;
    } catch (err) {
      visiting.delete(key);
      const isCycle = err instanceof CircularDependencyError;
      const msg = err instanceof Error ? err.message : 'Erro na fórmula';
      evaluated.set(key, {
        nomeOriginal: def.nomeOriginal,
        chaveNormalizada: key,
        expressaoBruta: def.expressaoBruta,
        valor: null,
        erro: msg,
        ciclo: isCycle,
        notaId: def.notaId,
        notaTitulo: def.notaTitulo,
      });
      throw err;
    }
  }

  for (const key of definitions.keys()) {
    if (!evaluated.has(key)) {
      try {
        resolveKey(key, []);
      } catch {
        // O erro já foi registrado no mapa `evaluated`
      }
    }
  }

  return evaluated;
}

/**
 * Avalia uma expressão inline `{expressao}` ou `{+expressao}` (onde o prefixo `+`
 * força a exibição do sinal positivo, ex: `{+mod_des}` -> `+4`).
 */
export function evaluateInlineFormula(
  rawFormulaInsideBraces: string,
  variables: Map<string, EvaluatedVariable>
): {
  ok: boolean;
  valor?: number;
  textoFormatado: string;
  erro?: string;
  ciclo?: boolean;
} {
  const trimmed = rawFormulaInsideBraces.trim();
  if (!trimmed) {
    return { ok: false, textoFormatado: '#VAZIO!', erro: 'Expressão vazia' };
  }

  const forcePlus = trimmed.startsWith('+');
  const cleanExpr = forcePlus ? trimmed.slice(1).trim() : trimmed;

  // Verifica se é apenas o nome direto de uma variável
  const directKey = normalizeVarName(cleanExpr);
  if (variables.has(directKey) && /^[\p{L}\p{N}_\s]+$/u.test(cleanExpr)) {
    const v = variables.get(directKey)!;
    if (v.ciclo) {
      return { ok: false, textoFormatado: '#CICLO!', erro: v.erro, ciclo: true };
    }
    if (v.erro || v.valor === null) {
      return { ok: false, textoFormatado: '#ERRO!', erro: v.erro };
    }
    const isModifierLike =
      forcePlus || directKey.startsWith('mod_') || directKey.startsWith('bonus_');
    return {
      ok: true,
      valor: v.valor,
      textoFormatado: formatCalculatedNumber(v.valor, isModifierLike),
    };
  }

  try {
    const val = evaluateSafeMathExpression(cleanExpr, (ident) => {
      const k = normalizeVarName(ident);
      const found = variables.get(k);
      if (!found) {
        throw new Error(`Variável '${ident}' não definida`);
      }
      if (found.ciclo) {
        throw new CircularDependencyError([ident]);
      }
      if (found.erro || found.valor === null) {
        throw new Error(found.erro || `Erro em '${ident}'`);
      }
      return found.valor;
    });

    return {
      ok: true,
      valor: val,
      textoFormatado: formatCalculatedNumber(val, forcePlus),
    };
  } catch (err) {
    const isCycle = err instanceof CircularDependencyError;
    const msg = err instanceof Error ? err.message : 'Erro de cálculo';
    return {
      ok: false,
      textoFormatado: isCycle ? '#CICLO!' : '#ERRO!',
      erro: msg,
      ciclo: isCycle,
    };
  }
}

/**
 * Atualiza o valor de uma variável `[nome = valor]` diretamente no texto das notas
 * (usado quando o jogador edita rapidamente um atributo no modo Ler/Jogar).
 */
export function updateVariableInNotes(
  notes: QuestPortalNote[],
  targetVarName: string,
  newExpressionOrValue: string
): QuestPortalNote[] {
  const targetKey = normalizeVarName(targetVarName);
  return notes.map((note) => {
    let changed = false;
    const updatedContent = note.conteudo.replace(
      VARIABLE_DEF_REGEX,
      (fullMatch, rawName: string, _rawExpr: string) => {
        if (normalizeVarName(rawName) === targetKey) {
          changed = true;
          return `[${rawName.trim()} = ${newExpressionOrValue.trim()}]`;
        }
        return fullMatch;
      }
    );
    if (!changed) return note;
    return {
      ...note,
      conteudo: updatedContent,
      atualizadoEm: Date.now(),
    };
  });
}

// ============================================================================
// 3. INTERPOLAÇÃO DE EXPRESSÕES DE DADOS (PARA BOTÕES E ROLAGENS INLINE)
// ============================================================================

/**
 * Substitui `{variavel_ou_formula}` e nomes de variáveis conhecidas dentro de uma
 * expressão de dados (como `1d20 + {mod_des} + {prof}` ou `1d20 + mod_des`)
 * pelos seus valores numéricos atuais antes de enviar para `onRoll`.
 */
export function resolveDiceExpressionWithVariables(
  rawDiceExpr: string,
  variables: Map<string, EvaluatedVariable>
): { expressaoResolvida: string; erro?: string } {
  let erroEncontrado: string | undefined;

  // 1. Substitui blocos explícitos `{...}`
  let resolved = rawDiceExpr.replace(/\{([^{}]+)\}/g, (_match, inner: string) => {
    const evalRes = evaluateInlineFormula(inner, variables);
    if (!evalRes.ok || evalRes.valor === undefined) {
      erroEncontrado = evalRes.erro || `Não foi possível resolver {${inner}}`;
      return '0';
    }
    return String(evalRes.valor);
  });

  // 2. Substitui identificadores soltos que correspondam a variáveis definidas
  //    (sem tocar em notações de dados como 1d20, d8, kh3, kl1, adv, dis)
  resolved = resolved.replace(
    /\b([\p{L}_][\p{L}\p{N}_]*)\b/gu,
    (fullWord: string) => {
      // Ignora termos de dados: d20, 2d6, kh1, kl1, d100
      if (/^(\d*d\d+|kh\d+|kl\d+|adv|dis)$/i.test(fullWord)) {
        return fullWord;
      }
      const key = normalizeVarName(fullWord);
      const found = variables.get(key);
      if (found) {
        if (found.valor === null || found.erro) {
          erroEncontrado = found.erro || `Variável '${fullWord}' inválida`;
          return '0';
        }
        return String(found.valor);
      }
      return fullWord;
    }
  );

  // Normaliza sinais duplicados como `+ -2` -> `- 2`
  resolved = resolved
    .replace(/\+\s*-/g, '- ')
    .replace(/-\s*-/g, '+ ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    expressaoResolvida: resolved,
    erro: erroEncontrado,
  };
}

// ============================================================================
// 4. PARSER DE MARKDOWN ESTILO DISCORD + TABELAS + BOTÕES + DADOS CLICÁVEIS
// ============================================================================

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'underline'; children: InlineNode[] }
  | { type: 'strike'; children: InlineNode[] }
  | { type: 'code'; code: string }
  | {
      type: 'var_def';
      nomeOriginal: string;
      chaveNormalizada: string;
      expressaoBruta: string;
    }
  | {
      type: 'var_ref';
      expressaoBruta: string;
    }
  | {
      type: 'roll_button';
      kind: 'rolar' | 'calc';
      rotulo: string;
      expressao: string;
    }
  | {
      type: 'inline_dice';
      expressaoOriginal: string;
    };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'subtext'; children: InlineNode[] }
  | { type: 'blockquote'; children: InlineNode[] }
  | { type: 'hr' }
  | { type: 'code_block'; language: string; code: string }
  | { type: 'ul'; items: InlineNode[][] }
  | { type: 'ol'; items: InlineNode[][] }
  | {
      type: 'table';
      headers: InlineNode[][];
      alignments: ('left' | 'center' | 'right')[];
      rows: InlineNode[][][];
    }
  | { type: 'paragraph'; children: InlineNode[] };

/**
 * Expressão regular combinada para tokens especiais inline:
 * 1. Código inline: `code`
 * 2. Botão de ação/rolagem: [rolar: Rótulo | Expressão] ou [Botão: Rótulo | Expressão] ou [calc: Rótulo | Expressão]
 * 3. Definição de variável: [nome = expressao]
 * 4. Expressão de dados inline no meio do texto (ex: `1d20-100`, `1d20+ 100`, `2d6 + 3`, `1d20 + {mod_des}`, `{dados_furtivo}d6`, `4d6kh3`)
 * 5. Exibição de variável/fórmula: {expressao}
 */
const INLINE_TOKEN_MASTER_REGEX =
  /(`[^`]+`)|(\[\s*(?:rolar|botao|botão|roll|calc|calcular)\s*:\s*([^\]|]+?)\s*\|\s*([^\]]+?)\s*\])|(\[([^\[\]=:|]+?)\s*=\s*([^\[\]]+?)\])|((?:\{[^{}]+\}|\b\d+)d\d+(?:kh\d+|kl\d+)?(?:\s*[+-]\s*(?:\d+(?:d\d+)?|\{[^{}]+\}))*)|(\{([^{}]+)\})/giu;

/**
 * Faz o parse de formatações inline do Discord (`**negrito**`, `__sublinhado__`,
 * `~~riscado~~`, `*itálico*`) e tokens interativos de RPG.
 */
export function parseInlineDiscordMarkdown(text: string): InlineNode[] {
  if (!text) return [];

  // Passo 1: processa os delimitadores de estilo (**bold**, __underline__, ~~strike~~, *italic*)
  const styleRegex = /(\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^\s*][\s\S]*?\*)/g;
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = styleRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...parseInteractiveTokens(text.slice(lastIndex, match.index)));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      nodes.push({
        type: 'bold',
        children: parseInlineDiscordMarkdown(token.slice(2, -2)),
      });
    } else if (token.startsWith('__') && token.endsWith('__') && token.length > 4) {
      nodes.push({
        type: 'underline',
        children: parseInlineDiscordMarkdown(token.slice(2, -2)),
      });
    } else if (token.startsWith('~~') && token.endsWith('~~') && token.length > 4) {
      nodes.push({
        type: 'strike',
        children: parseInlineDiscordMarkdown(token.slice(2, -2)),
      });
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      nodes.push({
        type: 'italic',
        children: parseInlineDiscordMarkdown(token.slice(1, -1)),
      });
    } else {
      nodes.push(...parseInteractiveTokens(token));
    }
    lastIndex = styleRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(...parseInteractiveTokens(text.slice(lastIndex)));
  }

  return nodes;
}

function parseInteractiveTokens(segment: string): InlineNode[] {
  if (!segment) return [];
  const result: InlineNode[] = [];
  const regex = new RegExp(INLINE_TOKEN_MASTER_REGEX.source, 'giu');
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(segment)) !== null) {
    if (m.index > lastIdx) {
      result.push({ type: 'text', text: segment.slice(lastIdx, m.index) });
    }

    if (m[1]) {
      // `code`
      result.push({ type: 'code', code: m[1].slice(1, -1) });
    } else if (m[2]) {
      // [rolar: Rótulo | Expressão] ou [calc: Rótulo | Expressão]
      const rawPrefix = m[2].slice(1, m[2].indexOf(':')).trim().toLowerCase();
      const kind = rawPrefix.startsWith('calc') ? 'calc' : 'rolar';
      result.push({
        type: 'roll_button',
        kind,
        rotulo: m[3].trim(),
        expressao: m[4].trim(),
      });
    } else if (m[5]) {
      // [var = expr]
      const nomeOriginal = m[6].trim();
      result.push({
        type: 'var_def',
        nomeOriginal,
        chaveNormalizada: normalizeVarName(nomeOriginal),
        expressaoBruta: m[7].trim(),
      });
    } else if (m[8]) {
      // 1d20-100, 1d20+ 100, 2d6 + 3, {dados_furtivo}d6
      result.push({
        type: 'inline_dice',
        expressaoOriginal: m[8].trim(),
      });
    } else if (m[9]) {
      // {expr}
      result.push({
        type: 'var_ref',
        expressaoBruta: m[10].trim(),
      });
    }

    lastIdx = regex.lastIndex;
  }

  if (lastIdx < segment.length) {
    result.push({ type: 'text', text: segment.slice(lastIdx) });
  }

  return result;
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let bracketDepth = 0;

  // Não quebra em '|' quando estiver dentro de `[rolar: Rótulo | 1d20 + {mod_des}]`
  for (let i = 0; i < withoutOuterPipes.length; i++) {
    const ch = withoutOuterPipes[i];
    if (ch === '[') bracketDepth++;
    else if (ch === ']' && bracketDepth > 0) bracketDepth--;

    if (ch === '|' && bracketDepth === 0) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const cells = splitMarkdownTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

/**
 * Converte o texto completo da nota em blocos estruturados de Markdown estilo Discord.
 */
export function parseDiscordMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Linha em branco
    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Bloco de código ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consome ``` final
      blocks.push({
        type: 'code_block',
        language,
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Linha divisória ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 3. Subtexto do Discord: `-# texto pequeno e cinza`
    if (/^-#\s+/.test(trimmed)) {
      const content = trimmed.replace(/^-#\s+/, '');
      blocks.push({
        type: 'subtext',
        children: parseInlineDiscordMarkdown(content),
      });
      i++;
      continue;
    }

    // 4. Títulos #, ##, ###
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        level,
        children: parseInlineDiscordMarkdown(headingMatch[2]),
      });
      i++;
      continue;
    }

    // 5. Citação >
    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        children: parseInlineDiscordMarkdown(quoteLines.join(' ')),
      });
      continue;
    }

    // 6. Tabela Markdown (linha com | seguida de linha separadora | --- | --- |)
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparatorLine(lines[i + 1])
    ) {
      const headerCells = splitMarkdownTableRow(lines[i]);
      const separatorCells = splitMarkdownTableRow(lines[i + 1]);
      const alignments = separatorCells.map((cell) => {
        const c = cell.trim();
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });

      i += 2;
      const rows: InlineNode[][][] = [];
      while (
        i < lines.length &&
        lines[i].trim().includes('|') &&
        lines[i].trim() !== ''
      ) {
        const rowCells = splitMarkdownTableRow(lines[i]);
        rows.push(rowCells.map((cellText) => parseInlineDiscordMarkdown(cellText)));
        i++;
      }

      blocks.push({
        type: 'table',
        headers: headerCells.map((h) => parseInlineDiscordMarkdown(h)),
        alignments,
        rows,
      });
      continue;
    }

    // 7. Lista não-ordenada (- item ou * item)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*]\s+/, '');
        items.push(parseInlineDiscordMarkdown(itemText));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 8. Lista ordenada (1. item)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: InlineNode[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        items.push(parseInlineDiscordMarkdown(itemText));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 9. Parágrafo padrão
    blocks.push({
      type: 'paragraph',
      children: parseInlineDiscordMarkdown(rawLine),
    });
    i++;
  }

  return blocks;
}

// ============================================================================
// 5. GERENCIAMENTO DE PASTAS E ISOLAMENTO ESTRITO POR CRIADOR (NOTAS PRIVADAS)
// ============================================================================

/**
 * Gera uma chave única e determinística para o dono das notas particulares,
 * garantindo que somente o usuário que criou suas pastas e notas possa vê-las.
 */
export function buildPrivateOwnerKey(sessionId: string, userName: string): string {
  const cleanSession = (sessionId || 'local').trim();
  const cleanUser = normalizeVarName(userName || 'jogador') || 'jogador';
  return `${cleanSession}::${cleanUser}`;
}

/**
 * Filtra estritamente as pastas pertencentes apenas ao criador atual.
 * Nenhuma pasta de outro jogador ou mestre é retornada.
 */
export function filterPrivateFoldersByCreator(
  folders: QuestPortalFolder[],
  criadorId: string
): QuestPortalFolder[] {
  return folders.filter((f) => !f.criadorId || f.criadorId === criadorId);
}

/**
 * Filtra estritamente as notas pertencentes apenas ao criador atual.
 * Nenhuma nota de outro jogador ou mestre é retornada.
 */
export function filterPrivateNotesByCreator(
  notes: QuestPortalNote[],
  criadorId: string
): QuestPortalNote[] {
  return notes.filter((n) => !n.criadorId || n.criadorId === criadorId);
}

export function createPrivateFolder(
  folders: QuestPortalFolder[],
  nome: string,
  criadorId: string,
  now = Date.now()
): { folders: QuestPortalFolder[]; created: QuestPortalFolder } {
  const trimmed = nome.trim() || `Nova Pasta ${folders.length + 1}`;
  const created: QuestPortalFolder = {
    id: `pasta-${now}-${Math.random().toString(36).slice(2, 6)}`,
    nome: trimmed,
    criadorId,
    criadoEm: now,
  };
  return {
    folders: [...folders, created],
    created,
  };
}

export function deletePrivateFolderAndUnlinkNotes(
  folders: QuestPortalFolder[],
  notes: QuestPortalNote[],
  folderId: string,
  criadorId: string
): { folders: QuestPortalFolder[]; notes: QuestPortalNote[] } {
  const target = folders.find((f) => f.id === folderId);
  if (!target || (target.criadorId && target.criadorId !== criadorId)) {
    return { folders, notes };
  }
  return {
    folders: folders.filter((f) => f.id !== folderId),
    notes: notes.map((n) => (n.pastaId === folderId ? { ...n, pastaId: null } : n)),
  };
}

export function movePrivateNoteToFolder(
  notes: QuestPortalNote[],
  noteId: string,
  targetFolderId: string | null,
  criadorId: string
): QuestPortalNote[] {
  return notes.map((n) => {
    if (n.id !== noteId) return n;
    if (n.criadorId && n.criadorId !== criadorId) return n;
    return {
      ...n,
      pastaId: targetFolderId,
      atualizadoEm: Date.now(),
    };
  });
}

// ============================================================================
// 6. TEMPLATES DE PASTAS E NOTAS PADRÃO (ESTILO QUEST PORTAL)
// ============================================================================

export function createDefaultQuestPortalFolders(criadorId = 'local-owner'): QuestPortalFolder[] {
  const now = Date.now();
  return [
    {
      id: 'pasta-personagem',
      nome: 'Personagem & Combate',
      criadorId,
      criadoEm: now,
    },
    {
      id: 'pasta-diario',
      nome: 'Mochila & Diário Pessoal',
      criadorId,
      criadoEm: now,
    },
  ];
}

export function createDefaultQuestPortalNotes(
  nomePersonagem = 'Aelar, o Lâmina Sombria',
  classe = 'Ladino (Assassino)',
  nivel = 5,
  criadorId = 'local-owner'
): QuestPortalNote[] {
  const now = Date.now();
  return [
    {
      id: 'nota-ficha-principal',
      titulo: 'Ficha',
      pastaId: 'pasta-personagem',
      criadorId,
      atualizadoEm: now,
      conteudo: `# ${nomePersonagem}
-# ${classe} • Nível [nivel = ${nivel}] • Bônus de Proficiência [prof = 3]

> *"Nas sombras de Vaelthar, quem vê o brilho da lâmina já perdeu a iniciativa."*

---

## Atributos & Modificadores Reativos
-# Altere qualquer atributo base (ex.: \`[destreza = 18]\`) e veja a CA, Perícias e Ataques mudarem em todas as suas notas!

| Atributo | Valor Base | Modificador | Salvaguarda | Rolagem Rápida |
| :--- | :---: | :---: | :---: | :--- |
| **Força** | [forca = 10] | [mod_for = floor((forca - 10) / 2)] ({+mod_for}) | {+mod_for} | [rolar: Teste de Força | 1d20 + {mod_for}] |
| **Destreza** | [destreza = 18] | [mod_des = floor((destreza - 10) / 2)] ({+mod_des}) | [save_des = mod_des + prof] ({+save_des}) | [rolar: Teste de Destreza | 1d20 + {mod_des}] |
| **Constituição** | [constituicao = 14] | [mod_con = floor((constituicao - 10) / 2)] ({+mod_con}) | {+mod_con} | [rolar: Teste de Constituição | 1d20 + {mod_con}] |
| **Inteligência** | [inteligencia = 14] | [mod_int = floor((inteligencia - 10) / 2)] ({+mod_int}) | [save_int = mod_int + prof] ({+save_int}) | [rolar: Teste de Inteligência | 1d20 + {mod_int}] |
| **Sabedoria** | [sabedoria = 12] | [mod_sab = floor((sabedoria - 10) / 2)] ({+mod_sab}) | {+mod_sab} | [rolar: Teste de Sabedoria | 1d20 + {mod_sab}] |
| **Carisma** | [carisma = 11] | [mod_car = floor((carisma - 10) / 2)] ({+mod_car}) | {+mod_car} | [rolar: Teste de Carisma | 1d20 + {mod_car}] |

---

## Status de Combate
- **Pontos de Vida Máximos:** [pv_max = 8 + mod_con + (nivel - 1) * (5 + mod_con)] PV
- **Classe de Armadura (Armadura de Couro Batido 12 + DES):** [ca = 12 + mod_des] (**CA {ca}**)
- **Iniciativa:** [iniciativa = mod_des] ({+iniciativa}) → [rolar: Iniciativa | 1d20 + {iniciativa}]
- **Percepção Passiva:** [percepcao_passiva = 10 + mod_sab + prof] (**{percepcao_passiva}**)

### Perícias Principais
1. **Furtividade (Especialização):** [furtividade = mod_des + prof * 2] ({+furtividade}) [rolar: Furtividade | 1d20 + {furtividade}]
2. **Acrobacia (Proficiente):** [acrobacia = mod_des + prof] ({+acrobacia}) [rolar: Acrobacia | 1d20 + {acrobacia}]
3. **Percepção (Proficiente):** [percepcao = mod_sab + prof] ({+percepcao}) [rolar: Percepção | 1d20 + {percepcao}]
4. **Investigação (Proficiente):** [investigacao = mod_int + prof] ({+investigacao}) [rolar: Investigação | 1d20 + {investigacao}]`,
    },
    {
      id: 'nota-mecanicas-combate',
      titulo: 'Mecânicas',
      pastaId: 'pasta-personagem',
      criadorId,
      atualizadoEm: now,
      conteudo: `# Arsenal & Mecânicas de Combate
-# Todas as fórmulas abaixo puxam automaticamente \`{mod_des}\` ({+mod_des}) e \`{prof}\` ({+prof}) da nota **Ficha**.

## Tabela de Armas & Ataques
- **Bônus de Ataque Ágil/Distância:** [atk_des = mod_des + prof] (**{+atk_des}**)
- **Dados de Ataque Furtivo (Nível {nivel}):** [dados_furtivo = ceil(nivel / 2)] ({dados_furtivo}d6)

| Arma / Habilidade | Bônus de Acerto | Dano Base | Ações Rápidas |
| :--- | :---: | :---: | :--- |
| **Adaga Sombria +1** | {+atk_des + 1} | 1d4 + {mod_des + 1} | [rolar: Acerto Adaga +1 | 1d20 + {atk_des + 1}] [rolar: Dano Adaga +1 | 1d4 + {mod_des + 1}] |
| **Arco Curto** | {+atk_des} | 1d6 + {mod_des} | [rolar: Acerto Arco Curto | 1d20 + {atk_des}] [rolar: Dano Arco Curto | 1d6 + {mod_des}] |
| **Ataque Furtivo** | Automático | {dados_furtivo}d6 | [rolar: Dano Furtivo | {dados_furtivo}d6] |
| **Veneno de Serpente (CD {8 + prof + mod_int})** | Salvaguarda CON | 3d6 | [rolar: Dano de Veneno | 3d6] [calc: CD do Veneno | 8 + prof + mod_int] |

---

## Rolagens Diretas no Texto (Auto-Link)
-# Qualquer dado escrito no texto (com ou sem espaços) vira um botão clicável automaticamente:
- Teste com penalidade extrema: 1d20-100
- Teste com bônus lendário: 1d20+ 100
- Poção de Cura Maior: 4d4 + 4
- Atributo (4d6 descartando o menor): 4d6kh3`,
    },
    {
      id: 'nota-inventario',
      titulo: 'Inventário',
      pastaId: 'pasta-diario',
      criadorId,
      atualizadoEm: now,
      conteudo: `# Inventário & Riquezas
-# Capacidade de Carga Máxima: [carga_max = forca * 15] lb (Baseado em Força {forca})

## Moedas
- **Peças de Ouro (PO):** [po = 145]
- **Peças de Prata (PP):** [pp = 30]
- **Patrimônio Total em Ouro:** {po + pp / 10} PO

## Equipamentos Carregados
- __Manto Élfico__ *(Vantagem em testes de Furtividade para se esconder)*
- **Ferramentas de Ladrão** → [rolar: Abrir Fechadura | 1d20 + {mod_des} + {prof}]
- ~~Tocha Comum~~ *(Consumida na masmorra)*
- 2x Poção de Cura Normal (2d4 + 2)`,
    },
    {
      id: 'nota-anotacoes',
      titulo: 'Segredos & Notas',
      pastaId: 'pasta-diario',
      criadorId,
      atualizadoEm: now,
      conteudo: `# Diário Pessoal (100% Particular)
-# Visível somente para você • Ninguém mais na mesa tem acesso a estas notas

> O Lorde Vael escondeu a chave rúnica atrás do altar norte. Precisamos passar pelos guardas com furtividade pelo menos CD 15.

\`\`\`
Mapa Mental do Cofre:
[Entrada] ---> [Corredor de Armadilhas (CD 16)] ---> [Altar Norte]
\`\`\`

- Lembrar de usar **Esquiva Sobrenatural** quando sofrer um ataque corpo-a-corpo.`,
    },
  ];
}

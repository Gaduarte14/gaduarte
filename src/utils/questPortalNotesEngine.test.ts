import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrivateOwnerKey,
  createDefaultQuestPortalFolders,
  createDefaultQuestPortalNotes,
  createPrivateFolder,
  deletePrivateFolderAndUnlinkNotes,
  evaluateAllNoteVariables,
  evaluateInlineFormula,
  evaluateSafeMathExpression,
  filterPrivateFoldersByCreator,
  filterPrivateNotesByCreator,
  movePrivateNoteToFolder,
  parseDiscordMarkdownBlocks,
  resolveDiceExpressionWithVariables,
  updateVariableInNotes,
  type QuestPortalNote,
} from './questPortalNotesEngine';

test('avaliador matemático seguro calcula aritmética, parênteses e funções sem usar eval', () => {
  const vars: Record<string, number> = {
    destreza: 18,
    forca: 15,
    prof: 3,
  };
  const lookup = (name: string) => {
    if (name in vars) return vars[name];
    throw new Error(`Variável desconhecida: ${name}`);
  };

  assert.equal(evaluateSafeMathExpression('floor((destreza - 10) / 2)', lookup), 4);
  assert.equal(evaluateSafeMathExpression('floor((forca - 10) / 2)', lookup), 2);
  assert.equal(evaluateSafeMathExpression('mod(destreza)', lookup), 4);
  assert.equal(evaluateSafeMathExpression('10 + mod(destreza) + prof', lookup), 17);
  assert.equal(evaluateSafeMathExpression('max(10, 12 + 4)', lookup), 16);
  assert.equal(evaluateSafeMathExpression('min(5, 2) * 3', lookup), 6);
  assert.equal(evaluateSafeMathExpression('ceil(5 / 2)', lookup), 3);
});

test('variáveis reativas recalculam em cascata entre múltiplas notas quando atributo base muda', () => {
  const notes = createDefaultQuestPortalNotes('Aelar', 'Ladino', 5);
  const varsBefore = evaluateAllNoteVariables(notes);

  assert.equal(varsBefore.get('destreza')?.valor, 18);
  assert.equal(varsBefore.get('mod_des')?.valor, 4);
  assert.equal(varsBefore.get('ca')?.valor, 16); // 12 + mod_des (4)
  assert.equal(varsBefore.get('atk_des')?.valor, 7); // mod_des (4) + prof (3) na nota Mecânicas

  // Altera destreza de 18 para 20 na nota Ficha
  const updatedNotes = updateVariableInNotes(notes, 'destreza', '20');
  const varsAfter = evaluateAllNoteVariables(updatedNotes);

  assert.equal(varsAfter.get('destreza')?.valor, 20);
  assert.equal(varsAfter.get('mod_des')?.valor, 5);
  assert.equal(varsAfter.get('ca')?.valor, 17); // 12 + 5
  assert.equal(varsAfter.get('atk_des')?.valor, 8); // 5 + 3
  assert.equal(varsAfter.get('furtividade')?.valor, 11); // 5 + 3*2

  // Verifica interpolação na expressão de rolagem da nota Mecânicas
  const rollRes = resolveDiceExpressionWithVariables('1d20 + {atk_des + 1}', varsAfter);
  assert.equal(rollRes.erro, undefined);
  assert.equal(rollRes.expressaoResolvida, '1d20 + 9');
});

test('detecta referência circular entre variáveis e erro de sintaxe sem travar', () => {
  const notes: QuestPortalNote[] = [
    {
      id: 'n1',
      titulo: 'Ficha',
      atualizadoEm: 1,
      conteudo: '[a = b + 1]\n[b = a + 1]\n[invalida = 10 / 0]',
    },
  ];

  const vars = evaluateAllNoteVariables(notes);
  assert.equal(vars.get('a')?.ciclo, true);
  assert.equal(vars.get('b')?.ciclo, true);
  assert.equal(vars.get('invalida')?.valor, null);
  assert.match(vars.get('invalida')?.erro || '', /Divisão por zero/);

  const inlineCycle = evaluateInlineFormula('a', vars);
  assert.equal(inlineCycle.ok, false);
  assert.equal(inlineCycle.textoFormatado, '#CICLO!');

  const inlineErr = evaluateInlineFormula('invalida', vars);
  assert.equal(inlineErr.ok, false);
  assert.equal(inlineErr.textoFormatado, '#ERRO!');
});

test('parser de Markdown estilo Discord reconhece -# subtexto, formatações, tabelas, botões e dados inline com espaços', () => {
  const md = `# Título Principal
-# Subtexto pequeno do Discord
Texto com **negrito**, *itálico*, __sublinhado__, ~~riscado~~ e \`código\`.
Rolagens no texto: 1d20-100 e também 1d20+ 100.

| Arma | Ataque | Ação |
| :--- | :---: | :--- |
| Adaga | {+mod_des} | [rolar: Atacar | 1d20 + {mod_des}] |`;

  const blocks = parseDiscordMarkdownBlocks(md);
  assert.equal(blocks[0]?.type, 'heading');
  assert.equal(blocks[1]?.type, 'subtext');
  assert.equal(blocks[2]?.type, 'paragraph');
  assert.equal(blocks[3]?.type, 'paragraph');
  assert.equal(blocks[4]?.type, 'table');

  // Confere que 1d20-100 e 1d20+ 100 viraram tokens inline_dice
  if (blocks[3]?.type === 'paragraph') {
    const diceNodes = blocks[3].children.filter((c) => c.type === 'inline_dice');
    assert.equal(diceNodes.length, 2);
    assert.equal(diceNodes[0]?.type === 'inline_dice' && diceNodes[0].expressaoOriginal, '1d20-100');
    assert.equal(diceNodes[1]?.type === 'inline_dice' && diceNodes[1].expressaoOriginal, '1d20+ 100');
  }

  // Confere que o botão [rolar: Atacar | 1d20 + {mod_des}] dentro da tabela não quebrou no '|'
  if (blocks[4]?.type === 'table') {
    assert.equal(blocks[4].headers.length, 3);
    assert.equal(blocks[4].rows.length, 1);
    const actionCell = blocks[4].rows[0][2];
    const btnNode = actionCell.find((n) => n.type === 'roll_button');
    assert.ok(btnNode && btnNode.type === 'roll_button');
    assert.equal(btnNode.rotulo, 'Atacar');
    assert.equal(btnNode.expressao, '1d20 + {mod_des}');
  }
});

test('pastas e notas são estritamente privadas por criador (criadorId) sem vazamento entre jogadores', () => {
  const ownerA = buildPrivateOwnerKey('sess-1', 'Jogador Alice');
  const ownerB = buildPrivateOwnerKey('sess-2', 'Jogador Bruno');
  assert.notEqual(ownerA, ownerB);

  const foldersA = createDefaultQuestPortalFolders(ownerA);
  const foldersB = createDefaultQuestPortalFolders(ownerB);
  const { folders: foldersAWithSecret, created: secretFolderA } = createPrivateFolder(
    foldersA,
    'Segredos de Alice',
    ownerA,
    1000
  );

  const allMixedFolders = [...foldersAWithSecret, ...foldersB];
  const visibleToA = filterPrivateFoldersByCreator(allMixedFolders, ownerA);
  const visibleToB = filterPrivateFoldersByCreator(allMixedFolders, ownerB);

  assert.equal(visibleToA.length, 3);
  assert.equal(visibleToB.length, 2);
  assert.ok(visibleToA.some((f) => f.nome === 'Segredos de Alice'));
  assert.ok(!visibleToB.some((f) => f.nome === 'Segredos de Alice'));

  const notesA = createDefaultQuestPortalNotes('Elara', 'Maga', 5, ownerA);
  const notesB = createDefaultQuestPortalNotes('Thorin', 'Guerreiro', 5, ownerB);
  const movedNotesA = movePrivateNoteToFolder(notesA, notesA[0].id, secretFolderA.id, ownerA);

  // Tentativa de Bruno mover uma nota de Alice deve ser ignorada
  const illegalMoveAttempt = movePrivateNoteToFolder(
    movedNotesA,
    notesA[0].id,
    null,
    ownerB
  );
  assert.equal(illegalMoveAttempt[0].pastaId, secretFolderA.id);

  const allMixedNotes = [...movedNotesA, ...notesB];
  const notesVisibleToA = filterPrivateNotesByCreator(allMixedNotes, ownerA);
  const notesVisibleToB = filterPrivateNotesByCreator(allMixedNotes, ownerB);

  assert.equal(notesVisibleToA.length, 4);
  assert.equal(notesVisibleToB.length, 4);
  assert.ok(notesVisibleToA.every((n) => n.criadorId === ownerA));
  assert.ok(notesVisibleToB.every((n) => n.criadorId === ownerB));

  // Excluir pasta desvincula as notas para pastaId = null apenas para o próprio criador
  const afterDelete = deletePrivateFolderAndUnlinkNotes(
    visibleToA,
    notesVisibleToA,
    secretFolderA.id,
    ownerA
  );
  assert.equal(afterDelete.folders.length, 2);
  assert.equal(afterDelete.notes[0].pastaId, null);
});


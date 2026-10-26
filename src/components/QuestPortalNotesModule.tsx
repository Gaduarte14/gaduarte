import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  Code,
  Columns,
  Dices,
  Edit3,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  HelpCircle,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Table,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildPrivateOwnerKey,
  createDefaultQuestPortalFolders,
  createDefaultQuestPortalNotes,
  createPrivateFolder,
  deletePrivateFolderAndUnlinkNotes,
  evaluateAllNoteVariables,
  evaluateInlineFormula,
  filterPrivateFoldersByCreator,
  filterPrivateNotesByCreator,
  formatCalculatedNumber,
  movePrivateNoteToFolder,
  parseDiscordMarkdownBlocks,
  resolveDiceExpressionWithVariables,
  updateVariableInNotes,
  type EvaluatedVariable,
  type InlineNode,
  type MarkdownBlock,
  type OnQuestPortalRollCallback,
  type QuestPortalFolder,
  type QuestPortalNote,
} from '../utils/questPortalNotesEngine.ts';

import {
  auth,
  db,
  doc,
  onAuthStateChanged,
  onSnapshot,
  setDoc,
  OperationType,
  handleFirestoreError,
  sanitizeForFirestore,
  type FirebaseUser,
} from '../firebase.ts';

export interface QuestPortalNotesModuleProps {
  /** Identificador único do dono (sessão + usuário) garantindo isolamento estrito por criador */
  criadorId?: string;
  /** Nome de exibição do jogador/mestre dono destas notas particulares */
  nomeCriador?: string;
  /** Papel atual (qualquer um — jogador ou mestre — pode criar pastas e notas particulares) */
  userRole?: 'mestre' | 'jogador';
  /** Identificador legado opcional */
  personagemId?: string;
  /** Nome opcional do personagem para inicializar o template padrão */
  nomePersonagem?: string;
  /** Classe opcional do personagem para inicializar o template padrão */
  classePersonagem?: string;
  /** Nível opcional do personagem para inicializar o template padrão */
  nivelPersonagem?: number;
  /**
   * Callback disparado sempre que o usuário clica em uma rolagem inline (ex: `1d20+ 100`)
   * ou em um botão `[rolar: Rótulo | 1d20 + {mod_des}]`.
   */
  onRoll?: OnQuestPortalRollCallback;
  /** Notas iniciais opcionais */
  initialNotes?: QuestPortalNote[];
  /** Callback opcional notificando alterações nas notas */
  onChangeNotes?: (notes: QuestPortalNote[]) => void;
  /** Se verdadeiro, exibe a lista organizada na aba lateral e abre a nota clicada em tela cheia igual à Ficha */
  compactSidebarMode?: boolean;
  /** Se verdadeiro, exibe botão de fechar no cabeçalho */
  onClose?: () => void;
}

// Cache em memória por dono para resposta instantânea a 60fps enquanto o Firestore sincroniza via onSnapshot
const memoryNotesCache = new Map<string, QuestPortalNote[]>();
const memoryFoldersCache = new Map<string, QuestPortalFolder[]>();

export const QuestPortalNotesModule: React.FC<QuestPortalNotesModuleProps> = ({
  criadorId,
  nomeCriador = 'Jogador',
  userRole = 'jogador',
  personagemId = 'default-character',
  nomePersonagem = 'Aelar, o Lâmina Sombria',
  classePersonagem = 'Ladino (Assassino)',
  nivelPersonagem = 5,
  onRoll,
  initialNotes,
  onChangeNotes,
  compactSidebarMode = false,
  onClose,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const isRemoteSnapshotRef = React.useRef<boolean>(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Chave estritamente particular do usuário que criou as notas (prioriza UID do Firebase Auth quando logado)
  const effectiveOwnerId = useMemo(
    () =>
      firebaseUser?.uid ||
      criadorId ||
      buildPrivateOwnerKey(personagemId, nomeCriador),
    [firebaseUser?.uid, criadorId, personagemId, nomeCriador]
  );

  // Carrega pastas particulares do criador
  const [folders, setFolders] = useState<QuestPortalFolder[]>(() => {
    const cached = memoryFoldersCache.get(effectiveOwnerId);
    if (cached && cached.length > 0) {
      return filterPrivateFoldersByCreator(cached, effectiveOwnerId);
    }
    return createDefaultQuestPortalFolders(effectiveOwnerId);
  });

  // Carrega notas particulares do criador
  const [notes, setNotes] = useState<QuestPortalNote[]>(() => {
    if (initialNotes && initialNotes.length > 0) {
      return filterPrivateNotesByCreator(initialNotes, effectiveOwnerId);
    }
    const cached = memoryNotesCache.get(effectiveOwnerId);
    if (cached && cached.length > 0) {
      return filterPrivateNotesByCreator(cached, effectiveOwnerId);
    }
    return createDefaultQuestPortalNotes(
      nomePersonagem,
      classePersonagem,
      nivelPersonagem,
      effectiveOwnerId
    );
  });

  // Recarrega quando o criador muda e assina em tempo real no Firestore (onSnapshot)
  useEffect(() => {
    const cachedFolders = memoryFoldersCache.get(effectiveOwnerId);
    if (cachedFolders && cachedFolders.length > 0) {
      setFolders(filterPrivateFoldersByCreator(cachedFolders, effectiveOwnerId));
    } else {
      setFolders(createDefaultQuestPortalFolders(effectiveOwnerId));
    }

    if (initialNotes && initialNotes.length > 0) {
      setNotes(filterPrivateNotesByCreator(initialNotes, effectiveOwnerId));
    } else {
      const cachedNotes = memoryNotesCache.get(effectiveOwnerId);
      if (cachedNotes && cachedNotes.length > 0) {
        setNotes(filterPrivateNotesByCreator(cachedNotes, effectiveOwnerId));
      } else {
        setNotes(
          createDefaultQuestPortalNotes(
            nomePersonagem,
            classePersonagem,
            nivelPersonagem,
            effectiveOwnerId
          )
        );
      }
    }

    if (!firebaseUser) return;

    const noteDocPath = `userNotes/${firebaseUser.uid}`;
    const noteDocRef = doc(db, 'userNotes', firebaseUser.uid);

    const unsub = onSnapshot(
      noteDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        isRemoteSnapshotRef.current = true;
        if (Array.isArray(data.folders)) {
          const validFolders = filterPrivateFoldersByCreator(
            data.folders as QuestPortalFolder[],
            effectiveOwnerId
          );
          memoryFoldersCache.set(effectiveOwnerId, validFolders);
          setFolders(validFolders);
        }
        if (Array.isArray(data.notes) && data.notes.length > 0) {
          const validNotes = filterPrivateNotesByCreator(
            data.notes as QuestPortalNote[],
            effectiveOwnerId
          );
          if (validNotes.length > 0) {
            memoryNotesCache.set(effectiveOwnerId, validNotes);
            setNotes(validNotes);
          }
        }
        window.setTimeout(() => {
          isRemoteSnapshotRef.current = false;
        }, 20);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, noteDocPath);
      }
    );

    return () => unsub();
  }, [
    effectiveOwnerId,
    firebaseUser,
    nomePersonagem,
    classePersonagem,
    nivelPersonagem,
    initialNotes,
  ]);

  // Persiste pastas e notas particulares no Firestore em tempo real (setDoc)
  useEffect(() => {
    memoryFoldersCache.set(effectiveOwnerId, folders);
    memoryNotesCache.set(effectiveOwnerId, notes);
    onChangeNotes?.(notes);

    if (!firebaseUser || isRemoteSnapshotRef.current) return;

    const timer = window.setTimeout(() => {
      const noteDocPath = `userNotes/${firebaseUser.uid}`;
      const noteDocRef = doc(db, 'userNotes', firebaseUser.uid);
      setDoc(
        noteDocRef,
        sanitizeForFirestore({
          ownerId: firebaseUser.uid,
          folders,
          notes,
          updatedAt: Date.now(),
        }),
        { merge: true }
      ).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, noteDocPath);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [folders, notes, effectiveOwnerId, firebaseUser, onChangeNotes]);

  // Garante que apenas pastas e notas cujo criadorId pertence ao usuário atual sejam exibidas
  const privateFolders = useMemo(
    () => filterPrivateFoldersByCreator(folders, effectiveOwnerId),
    [folders, effectiveOwnerId]
  );

  const privateNotes = useMemo(
    () => filterPrivateNotesByCreator(notes, effectiveOwnerId),
    [notes, effectiveOwnerId]
  );

  // Filtro de pasta ativa na lista: 'todas' | 'sem-pasta' | folder.id
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('todas');
  // ID da nota aberta na tela grande (igual à Ficha). Em modo standalone (não-sidebar), já inicia aberta.
  const [openedNoteModalId, setOpenedNoteModalId] = useState<string | null>(() =>
    compactSidebarMode ? null : privateNotes[0]?.id || null
  );

  const [mode, setMode] = useState<'ler' | 'editar'>('ler');
  const [splitPreviewInEdit, setSplitPreviewInEdit] = useState<boolean>(true);
  const [showSyntaxHelp, setShowSyntaxHelp] = useState<boolean>(false);
  const [showVariablesPanel, setShowVariablesPanel] = useState<boolean>(false);

  // Estados para criar nova Nota com nome escolhido pelo usuário
  const [isCreatingNote, setIsCreatingNote] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>('');
  const [newNoteFolderId, setNewNoteFolderId] = useState<string>('');

  // Estados para criar e renomear pastas
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState<string>('');

  // Estado para renomear nota na lista
  const [renamingNoteId, setRenamingNoteId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');

  // Estado para edição rápida de variável clicando no badge no modo "Ler / Jogar"
  const [editingVarKey, setEditingVarKey] = useState<string | null>(null);
  const [editingVarInput, setEditingVarInput] = useState<string>('');

  // Feedback visual instantâneo da última rolagem/cálculo acionado
  const [lastActionFeedback, setLastActionFeedback] = useState<{
    tipo: 'rolagem' | 'calculo' | 'erro';
    rotulo: string;
    expressaoOriginal: string;
    expressaoResolvida: string;
    timestamp: number;
  } | null>(null);

  // Sempre que trocar de criador/usuário, fecha o modal anterior e reseta o filtro para 'todas'
  useEffect(() => {
    setSelectedFolderFilter('todas');
    if (compactSidebarMode) {
      setOpenedNoteModalId(null);
    }
  }, [effectiveOwnerId, compactSidebarMode]);

  // Se o filtro apontar para uma pasta que não pertence a este usuário, cai para 'todas'
  const effectiveFolderFilter = useMemo(() => {
    if (selectedFolderFilter === 'todas' || selectedFolderFilter === 'sem-pasta') {
      return selectedFolderFilter;
    }
    const exists = privateFolders.some((f) => f.id === selectedFolderFilter);
    return exists ? selectedFolderFilter : 'todas';
  }, [selectedFolderFilter, privateFolders]);

  // Notas visíveis conforme a pasta selecionada
  const visibleNotesInFolder = useMemo(() => {
    if (effectiveFolderFilter === 'todas') return privateNotes;
    if (effectiveFolderFilter === 'sem-pasta') {
      return privateNotes.filter((n) => !n.pastaId);
    }
    return privateNotes.filter((n) => n.pastaId === effectiveFolderFilter);
  }, [privateNotes, effectiveFolderFilter]);

  const activeNote = useMemo(() => {
    if (openedNoteModalId) {
      const found = privateNotes.find((n) => n.id === openedNoteModalId);
      if (found) return found;
    }
    return visibleNotesInFolder[0] || privateNotes[0];
  }, [openedNoteModalId, visibleNotesInFolder, privateNotes]);

  // Avalia reativamente TODAS as variáveis de TODAS as notas particulares deste criador
  const evaluatedVariables = useMemo(
    () => evaluateAllNoteVariables(privateNotes),
    [privateNotes]
  );

  const variablesList = useMemo(
    () => Array.from(evaluatedVariables.values()),
    [evaluatedVariables]
  );

  const errorVariables = useMemo(
    () => variablesList.filter((v) => v.erro || v.ciclo),
    [variablesList]
  );

  // Faz o parse dos blocos Markdown da nota ativa
  const parsedBlocks = useMemo(
    () => (activeNote ? parseDiscordMarkdownBlocks(activeNote.conteudo) : []),
    [activeNote]
  );

  // Dispara rolagem de dados via callback `onRoll`
  const handleTriggerRoll = (rawExpr: string, rotulo?: string) => {
    const { expressaoResolvida, erro } = resolveDiceExpressionWithVariables(
      rawExpr,
      evaluatedVariables
    );

    if (erro) {
      setLastActionFeedback({
        tipo: 'erro',
        rotulo: rotulo || 'Erro na Rolagem',
        expressaoOriginal: rawExpr,
        expressaoResolvida: erro,
        timestamp: Date.now(),
      });
      return;
    }

    const finalExprWithComment = rotulo
      ? `${expressaoResolvida} # ${rotulo}`
      : expressaoResolvida;

    setLastActionFeedback({
      tipo: 'rolagem',
      rotulo: rotulo || 'Rolagem de Dados',
      expressaoOriginal: rawExpr,
      expressaoResolvida,
      timestamp: Date.now(),
    });

    onRoll?.(finalExprWithComment, {
      rotulo,
      expressaoOriginal: rawExpr,
      expressaoResolvida,
      notaId: activeNote?.id,
      notaTitulo: activeNote?.titulo,
      personagemId,
    });
  };

  // Dispara botão de cálculo `[calc: Rótulo | Expressão]`
  const handleTriggerCalc = (rawExpr: string, rotulo: string) => {
    const res = evaluateInlineFormula(rawExpr, evaluatedVariables);
    setLastActionFeedback({
      tipo: res.ok ? 'calculo' : 'erro',
      rotulo,
      expressaoOriginal: rawExpr,
      expressaoResolvida: res.ok ? `${rotulo} = ${res.textoFormatado}` : res.erro || '#ERRO!',
      timestamp: Date.now(),
    });
  };

  // Atualiza conteúdo da nota ativa no modo Editar
  const handleUpdateActiveNoteContent = (newContent: string) => {
    if (!activeNote) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNote.id
          ? {
              ...n,
              conteudo: newContent,
              criadorId: effectiveOwnerId,
              atualizadoEm: Date.now(),
            }
          : n
      )
    );
  };

  // Atualiza título da nota ativa
  const handleUpdateNoteTitle = (noteId: string, newTitle: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? {
              ...n,
              titulo: newTitle,
              atualizadoEm: Date.now(),
            }
          : n
      )
    );
  };

  // Insere snippet de sintaxe no final da nota ativa
  const handleInsertSnippet = (snippet: string) => {
    if (!activeNote) return;
    const prefix = activeNote.conteudo.endsWith('\n') || !activeNote.conteudo ? '' : '\n';
    handleUpdateActiveNoteContent(`${activeNote.conteudo}${prefix}${snippet}`);
    setMode('editar');
  };

  // Cria uma nova pasta particular para o usuário atual
  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const { folders: updated, created } = createPrivateFolder(
      privateFolders,
      newFolderName,
      effectiveOwnerId
    );
    setFolders(updated);
    setSelectedFolderFilter(created.id);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  // Exclui uma pasta particular (mantendo as notas dela como "Sem Pasta")
  const handleDeleteFolder = (folderId: string) => {
    const { folders: nextFolders, notes: nextNotes } = deletePrivateFolderAndUnlinkNotes(
      privateFolders,
      privateNotes,
      folderId,
      effectiveOwnerId
    );
    setFolders(nextFolders);
    setNotes(nextNotes);
    if (selectedFolderFilter === folderId) {
      setSelectedFolderFilter('todas');
    }
  };

  // Abre o formulário de nova nota já pré-selecionando a pasta atual
  const openCreateNoteForm = () => {
    const defaultFolder =
      effectiveFolderFilter !== 'todas' && effectiveFolderFilter !== 'sem-pasta'
        ? effectiveFolderFilter
        : privateFolders[0]?.id || '';
    setNewNoteFolderId(defaultFolder);
    setNewNoteTitle('');
    setIsCreatingNote(true);
    setIsCreatingFolder(false);
  };

  // Cria a nota com o nome escolhido e já abre em tela cheia igual à Ficha
  const handleCreateNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = newNoteTitle.trim() || `Nova Nota ${privateNotes.length + 1}`;
    const newId = `nota-${Date.now()}`;
    const targetFolderId = newNoteFolderId || null;

    const newNote: QuestPortalNote = {
      id: newId,
      titulo: finalTitle,
      pastaId: targetFolderId,
      criadorId: effectiveOwnerId,
      atualizadoEm: Date.now(),
      conteudo: `# ${finalTitle}\n-# Nota Particular de ${nomeCriador} • Use {mod_des} ou qualquer variável das suas notas!\n\nEscreva suas anotações, segredos, tabelas ou rolagens como 1d20 + {mod_des} aqui.`,
    };
    setNotes((prev) => [...prev, newNote]);
    setIsCreatingNote(false);
    setNewNoteTitle('');
    setOpenedNoteModalId(newId);
    setMode('editar');
  };

  // Move nota para outra pasta particular
  const handleMoveNoteFolder = (noteId: string, folderIdOrEmpty: string) => {
    const targetFolderId = folderIdOrEmpty === '' ? null : folderIdOrEmpty;
    setNotes((prev) =>
      movePrivateNoteToFolder(prev, noteId, targetFolderId, effectiveOwnerId)
    );
  };

  // Remove nota (mantendo pelo menos 1)
  const handleDeleteNote = (noteId: string) => {
    if (privateNotes.length <= 1) return;
    const remaining = privateNotes.filter((n) => n.id !== noteId);
    setNotes(remaining);
    if (openedNoteModalId === noteId) {
      setOpenedNoteModalId(null);
    }
  };

  // Restaura o template completo de exemplo particular
  const handleResetTemplate = () => {
    const freshFolders = createDefaultQuestPortalFolders(effectiveOwnerId);
    const freshNotes = createDefaultQuestPortalNotes(
      nomePersonagem,
      classePersonagem,
      nivelPersonagem,
      effectiveOwnerId
    );
    setFolders(freshFolders);
    setNotes(freshNotes);
    setSelectedFolderFilter('todas');
    setLastActionFeedback(null);
  };

  // Atualiza rapidamente uma variável numérica (+1 / -1 ou valor digitado) direto no modo Ler / Jogar
  const handleQuickUpdateVar = (varName: string, newExpr: string) => {
    setNotes((prev) => updateVariableInNotes(prev, varName, newExpr));
    setEditingVarKey(null);
  };

  // Extrai uma linha curta de resumo da nota para exibir no card da lista
  const getNoteSummaryLine = (conteudo: string): string => {
    const lines = conteudo
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('|'));
    if (lines.length === 0) return 'Clique para abrir esta nota em tela cheia';
    const first = lines[0].replace(/^-#\s+/, '').replace(/^>\s*/, '');
    return first.length > 68 ? `${first.slice(0, 68)}...` : first;
  };

  // Renderiza nós inline de Markdown + Tokens Reativos
  const renderInlineNodes = (nodes: InlineNode[], keyPrefix: string): React.ReactNode => {
    return nodes.map((node, idx) => {
      const key = `${keyPrefix}-${idx}`;

      switch (node.type) {
        case 'text':
          return <React.Fragment key={key}>{node.text}</React.Fragment>;

        case 'bold':
          return (
            <strong key={key} className="font-bold text-white">
              {renderInlineNodes(node.children, key)}
            </strong>
          );

        case 'italic':
          return (
            <em key={key} className="italic text-zinc-200">
              {renderInlineNodes(node.children, key)}
            </em>
          );

        case 'underline':
          return (
            <span key={key} className="underline decoration-violet-400/80 underline-offset-2">
              {renderInlineNodes(node.children, key)}
            </span>
          );

        case 'strike':
          return (
            <s key={key} className="line-through text-zinc-500">
              {renderInlineNodes(node.children, key)}
            </s>
          );

        case 'code':
          return (
            <code
              key={key}
              className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 font-mono text-xs text-amber-300"
            >
              {node.code}
            </code>
          );

        case 'var_def': {
          const evaluated = evaluatedVariables.get(node.chaveNormalizada);
          const hasError = Boolean(evaluated?.erro || evaluated?.ciclo);
          const isNumericLiteral = /^-?\d+(\.\d+)?$/.test(node.expressaoBruta.trim());
          const isEditingThis = editingVarKey === node.chaveNormalizada;

          if (hasError) {
            return (
              <span
                key={key}
                title={evaluated?.erro || 'Erro na definição da variável'}
                className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-rose-950/90 border border-rose-500/70 text-rose-200 font-mono text-xs font-bold"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                {node.nomeOriginal}: {evaluated?.ciclo ? '#CICLO!' : '#ERRO!'}
              </span>
            );
          }

          const val = evaluated?.valor ?? 0;

          if (isEditingThis) {
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-[#14151c] border border-violet-400"
              >
                <span className="text-[11px] font-mono text-zinc-400">{node.nomeOriginal}=</span>
                <input
                  type="text"
                  aria-label={`Editar variável ${node.nomeOriginal}`}
                  value={editingVarInput}
                  onChange={(e) => setEditingVarInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editingVarInput.trim()) {
                      handleQuickUpdateVar(node.nomeOriginal, editingVarInput);
                    } else if (e.key === 'Escape') {
                      setEditingVarKey(null);
                    }
                  }}
                  autoFocus
                  className="w-20 bg-zinc-900 text-white font-mono text-xs px-1.5 py-0.5 rounded border border-zinc-700 focus:outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editingVarInput.trim()) {
                      handleQuickUpdateVar(node.nomeOriginal, editingVarInput);
                    }
                  }}
                  className="p-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer"
                  title="Salvar valor"
                >
                  <Check className="w-3 h-3" />
                </button>
              </span>
            );
          }

          return (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-violet-950/60 border border-violet-500/50 text-violet-100 font-mono text-xs"
              title={`Variável [${node.nomeOriginal} = ${node.expressaoBruta}] → Clique para editar`}
            >
              <button
                type="button"
                onClick={() => {
                  setEditingVarKey(node.chaveNormalizada);
                  setEditingVarInput(node.expressaoBruta);
                }}
                className="inline-flex items-center gap-1 hover:text-amber-300 cursor-pointer"
              >
                <span className="text-violet-300/90 text-[11px]">{node.nomeOriginal}:</span>
                <strong className="text-white font-bold">{formatCalculatedNumber(val)}</strong>
              </button>
              {isNumericLiteral && (
                <span className="inline-flex items-center gap-0.5 ml-0.5 border-l border-violet-500/30 pl-1">
                  <button
                    type="button"
                    aria-label={`Diminuir ${node.nomeOriginal}`}
                    onClick={() => handleQuickUpdateVar(node.nomeOriginal, String(val - 1))}
                    className="p-0.5 rounded hover:bg-violet-800/60 text-violet-300 hover:text-white cursor-pointer"
                    title={`Diminuir ${node.nomeOriginal} (-1)`}
                  >
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Aumentar ${node.nomeOriginal}`}
                    onClick={() => handleQuickUpdateVar(node.nomeOriginal, String(val + 1))}
                    className="p-0.5 rounded hover:bg-violet-800/60 text-violet-300 hover:text-white cursor-pointer"
                    title={`Aumentar ${node.nomeOriginal} (+1)`}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </span>
              )}
            </span>
          );
        }

        case 'var_ref': {
          const res = evaluateInlineFormula(node.expressaoBruta, evaluatedVariables);
          if (!res.ok) {
            return (
              <span
                key={key}
                title={res.erro || 'Fórmula ou variável inválida'}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-rose-950/90 border border-rose-500/70 text-rose-200 font-mono text-xs font-bold"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                {res.textoFormatado}
              </span>
            );
          }
          return (
            <span
              key={key}
              title={`Fórmula: {${node.expressaoBruta}} = ${res.textoFormatado}`}
              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold"
            >
              {res.textoFormatado}
            </span>
          );
        }

        case 'roll_button': {
          if (node.kind === 'calc') {
            const calcPreview = evaluateInlineFormula(node.expressao, evaluatedVariables);
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTriggerCalc(node.expressao, node.rotulo)}
                title={`Calcular: ${node.expressao}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-0.5 my-0.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/50 text-amber-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{node.rotulo}</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 font-mono text-[11px] text-amber-300">
                  {calcPreview.textoFormatado}
                </span>
              </button>
            );
          }

          const resolvedPreview = resolveDiceExpressionWithVariables(
            node.expressao,
            evaluatedVariables
          );
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleTriggerRoll(node.expressao, node.rotulo)}
              title={`Rolar ${node.rotulo}: ${resolvedPreview.expressaoResolvida} (Original: ${node.expressao})`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-0.5 my-0.5 rounded-lg bg-violet-600/25 hover:bg-violet-600/45 border border-violet-500/60 text-violet-100 text-xs font-semibold transition-all shadow-sm hover:shadow-violet-500/10 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-violet-300 shrink-0" />
              <span>{node.rotulo}</span>
              <span className="px-1.5 py-0.2 rounded bg-[#14151c]/90 font-mono text-[11px] text-amber-300 border border-violet-500/30">
                {resolvedPreview.expressaoResolvida}
              </span>
            </button>
          );
        }

        case 'inline_dice': {
          const resolvedPreview = resolveDiceExpressionWithVariables(
            node.expressaoOriginal,
            evaluatedVariables
          );
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                handleTriggerRoll(node.expressaoOriginal, `Rolagem ${node.expressaoOriginal}`)
              }
              title={`Clique para rolar: ${resolvedPreview.expressaoResolvida}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-md bg-sky-950/70 hover:bg-sky-900/80 border border-sky-500/50 text-sky-200 font-mono text-xs font-semibold transition-colors cursor-pointer"
            >
              <Dices className="w-3 h-3 text-sky-400 shrink-0" />
              <span>{resolvedPreview.expressaoResolvida}</span>
            </button>
          );
        }

        default:
          return null;
      }
    });
  };

  // Renderiza um bloco Markdown completo
  const renderBlock = (block: MarkdownBlock, idx: number): React.ReactNode => {
    const key = `block-${idx}`;

    switch (block.type) {
      case 'heading': {
        if (block.level === 1) {
          return (
            <h1
              key={key}
              className="text-xl sm:text-2xl font-extrabold text-white tracking-tight border-b border-zinc-800 pb-2 mt-2 mb-3"
            >
              {renderInlineNodes(block.children, key)}
            </h1>
          );
        }
        if (block.level === 2) {
          return (
            <h2
              key={key}
              className="text-base sm:text-lg font-bold text-violet-200 tracking-tight mt-5 mb-2 flex items-center gap-2"
            >
              {renderInlineNodes(block.children, key)}
            </h2>
          );
        }
        return (
          <h3 key={key} className="text-sm sm:text-base font-bold text-amber-200 mt-4 mb-1.5">
            {renderInlineNodes(block.children, key)}
          </h3>
        );
      }

      case 'subtext':
        return (
          <p key={key} className="text-xs text-zinc-400 leading-relaxed -mt-1 mb-2.5">
            {renderInlineNodes(block.children, key)}
          </p>
        );

      case 'blockquote':
        return (
          <blockquote
            key={key}
            className="border-l-4 border-violet-500/70 bg-violet-950/15 pl-3.5 py-2 my-2.5 rounded-r-lg text-sm text-zinc-300 italic"
          >
            {renderInlineNodes(block.children, key)}
          </blockquote>
        );

      case 'hr':
        return <hr key={key} className="border-zinc-800 my-4" />;

      case 'code_block':
        return (
          <pre
            key={key}
            className="bg-[#0e1017] border border-zinc-800 rounded-xl p-3 my-3 overflow-x-auto font-mono text-xs text-zinc-200 leading-relaxed"
          >
            <code>{block.code}</code>
          </pre>
        );

      case 'ul':
        return (
          <ul key={key} className="list-disc list-inside space-y-1.5 my-2.5 text-sm text-zinc-200">
            {block.items.map((itemNodes, itemIdx) => (
              <li key={`${key}-li-${itemIdx}`} className="leading-relaxed">
                {renderInlineNodes(itemNodes, `${key}-li-${itemIdx}`)}
              </li>
            ))}
          </ul>
        );

      case 'ol':
        return (
          <ol
            key={key}
            className="list-decimal list-inside space-y-1.5 my-2.5 text-sm text-zinc-200"
          >
            {block.items.map((itemNodes, itemIdx) => (
              <li key={`${key}-oli-${itemIdx}`} className="leading-relaxed">
                {renderInlineNodes(itemNodes, `${key}-oli-${itemIdx}`)}
              </li>
            ))}
          </ol>
        );

      case 'table':
        return (
          <div
            key={key}
            className="my-3 w-full overflow-x-auto rounded-xl border border-zinc-800 bg-[#14151c]"
          >
            <table className="w-full min-w-[480px] border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#20222e] border-b border-zinc-700/80 text-zinc-200">
                  {block.headers.map((headerNodes, hIdx) => {
                    const align = block.alignments[hIdx] || 'left';
                    const alignClass =
                      align === 'center'
                        ? 'text-center'
                        : align === 'right'
                        ? 'text-right'
                        : 'text-left';
                    return (
                      <th
                        key={`${key}-th-${hIdx}`}
                        className={`px-3 py-2.5 font-bold uppercase tracking-wider text-[11px] text-zinc-300 ${alignClass}`}
                      >
                        {renderInlineNodes(headerNodes, `${key}-th-${hIdx}`)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {block.rows.map((rowCells, rIdx) => (
                  <tr
                    key={`${key}-tr-${rIdx}`}
                    className="hover:bg-zinc-800/35 transition-colors"
                  >
                    {rowCells.map((cellNodes, cIdx) => {
                      const align = block.alignments[cIdx] || 'left';
                      const alignClass =
                        align === 'center'
                          ? 'text-center'
                          : align === 'right'
                          ? 'text-right'
                          : 'text-left';
                      return (
                        <td
                          key={`${key}-td-${rIdx}-${cIdx}`}
                          className={`px-3 py-2 text-zinc-200 align-middle ${alignClass}`}
                        >
                          {renderInlineNodes(cellNodes, `${key}-td-${rIdx}-${cIdx}`)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'paragraph':
        return (
          <p key={key} className="text-sm text-zinc-200 leading-relaxed my-2">
            {renderInlineNodes(block.children, key)}
          </p>
        );

      default:
        return null;
    }
  };

  const unfiledCount = privateNotes.filter((n) => !n.pastaId).length;

  // =========================================================================
  // MODAL EM TELA CHEIA (IGUAL À TELA DA FICHA D&D 5E) QUANDO CLICA NA NOTA
  // =========================================================================
  const renderFullScreenNoteModal = () => {
    if (!activeNote) return null;
    const currentFolder = privateFolders.find((f) => f.id === activeNote.pastaId);

    const modalNode = (
      <div
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 md:p-5 overflow-y-auto"
        role="dialog"
        aria-label={`Nota Particular: ${activeNote.titulo}`}
      >
        <div className="w-full max-w-6xl bg-[#16171f] border border-zinc-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[94vh]">
          {/* TOP BANNER IGUAL AO CABEÇALHO DA FICHA D&D 5E */}
          <div className="bg-[#1e202b] border-b border-zinc-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-violet-600/20 border-2 border-violet-500/60 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-violet-300" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    aria-label="Nome da Nota"
                    value={activeNote.titulo}
                    onChange={(e) => handleUpdateNoteTitle(activeNote.id, e.target.value)}
                    className="text-xl font-bold text-white bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-violet-500 focus:outline-none w-56 sm:w-72"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  />
                  <span className="text-xs text-zinc-400 font-mono">
                    · NOTA PARTICULAR ({nomeCriador}) ·{' '}
                    {currentFolder ? `Pasta: ${currentFolder.nome}` : 'Sem Pasta'}
                  </span>
                </div>

                {/* Seletores rápidos no subcabeçalho (Pasta da Nota + Troca Rápida de Nota) */}
                <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                      PASTA:
                    </span>
                    <select
                      aria-label="Pasta da nota aberta"
                      value={activeNote.pastaId || ''}
                      onChange={(e) => handleMoveNoteFolder(activeNote.id, e.target.value)}
                      className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-zinc-200 text-xs focus:outline-none focus:border-violet-500"
                    >
                      <option value="">Sem Pasta</option>
                      {privateFolders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-zinc-600">·</span>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                      ALTERNAR NOTA:
                    </span>
                    <select
                      aria-label="Alternar para outra nota particular"
                      value={activeNote.id}
                      onChange={(e) => setOpenedNoteModalId(e.target.value)}
                      className="bg-[#14151c] border border-zinc-800 rounded px-2 py-0.5 text-violet-200 font-semibold text-xs focus:outline-none focus:border-violet-500"
                    >
                      {privateNotes.map((n) => {
                        const fName = privateFolders.find((f) => f.id === n.pastaId)?.nome;
                        return (
                          <option key={n.id} value={n.id}>
                            {n.titulo} {fName ? `(${fName})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <span className="text-zinc-600 hidden sm:inline">·</span>
                  <span className="text-[11px] text-emerald-400 font-mono hidden sm:inline">
                    {variablesList.length} variáveis reativas ativas
                  </span>
                </div>
              </div>
            </div>

            {/* CONTROLES DO TOPO DIREITO DA TELA DE NOTA */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-xl bg-[#14151c] p-1 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setMode('ler')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'ler'
                      ? 'bg-violet-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ler / Jogar
                </button>
                <button
                  type="button"
                  onClick={() => setMode('editar')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mode === 'editar'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Texto
                </button>
              </div>

              {mode === 'editar' && (
                <button
                  type="button"
                  onClick={() => setSplitPreviewInEdit((prev) => !prev)}
                  className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    splitPreviewInEdit
                      ? 'bg-violet-950/60 border-violet-500/60 text-violet-200'
                      : 'bg-[#14151c] border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                  title="Alternar visualização lado a lado enquanto edita"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Lado a Lado</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowVariablesPanel((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer ${
                  showVariablesPanel || errorVariables.length > 0
                    ? 'bg-violet-950/60 border-violet-500/60 text-violet-200'
                    : 'bg-[#14151c] border-zinc-800 text-zinc-300 hover:text-white'
                }`}
                title="Inspecionar todas as variáveis e modificadores calculados das suas notas"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Variáveis ({variablesList.length})</span>
                {errorVariables.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-bold">
                    {errorVariables.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSyntaxHelp((prev) => !prev)}
                className={`p-2 rounded-xl border cursor-pointer ${
                  showSyntaxHelp
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-[#14151c] border-zinc-800 text-zinc-400 hover:text-white'
                }`}
                title="Guia rápido de sintaxe (Markdown Discord, Variáveis e Botões)"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (compactSidebarMode) {
                    setOpenedNoteModalId(null);
                  } else {
                    onClose?.();
                  }
                }}
                aria-label="Fechar tela da nota"
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-rose-600 text-zinc-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Fechar tela da nota e voltar"
              >
                <X className="w-4 h-4" />
                <span>Fechar</span>
              </button>
            </div>
          </div>

          {/* FEEDBACK DA ÚLTIMA ROLAGEM / CÁLCULO */}
          {lastActionFeedback && (
            <div
              className={`flex items-center justify-between gap-2 px-5 py-2 text-xs border-b ${
                lastActionFeedback.tipo === 'erro'
                  ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                  : lastActionFeedback.tipo === 'calculo'
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Dices className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  <strong>{lastActionFeedback.rotulo}:</strong> rolagem enviada para o chat de dados{' '}
                  <code className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-white">
                    {lastActionFeedback.expressaoResolvida}
                  </code>{' '}
                  <span className="text-zinc-400">
                    (fórmula original: {lastActionFeedback.expressaoOriginal})
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLastActionFeedback(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* GUIA RÁPIDO DE SINTAXE */}
          {showSyntaxHelp && (
            <div className="px-5 py-3.5 bg-[#14151c] border-b border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 uppercase tracking-wider">
                  Como Usar Fórmulas, Variáveis e Botões nas Notas (Estilo Quest Portal)
                </span>
                <button
                  type="button"
                  onClick={() => setShowSyntaxHelp(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
                <div className="bg-[#1e202b] p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="text-violet-300 font-bold font-sans">1. Variáveis & Fórmulas</div>
                  <div>
                    <code className="text-amber-300">[destreza = 18]</code> → cria atributo
                  </div>
                  <div>
                    <code className="text-amber-300">[mod_des = floor((destreza - 10) / 2)]</code>
                  </div>
                  <div>
                    <code className="text-emerald-300">{'{+mod_des}'}</code> → exibe{' '}
                    <strong>+4</strong>
                  </div>
                </div>
                <div className="bg-[#1e202b] p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="text-violet-300 font-bold font-sans">
                    2. Botões & Dados no Texto
                  </div>
                  <div>
                    <code className="text-sky-300">[rolar: Ataque | 1d20 + {'{mod_des}'}]</code>
                  </div>
                  <div>
                    <code className="text-sky-300">[calc: CD Magia | 8 + prof + mod_int]</code>
                  </div>
                  <div>
                    Dados diretos: <code className="text-sky-300">1d20-100</code> ou{' '}
                    <code className="text-sky-300">1d20+ 100</code>
                  </div>
                </div>
                <div className="bg-[#1e202b] p-3 rounded-xl border border-zinc-800 space-y-1">
                  <div className="text-violet-300 font-bold font-sans">3. Markdown do Discord</div>
                  <div>
                    <code># Título</code> • <code>-# Subtexto pequeno cinza</code>
                  </div>
                  <div>
                    <code>**negrito**</code> • <code>*itálico*</code> • <code>__sublinhado__</code>{' '}
                    • <code>~~riscado~~</code>
                  </div>
                  <div>
                    <code>| Col 1 | Col 2 |</code> → Tabelas organizadas
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CORPO PRINCIPAL DA TELA DA NOTA */}
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {mode === 'editar' ? (
                <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-5 space-y-3">
                  {/* Barra de Inserção Rápida */}
                  <div className="flex items-center gap-2 flex-wrap bg-[#14151c] p-2.5 rounded-xl border border-zinc-800 text-xs">
                    <span className="text-zinc-400 font-semibold mr-1">Inserir rápido:</span>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet('[novo_atributo = 16]')}
                      className="px-2.5 py-1 rounded-lg bg-[#20222e] hover:bg-violet-600/30 border border-zinc-700 text-violet-200 font-mono text-xs cursor-pointer"
                    >
                      [var = valor]
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertSnippet('[mod_atr = floor((novo_atributo - 10) / 2)]')
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#20222e] hover:bg-violet-600/30 border border-zinc-700 text-emerald-300 font-mono text-xs cursor-pointer"
                    >
                      floor((x-10)/2)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertSnippet('[rolar: Ataque | 1d20 + {mod_des} + {prof}]')
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#20222e] hover:bg-violet-600/30 border border-zinc-700 text-sky-300 font-mono text-xs cursor-pointer"
                    >
                      [rolar: Rótulo | 1d20]
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet('-# Subtexto pequeno estilo Discord')}
                      className="px-2.5 py-1 rounded-lg bg-[#20222e] hover:bg-violet-600/30 border border-zinc-700 text-zinc-300 font-mono text-xs cursor-pointer"
                    >
                      -# subtexto
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleInsertSnippet(
                          '\n| Habilidade | Bônus | Ação |\n| :--- | :---: | :--- |\n| Golpe Rápido | {+mod_des} | [rolar: Golpe Rápido | 1d20 + {mod_des}] |'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#20222e] hover:bg-violet-600/30 border border-zinc-700 text-amber-300 font-mono text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Table className="w-3.5 h-3.5" /> Tabela
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertSnippet('\n```\nBloco de código\n```')}
                      className="px-2.5 py-1 rounded-lg bg-[#20222e] hover:bg-violet-600/30 border border-zinc-700 text-zinc-300 font-mono text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Code className="w-3.5 h-3.5" /> Código
                    </button>
                  </div>

                  {/* Área de Edição (Com suporte Lado a Lado no Desktop) */}
                  <div
                    className={`flex-1 grid gap-4 min-h-0 ${
                      splitPreviewInEdit ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
                    }`}
                  >
                    <textarea
                      aria-label="Editor de texto da nota"
                      value={activeNote.conteudo}
                      onChange={(e) => handleUpdateActiveNoteContent(e.target.value)}
                      placeholder="Digite sua nota particular usando Markdown do Discord, [variavel = valor], {formulas} e [rolar: Rótulo | 1d20 + {mod}]..."
                      className="w-full h-full bg-[#101118] border border-zinc-800 focus:border-violet-500 rounded-xl p-4 font-mono text-sm text-zinc-100 leading-relaxed resize-none focus:outline-none"
                    />

                    {splitPreviewInEdit && (
                      <div className="hidden lg:flex flex-col h-full bg-[#12131c] border border-zinc-800/90 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-[#1a1c26] border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Pré-visualização Interativa em Tempo Real
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-1">
                          {parsedBlocks.map((block, idx) => renderBlock(block, idx))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 space-y-1.5">
                  {parsedBlocks.length === 0 ? (
                    <div className="text-center py-16 text-zinc-500 text-sm">
                      Nota vazia. Clique em <strong>Editar Texto</strong> no topo para escrever.
                    </div>
                  ) : (
                    parsedBlocks.map((block, idx) => renderBlock(block, idx))
                  )}
                </div>
              )}
            </div>

            {/* PAINEL LATERAL DE VARIÁVEIS DENTRO DO MODAL */}
            {showVariablesPanel && (
              <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#14151c] flex flex-col max-h-64 lg:max-h-none overflow-y-auto p-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                    Suas Variáveis ({variablesList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowVariablesPanel(false)}
                    className="text-zinc-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Variáveis definidas em qualquer uma das suas notas podem ser usadas em todas as
                  suas pastas com <code className="text-emerald-300">{'{nome}'}</code>.
                </p>

                <div className="space-y-2">
                  {variablesList.map((v: EvaluatedVariable) => (
                    <div
                      key={v.chaveNormalizada}
                      className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${
                        v.erro || v.ciclo
                          ? 'bg-rose-950/40 border-rose-500/60 text-rose-200'
                          : 'bg-[#20222e] border-zinc-800 text-zinc-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-violet-300 truncate">{`{${v.chaveNormalizada}}`}</div>
                        <div className="text-[10px] text-zinc-400 truncate" title={v.expressaoBruta}>
                          = {v.expressaoBruta} ({v.notaTitulo})
                        </div>
                        {v.erro && <div className="text-[10px] text-rose-400">{v.erro}</div>}
                      </div>
                      <div className="shrink-0 font-bold text-sm">
                        {v.ciclo ? (
                          <span className="text-rose-400">#CICLO!</span>
                        ) : v.erro || v.valor === null ? (
                          <span className="text-rose-400">#ERRO!</span>
                        ) : (
                          <span className="text-emerald-400">
                            {formatCalculatedNumber(
                              v.valor,
                              v.chaveNormalizada.startsWith('mod_')
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    if (typeof document !== 'undefined') {
      return createPortal(modalNode, document.body);
    }
    return modalNode;
  };

  // Se não estiver em modo sidebar compacta, renderiza direto a tela grande
  if (!compactSidebarMode) {
    return renderFullScreenNoteModal();
  }

  // =========================================================================
  // VISÃO NA ABA LATERAL "NOTAS": LISTA ORGANIZADA DE PASTAS E NOTAS
  // (Ao clicar no nome da nota ou em "Abrir Nota", abre a tela igual à Ficha)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#181922]">
      {/* Cabeçalho limpo da aba Notas */}
      <div className="p-3 bg-[#1c1e29] border-b border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <h3 className="text-xs font-bold text-white truncate">
                Minhas Pastas & Notas
              </h3>
            </div>
            <p
              data-testid="private-notes-badge"
              className="text-[11px] text-zinc-400 truncate mt-0.5"
            >
              Particular ({nomeCriador}) · Só você vê o que criou
            </p>
          </div>

          <button
            type="button"
            onClick={handleResetTemplate}
            className="p-1.5 rounded-lg bg-[#14151c] border border-zinc-800 text-zinc-400 hover:text-amber-300 cursor-pointer shrink-0"
            title="Restaurar pastas e notas de exemplo padrão"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Botões principais de ação: Criar Nova Nota e Criar Nova Pasta */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="btn-new-private-note"
            onClick={openCreateNoteForm}
            className="py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-colors cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>+ Nova Nota</span>
          </button>

          <button
            type="button"
            data-testid="btn-new-note-folder"
            onClick={() => {
              setIsCreatingFolder((prev) => !prev);
              setIsCreatingNote(false);
            }}
            className="py-2 px-3 rounded-xl bg-[#252836] hover:bg-zinc-700 border border-zinc-700 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ Nova Pasta</span>
          </button>
        </div>

        {/* Formulário para dar o nome e criar uma Nova Nota */}
        {isCreatingNote && (
          <form
            onSubmit={handleCreateNoteSubmit}
            className="bg-[#14151c] border border-violet-500/50 rounded-xl p-2.5 space-y-2"
          >
            <div className="text-[11px] font-bold text-violet-300">
              Criar Nova Nota Particular
            </div>
            <input
              type="text"
              aria-label="Nome da nova nota particular"
              placeholder="Nome que você vai dar à nota..."
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              autoFocus
              className="w-full bg-[#1e202b] border border-zinc-700 focus:border-violet-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
            />
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Escolher pasta da nova nota"
                value={newNoteFolderId}
                onChange={(e) => setNewNoteFolderId(e.target.value)}
                className="flex-1 bg-[#1e202b] border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="">Sem Pasta</option>
                {privateFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    Pasta: {f.nome}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Criar e Abrir
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNote(false)}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* Formulário para criar uma Nova Pasta */}
        {isCreatingFolder && (
          <form
            onSubmit={handleCreateFolderSubmit}
            className="bg-[#14151c] border border-amber-500/50 rounded-xl p-2.5 space-y-2"
          >
            <div className="text-[11px] font-bold text-amber-300">
              Criar Nova Pasta Particular
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="Nome da nova pasta particular"
                placeholder="Nome da pasta (ex: Magias, Pistas)..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                className="flex-1 bg-[#1e202b] border border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* Filtro de Pastas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedFolderFilter('todas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
              effectiveFolderFilter === 'todas'
                ? 'bg-violet-600 text-white'
                : 'bg-[#14151c] text-zinc-300 hover:text-white border border-zinc-800'
            }`}
          >
            Todas ({privateNotes.length})
          </button>

          {privateFolders.map((folder) => {
            const count = privateNotes.filter((n) => n.pastaId === folder.id).length;
            const isSelected = effectiveFolderFilter === folder.id;
            const isRenamingThis = renamingFolderId === folder.id;

            return (
              <div
                key={folder.id}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#14151c] text-zinc-300 hover:text-white border border-zinc-800'
                }`}
              >
                <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                {isRenamingThis ? (
                  <input
                    type="text"
                    aria-label="Renomear pasta"
                    value={renameFolderInput}
                    onChange={(e) => setRenameFolderInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameFolderInput.trim()) {
                        setFolders((prev) =>
                          prev.map((f) =>
                            f.id === folder.id ? { ...f, nome: renameFolderInput.trim() } : f
                          )
                        );
                        setRenamingFolderId(null);
                      } else if (e.key === 'Escape') {
                        setRenamingFolderId(null);
                      }
                    }}
                    autoFocus
                    className="w-24 bg-zinc-900 border border-amber-400 rounded px-1 py-0.2 text-xs text-white focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedFolderFilter(folder.id)}
                    onDoubleClick={() => {
                      setRenamingFolderId(folder.id);
                      setRenameFolderInput(folder.nome);
                    }}
                    className="cursor-pointer"
                  >
                    {folder.nome} ({count})
                  </button>
                )}

                {isSelected && !isRenamingThis && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingFolderId(folder.id);
                        setRenameFolderInput(folder.nome);
                      }}
                      className="text-violet-200 hover:text-white ml-0.5 cursor-pointer"
                      title="Renomear pasta"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="text-violet-200 hover:text-rose-300 cursor-pointer"
                      title={`Excluir pasta ${folder.nome}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {unfiledCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedFolderFilter('sem-pasta')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer ${
                effectiveFolderFilter === 'sem-pasta'
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#14151c] text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              Sem Pasta ({unfiledCount})
            </button>
          )}
        </div>
      </div>

      {/* LISTA DE NOTAS (CARDS IGUAIS AOS DA ABA DE FICHAS) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {visibleNotesInFolder.length === 0 ? (
          <div className="text-center py-10 px-4 bg-[#14151c] rounded-xl border border-zinc-800/80 space-y-2">
            <Folder className="w-7 h-7 text-amber-400/60 mx-auto" />
            <div className="text-xs text-zinc-400">
              Nenhuma nota nesta pasta ainda.
            </div>
            <button
              type="button"
              onClick={openCreateNoteForm}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" /> Criar Nota Aqui
            </button>
          </div>
        ) : (
          visibleNotesInFolder.map((note) => {
            const folderObj = privateFolders.find((f) => f.id === note.pastaId);
            const isRenaming = renamingNoteId === note.id;

            return (
              <div
                key={note.id}
                onClick={() => {
                  if (!isRenaming) {
                    setOpenedNoteModalId(note.id);
                  }
                }}
                data-testid={`note-card-${note.id}`}
                className="bg-[#20222e] hover:bg-[#262938] border border-zinc-800 hover:border-violet-500/60 rounded-xl p-3 space-y-2 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center shrink-0 group-hover:bg-violet-600/30 transition-colors">
                      <FileText className="w-5 h-5 text-violet-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            aria-label="Novo nome da nota"
                            value={renameTitleInput}
                            onChange={(e) => setRenameTitleInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && renameTitleInput.trim()) {
                                handleUpdateNoteTitle(note.id, renameTitleInput.trim());
                                setRenamingNoteId(null);
                              } else if (e.key === 'Escape') {
                                setRenamingNoteId(null);
                              }
                            }}
                            autoFocus
                            className="w-full bg-[#14151c] border border-violet-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (renameTitleInput.trim()) {
                                handleUpdateNoteTitle(note.id, renameTitleInput.trim());
                              }
                              setRenamingNoteId(null);
                            }}
                            className="p-1 rounded bg-emerald-600 text-white cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-white truncate">
                            {note.titulo}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingNoteId(note.id);
                              setRenameTitleInput(note.titulo);
                            }}
                            className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                            title="Renomear nota"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <div className="text-[11px] text-zinc-400 truncate">
                        {folderObj ? `Pasta: ${folderObj.nome}` : 'Sem Pasta'}
                      </div>
                    </div>
                  </div>

                  {/* Botões de Ação do Card (Igual ao Editar Ficha + Excluir) */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenedNoteModalId(note.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>Abrir Nota</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {privateNotes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/60 text-zinc-400 hover:text-rose-300 cursor-pointer"
                        title={`Apagar nota ${note.titulo}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Linha de resumo discreta e seletor de pasta */}
                <div className="flex items-center justify-between gap-2 bg-[#14151c] px-2.5 py-1.5 rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400">
                  <span className="truncate">{getNoteSummaryLine(note.conteudo)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quando o usuário clica em qualquer nota da lista, abre a tela grande igual à Ficha */}
      {openedNoteModalId && renderFullScreenNoteModal()}
    </div>
  );
};

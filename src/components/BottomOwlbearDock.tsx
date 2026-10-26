import React, { useState } from 'react';
import {
  Search,
  Trees,
  Sparkles,
  Swords,
  CircleDot,
  FileText,
  FolderPlus,
  Folder,
  Edit3,
  Trash2,
  Upload,
  Check,
  X,
  Plus,
  MapPin,
  Flame,
  Eye,
  Lock,
  Unlock,
  Sliders,
  RotateCcw,
  Grid,
  Hexagon,
  Diamond,
  CloudFog,
  EyeOff,
  BrickWall,
} from 'lucide-react';
import type {
  AssetFolder,
  CharacterSheet,
  DockCategory,
  MapScene,
  MapWallSegment,
  MediaAsset,
} from '../types/vtt.ts';

interface BottomOwlbearDockProps {
  userRole: 'mestre' | 'jogador';
  activeCategory: DockCategory | null;
  onSelectCategory: (cat: DockCategory | null) => void;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  folders: AssetFolder[];
  assets: MediaAsset[];
  scenes: MapScene[];
  activeSceneId: string;
  sheets: CharacterSheet[];
  onSelectScene: (sceneId: string) => void;
  onCreateScene: (
    nome: string,
    pastaId: string | null,
    bgDataUrl?: string,
    larguraQuadrados?: number,
    alturaQuadrados?: number,
    tamanhoGradePx?: number,
    extraConfig?: Partial<MapScene>
  ) => void;
  onUpdateSceneDimensions: (
    sceneId: string,
    larguraQuadrados: number,
    alturaQuadrados: number,
    tamanhoGradePx: number,
    extraConfig?: Partial<MapScene>
  ) => void;
  onDeleteScene: (sceneId: string) => void;
  onCreateFolder: (nome: string, categoria: DockCategory) => void;
  onRenameFolder: (folderId: string, novoNome: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onUploadAssetLossless: (asset: MediaAsset) => void;
  onUpdateAsset: (updated: MediaAsset) => void;
  onDeleteAsset: (assetId: string) => void;
  onSpawnAssetToMap: (asset: MediaAsset) => void;
  onOpenSheetById: (sheetId: string) => void;
}

const DOCK_CATEGORIES: {
  id: DockCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: number;
}[] = [
  { id: 'scene', label: 'Mapas & Cenas', icon: Trees, group: 1 },
  { id: 'prop', label: 'Objetos & Luzes', icon: Flame, group: 1 },
  { id: 'effect', label: 'Magias & Efeitos', icon: Sparkles, group: 1 },
  { id: 'mount', label: 'Montarias & Veículos', icon: Swords, group: 2 },
  { id: 'character', label: 'Personagens & Tokens', icon: CircleDot, group: 2 },
  { id: 'attachment', label: 'Auras & Anexos', icon: Eye, group: 2 },
  { id: 'note', label: 'Notas & Fichas', icon: FileText, group: 3 },
];

export const BottomOwlbearDock: React.FC<BottomOwlbearDockProps> = ({
  userRole,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onChangeSearch,
  folders,
  assets,
  scenes,
  activeSceneId,
  sheets,
  onSelectScene,
  onCreateScene,
  onUpdateSceneDimensions,
  onDeleteScene,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onUploadAssetLossless,
  onUpdateAsset,
  onDeleteAsset,
  onSpawnAssetToMap,
  onOpenSheetById,
}) => {
  const isGM = userRole === 'mestre';

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Inline Rename / Edit States for Scenes and Assets/Tokens
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);
  const [renameSceneText, setRenameSceneText] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editAssetName, setEditAssetName] = useState('');
  const [editAssetSquares, setEditAssetSquares] = useState<number>(1);
  const [editAssetFolderId, setEditAssetFolderId] = useState<string | null>(null);

  // Owlbear Rodeo Style Scene Importer & Auto-Aspect Ratio Grid Modal State
  const [sceneModalOpen, setSceneModalOpen] = useState(false);
  const [editingExistingSceneId, setEditingExistingSceneId] = useState<string | null>(null);
  const [sceneName, setSceneName] = useState('');
  const [sceneBgDataUrl, setSceneBgDataUrl] = useState('');
  const [sceneFileSizeKb, setSceneFileSizeKb] = useState<number>(549);

  // Width / Height with Owlbear Auto-Aspect Ratio Lock
  const [mapWidthSquares, setMapWidthSquares] = useState<number>(24);
  const [mapHeightSquares, setMapHeightSquares] = useState<number>(16);
  const [aspectRatio, setAspectRatio] = useState<number>(24 / 16);
  const [defaultWidthSquares, setDefaultWidthSquares] = useState<number>(24);
  const [defaultHeightSquares, setDefaultHeightSquares] = useState<number>(16);
  const [aspectLocked, setAspectLocked] = useState<boolean>(true);

  // Owlbear Grid & Fog Controls
  const [mapGridPx, setMapGridPx] = useState<number>(64);
  const [gridScaleLabel, setGridScaleLabel] = useState<string>('5ft');
  const [gridLineWidthPx, setGridLineWidthPx] = useState<number>(2);
  const [gridColor, setGridColor] = useState<string>('#ffffff');
  const [gridOpacity, setGridOpacity] = useState<number>(0.22);
  const [gridType, setGridType] = useState<'square' | 'hex-v' | 'hex-h' | 'iso'>('square');
  const [lineType, setLineType] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  const [snappingEnabled, setSnappingEnabled] = useState<boolean>(true);
  const [measurementMode, setMeasurementMode] = useState<string>('Chessboard (D&D 5e)');
  const [fogFilled, setFogFilled] = useState<boolean>(true);
  const [wallCollisionEnabled, setWallCollisionEnabled] = useState<boolean>(true);
  const [modalWalls, setModalWalls] = useState<MapWallSegment[]>([]);

  // Auto-adjust Height when Width changes if aspect ratio is locked (Owlbear behavior)
  const handleWidthSquaresChange = (newWidthRaw: number) => {
    const validW = Math.max(2, Math.min(200, Number.isFinite(newWidthRaw) ? newWidthRaw : 2));
    setMapWidthSquares(validW);
    if (aspectLocked && aspectRatio > 0) {
      const autoH = Math.max(2, Math.min(200, Math.round(validW / aspectRatio)));
      setMapHeightSquares(autoH);
    }
  };

  // Auto-adjust Width when Height changes if aspect ratio is locked (Owlbear behavior)
  const handleHeightSquaresChange = (newHeightRaw: number) => {
    const validH = Math.max(2, Math.min(200, Number.isFinite(newHeightRaw) ? newHeightRaw : 2));
    setMapHeightSquares(validH);
    if (aspectLocked && aspectRatio > 0) {
      const autoW = Math.max(2, Math.min(200, Math.round(validH * aspectRatio)));
      setMapWidthSquares(autoW);
    }
  };

  const handleToggleAspectLock = () => {
    const nextLocked = !aspectLocked;
    setAspectLocked(nextLocked);
    if (nextLocked && mapWidthSquares > 0 && mapHeightSquares > 0) {
      setAspectRatio(mapWidthSquares / mapHeightSquares);
    }
  };

  const handleResetDimensions = () => {
    setMapWidthSquares(defaultWidthSquares);
    setMapHeightSquares(defaultHeightSquares);
    if (defaultHeightSquares > 0) {
      setAspectRatio(defaultWidthSquares / defaultHeightSquares);
    }
    setAspectLocked(true);
  };

  const openEditCurrentSceneModal = (scene: MapScene) => {
    if (!isGM) return;
    setEditingExistingSceneId(scene.id);
    setSceneName(scene.nome);
    setSceneBgDataUrl(scene.fundoUrl);
    const w = scene.larguraQuadrados || 24;
    const h = scene.alturaQuadrados || 16;
    const ratio = scene.proporcaoAspecto || (h > 0 ? w / h : 1.5);
    setMapWidthSquares(w);
    setMapHeightSquares(h);
    setDefaultWidthSquares(w);
    setDefaultHeightSquares(h);
    setAspectRatio(ratio);
    setAspectLocked(scene.proporcaoTrancada ?? true);
    setMapGridPx(scene.tamanhoGradePx || 64);
    setGridScaleLabel(scene.escalaUnidade || '5ft');
    setGridColor(scene.corGrade || '#ffffff');
    setGridOpacity(scene.opacidadeGrade ?? 0.22);
    setGridLineWidthPx(scene.espessuraLinhaPx ?? 2);
    setGridType(scene.tipoGrade || 'square');
    setLineType(scene.estiloLinha || 'solid');
    setSnappingEnabled(scene.snappingAtivo ?? true);
    setFogFilled(scene.nevoaAtiva ?? true);
    setWallCollisionEnabled(Boolean(scene.colisaoParedesAtiva));
    setModalWalls(scene.paredes ? [...scene.paredes] : []);
    setSceneModalOpen(true);
  };

  // Lossless image upload (GM ONLY) — Automatically opens Owlbear Size & Grid Modal when importing a map!
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isGM) return;
    const files = e.target.files;
    if (!files || files.length === 0 || !activeCategory) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== 'string') return;

        const img = new Image();
        img.onload = () => {
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          if (activeCategory === 'scene') {
            // Compute automatic grid dimensions preserving exact image aspect ratio (like Owlbear Rodeo!)
            const imgRatio =
              img.naturalWidth > 0 && img.naturalHeight > 0
                ? img.naturalWidth / img.naturalHeight
                : 1.5;
            const suggestedW = Math.max(
              10,
              Math.min(80, Math.round(img.naturalWidth / 64) || 32)
            );
            const suggestedH = Math.max(6, Math.round(suggestedW / imgRatio));

            setEditingExistingSceneId(null);
            setSceneName(cleanName);
            setSceneBgDataUrl(dataUrl);
            setSceneFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
            setAspectRatio(imgRatio);
            setMapWidthSquares(suggestedW);
            setMapHeightSquares(suggestedH);
            setDefaultWidthSquares(suggestedW);
            setDefaultHeightSquares(suggestedH);
            setAspectLocked(true);
            setMapGridPx(64);
            setGridScaleLabel('5ft');
            setGridColor('#ffffff');
            setGridOpacity(0.25);
            setGridLineWidthPx(2);
            setFogFilled(true);
            setWallCollisionEnabled(true);
            setModalWalls([]);
            setSceneModalOpen(true);
          } else {
            const newAsset: MediaAsset = {
              id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              nome: cleanName,
              categoria: activeCategory,
              pastaId: selectedFolderId,
              dataUrl,
              larguraOriginal: img.naturalWidth || 512,
              alturaOriginal: img.naturalHeight || 512,
              mimeType: file.type || 'image/png',
              tamanhoBytes: file.size,
              padraoQuadrados: activeCategory === 'mount' ? 2 : 1,
            };
            onUploadAssetLossless(newAsset);
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleConfirmSceneModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGM) return;

    const extraConfig: Partial<MapScene> = {
      escalaUnidade: gridScaleLabel || '5ft',
      proporcaoAspecto: aspectRatio,
      proporcaoTrancada: aspectLocked,
      corGrade: gridColor,
      opacidadeGrade: gridOpacity,
      espessuraLinhaPx: gridLineWidthPx,
      tipoGrade: gridType,
      estiloLinha: lineType,
      snappingAtivo: snappingEnabled,
      nevoaAtiva: fogFilled,
      colisaoParedesAtiva: wallCollisionEnabled,
      paredes: modalWalls,
    };

    if (editingExistingSceneId) {
      onUpdateSceneDimensions(
        editingExistingSceneId,
        mapWidthSquares,
        mapHeightSquares,
        mapGridPx,
        {
          ...extraConfig,
          nome: sceneName.trim() || 'Mapa Tático',
        }
      );
    } else {
      onCreateScene(
        sceneName.trim() || 'Novo Mapa Tático',
        selectedFolderId,
        sceneBgDataUrl,
        mapWidthSquares,
        mapHeightSquares,
        mapGridPx,
        extraConfig
      );
    }

    setSceneModalOpen(false);
  };

  const handleSceneRenameSubmit = (scene: MapScene) => {
    if (!isGM) return;
    if (renameSceneText.trim()) {
      onUpdateSceneDimensions(
        scene.id,
        scene.larguraQuadrados,
        scene.alturaQuadrados,
        scene.tamanhoGradePx,
        { nome: renameSceneText.trim() }
      );
    }
    setRenamingSceneId(null);
    setRenameSceneText('');
  };

  const handleStartEditAsset = (asset: MediaAsset) => {
    setEditingAssetId(asset.id);
    setEditAssetName(asset.nome);
    setEditAssetSquares(asset.padraoQuadrados || 1);
    setEditAssetFolderId(asset.pastaId);
  };

  const handleSaveAssetEdit = (asset: MediaAsset) => {
    if (!isGM) return;
    onUpdateAsset({
      ...asset,
      nome: editAssetName.trim() || asset.nome,
      padraoQuadrados: Math.max(1, Math.min(6, Number(editAssetSquares) || 1)),
      pastaId: editAssetFolderId,
    });
    setEditingAssetId(null);
  };

  const categoryFolders = folders.filter((f) => f.categoria === activeCategory);

  const filteredAssets = assets.filter((a) => {
    if (a.categoria !== activeCategory) return false;
    if (selectedFolderId && a.pastaId !== selectedFolderId) return false;
    if (searchQuery.trim()) {
      return a.nome.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const filteredScenes = scenes.filter((s) => {
    if (selectedFolderId && s.pastaId !== selectedFolderId) return false;
    if (searchQuery.trim()) {
      return s.nome.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGM || !newFolderName.trim() || !activeCategory) return;
    onCreateFolder(newFolderName.trim(), activeCategory);
    setNewFolderName('');
    setCreatingFolder(false);
  };

  const handleRenameSubmit = (folderId: string) => {
    if (!isGM) return;
    if (renameText.trim()) {
      onRenameFolder(folderId, renameText.trim());
    }
    setRenamingFolderId(null);
    setRenameText('');
  };

  if (!isGM) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none">
        {/* Expanded Drawer Above Dock when a Category is Active */}
        {activeCategory && (
          <div
            className="mb-3 w-[94vw] max-w-3xl bg-[#1d1e26]/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl shadow-2xl p-4 pointer-events-auto text-zinc-100"
            role="region"
            aria-label="Gaveta de Recursos e Pastas"
          >
            {/* Drawer Header: Category Title, Folder Actions & GM-only Upload (Removed redundant Ajustar Tamanho button) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {DOCK_CATEGORIES.find((c) => c.id === activeCategory)?.label}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                  {activeCategory === 'scene' ? filteredScenes.length : filteredAssets.length} itens
                </span>
                {!isGM && (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Lock className="w-3 h-3" /> Somente o Mestre anexa itens ou mapas
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isGM && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCreatingFolder((prev) => !prev)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#252733] hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3.5 h-3.5 text-violet-400" />
                      Nova Pasta
                    </button>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {activeCategory === 'scene' ? 'Importar Mapa' : 'Upload Sem Perda'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple={activeCategory !== 'scene'}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Fechar gaveta"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* New Folder Inline Form */}
            {isGM && creatingFolder && (
              <form
                onSubmit={handleCreateFolderSubmit}
                className="flex items-center gap-2 my-2.5 bg-[#14151c] p-2 rounded-xl border border-zinc-800"
              >
                <Folder className="w-4 h-4 text-violet-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Nome da nova pasta..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg"
                >
                  Criar Pasta
                </button>
              </form>
            )}

            {/* Folder Tabs Bar (Supports Selecting, Renaming, and Deleting Folders) */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 border-b border-zinc-800/80">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedFolderId === null
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#252733] text-zinc-300 hover:text-white'
                }`}
              >
                Todas as Pastas
              </button>

              {categoryFolders.map((folder) => {
                const isRenaming = renamingFolderId === folder.id;
                const isSelected = selectedFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-violet-600/30 border-violet-500 text-white'
                        : 'bg-[#252733] border-zinc-700/70 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    {isRenaming && isGM ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(folder.id);
                          }}
                          autoFocus
                          className="w-28 bg-[#14151c] px-1.5 py-0.5 rounded text-xs text-white focus:outline-none border border-violet-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSubmit(folder.id)}
                          className="text-emerald-400 hover:text-emerald-300"
                          title="Confirmar novo nome"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedFolderId(folder.id)}
                          className="cursor-pointer"
                        >
                          {folder.nome}
                        </button>
                        {isGM && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingFolderId(folder.id);
                                setRenameText(folder.nome);
                              }}
                              className="text-zinc-400 hover:text-white p-0.5"
                              title={`Renomear pasta ${folder.nome}`}
                              aria-label={`Renomear pasta ${folder.nome}`}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedFolderId === folder.id) setSelectedFolderId(null);
                                onDeleteFolder(folder.id);
                              }}
                              className="text-zinc-400 hover:text-rose-400 p-0.5"
                              title={`Apagar pasta ${folder.nome}`}
                              aria-label={`Apagar pasta ${folder.nome}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid of Scenes (when 'scene' is active) or Tokens/Assets */}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
              {activeCategory === 'scene' ? (
                <>
                  {filteredScenes.map((scene) => {
                    const isCurrent = scene.id === activeSceneId;
                    const isRenamingThisScene = renamingSceneId === scene.id;

                    return (
                      <div
                        key={scene.id}
                        className={`group relative rounded-xl overflow-hidden border text-left transition-all flex flex-col justify-between ${
                          isCurrent
                            ? 'border-violet-500 ring-2 ring-violet-500/30 bg-[#252733]'
                            : 'border-zinc-800 bg-[#14151c] hover:border-zinc-600'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isGM) onSelectScene(scene.id);
                          }}
                          className="w-full text-left cursor-pointer"
                        >
                          <div className="h-20 w-full bg-zinc-900 overflow-hidden relative">
                            {scene.fundoUrl && (
                              <img
                                src={scene.fundoUrl}
                                alt={scene.nome}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            )}
                            {isCurrent && (
                              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-violet-600 text-[10px] font-bold text-white">
                                Ativo
                              </span>
                            )}
                          </div>
                        </button>

                        <div className="p-2 space-y-1.5">
                          {isRenamingThisScene && isGM ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                aria-label="Novo nome do mapa"
                                value={renameSceneText}
                                onChange={(e) => setRenameSceneText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSceneRenameSubmit(scene);
                                }}
                                autoFocus
                                className="w-full bg-[#14151c] border border-violet-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSceneRenameSubmit(scene)}
                                className="p-1 rounded bg-emerald-600 text-white"
                                title="Salvar nome do mapa"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-white truncate">
                              {scene.nome}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                            <span>
                              {scene.larguraQuadrados}×{scene.alturaQuadrados} ({scene.escalaUnidade})
                            </span>
                            <span>{scene.tamanhoGradePx}px</span>
                          </div>

                          {/* GM Actions for Scene: Rename, Edit Grid, Toggle Wall Collision, Delete Map */}
                          {isGM && (
                            <div className="pt-1 border-t border-zinc-800/80 space-y-1">
                              <button
                                type="button"
                                data-testid={`scene-card-wall-toggle-${scene.id}`}
                                onClick={() => {
                                  const nextActive = !scene.colisaoParedesAtiva;
                                  onUpdateSceneDimensions(
                                    scene.id,
                                    scene.larguraQuadrados,
                                    scene.alturaQuadrados,
                                    scene.tamanhoGradePx,
                                    {
                                      colisaoParedesAtiva: nextActive,
                                      paredes: scene.paredes || [],
                                    }
                                  );
                                }}
                                className={`w-full py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                                  scene.colisaoParedesAtiva
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                    : 'bg-zinc-800/90 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                }`}
                                title="Ativar/Desativar Colisão de Paredes, Portas e Luz Raycasting neste mapa"
                              >
                                <BrickWall className="w-3 h-3" />
                                {scene.colisaoParedesAtiva
                                  ? `Paredes & Portas: ON (${(scene.paredes || []).length})`
                                  : 'Paredes & Portas: OFF'}
                              </button>
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRenamingSceneId(scene.id);
                                    setRenameSceneText(scene.nome);
                                  }}
                                  className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-medium text-zinc-200 flex items-center justify-center gap-1 cursor-pointer"
                                  title="Alterar nome do mapa"
                                  aria-label={`Alterar nome do mapa ${scene.nome}`}
                                >
                                  <Edit3 className="w-3 h-3" /> Nome
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditCurrentSceneModal(scene)}
                                  className="flex-1 py-1 px-1.5 rounded bg-zinc-800 hover:bg-violet-600 text-[10px] font-medium text-zinc-200 hover:text-white flex items-center justify-center gap-1 cursor-pointer"
                                  title="Editar tamanho, grade, paredes e portas do mapa"
                                  aria-label={`Editar mapa ${scene.nome}`}
                                >
                                  <Sliders className="w-3 h-3" /> Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteScene(scene.id)}
                                  className="p-1 rounded bg-zinc-800 hover:bg-rose-900/70 text-zinc-400 hover:text-rose-300 cursor-pointer"
                                  title="Apagar mapa"
                                  aria-label={`Apagar mapa ${scene.nome}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <>
                  {filteredAssets.map((asset) => {
                    const linkedSheet = asset.fichaPersonagemId
                      ? sheets.find((s) => s.id === asset.fichaPersonagemId)
                      : null;
                    const isEditingThisAsset = editingAssetId === asset.id;

                    return (
                      <div
                        key={asset.id}
                        className="group rounded-xl border border-zinc-800 bg-[#14151c] hover:border-zinc-600 p-2.5 flex flex-col justify-between transition-all"
                      >
                        {isEditingThisAsset && isGM ? (
                          <div className="space-y-1.5 text-xs">
                            <input
                              type="text"
                              aria-label="Editar nome do item"
                              value={editAssetName}
                              onChange={(e) => setEditAssetName(e.target.value)}
                              className="w-full bg-[#20222e] border border-violet-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              placeholder="Nome do token/item"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-zinc-400">Tam:</span>
                              <select
                                aria-label="Tamanho padrão na grade"
                                value={editAssetSquares}
                                onChange={(e) => setEditAssetSquares(Number(e.target.value) || 1)}
                                className="flex-1 bg-[#20222e] border border-zinc-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-white"
                              >
                                <option value={1}>1×1 (5ft)</option>
                                <option value={2}>2×2 (10ft)</option>
                                <option value={3}>3×3 (15ft)</option>
                                <option value={4}>4×4 (20ft)</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-1 pt-1">
                              <button
                                type="button"
                                onClick={() => handleSaveAssetEdit(asset)}
                                className="flex-1 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> Salvar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAssetId(null)}
                                className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5">
                              <img
                                src={asset.dataUrl}
                                alt={asset.nome}
                                className="w-11 h-11 rounded-lg object-cover bg-zinc-900 border border-zinc-700 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white truncate">
                                  {asset.nome}
                                </div>
                                <div className="text-[10px] text-zinc-400 font-mono">
                                  {asset.padraoQuadrados || 1}×{asset.padraoQuadrados || 1} ·{' '}
                                  {asset.larguraOriginal}×{asset.alturaOriginal}px
                                </div>
                                {linkedSheet && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenSheetById(linkedSheet.id)}
                                    className="mt-0.5 text-[10px] text-violet-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    Abrir Ficha 5e
                                  </button>
                                )}
                              </div>
                            </div>

                            {isGM ? (
                              <div className="mt-2.5 space-y-1.5">
                                <button
                                  type="button"
                                  onClick={() => onSpawnAssetToMap(asset)}
                                  className="w-full py-1.5 rounded-lg bg-[#252733] hover:bg-violet-600 text-zinc-200 hover:text-white text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                  Colocar no Mapa
                                </button>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditAsset(asset)}
                                    className="flex-1 py-1 px-2 rounded bg-zinc-800/90 hover:bg-zinc-700 text-[10px] font-medium text-zinc-300 hover:text-white flex items-center justify-center gap-1 cursor-pointer"
                                    title={`Editar ou alterar nome de ${asset.nome}`}
                                    aria-label={`Editar ${asset.nome}`}
                                  >
                                    <Edit3 className="w-3 h-3" /> Editar / Nome
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteAsset(asset.id)}
                                    className="p-1 rounded bg-zinc-800/90 hover:bg-rose-900/70 text-zinc-400 hover:text-rose-300 cursor-pointer"
                                    title={`Apagar ${asset.nome}`}
                                    aria-label={`Apagar ${asset.nome}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2.5 w-full py-1.5 rounded-lg bg-zinc-900 text-zinc-500 text-[11px] font-medium flex items-center justify-center gap-1">
                                <Lock className="w-3 h-3" /> Exclusivo do Mestre
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* Search Input Popover when Search Icon Clicked */}
        {showSearchInput && (
          <div className="mb-2 w-72 bg-[#1d1e26] border border-zinc-700 rounded-xl p-2 shadow-xl flex items-center gap-2 pointer-events-auto">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar mapas, tokens, objetos..."
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onChangeSearch('')}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Owlbear Rodeo Bottom Pill Bar with Group Separators */}
        <div
          className="bg-[#232530]/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl px-2.5 py-1.5 shadow-2xl flex items-center gap-1 pointer-events-auto"
          role="toolbar"
          aria-label="Barra Inferior de Recursos Owlbear"
        >
          {/* Search Button */}
          <button
            type="button"
            onClick={() => setShowSearchInput((prev) => !prev)}
            title="Buscar recursos"
            aria-label="Buscar recursos"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              showSearchInput
                ? 'bg-violet-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Group 1: Scenes, Props, Effects */}
          {DOCK_CATEGORIES.filter((c) => c.group === 1).map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(active ? null : cat.id)}
                title={cat.label}
                aria-label={cat.label}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          {/* Vertical Divider */}
          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Group 2: Mounts, Characters, Attachments */}
          {DOCK_CATEGORIES.filter((c) => c.group === 2).map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(active ? null : cat.id)}
                title={cat.label}
                aria-label={cat.label}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          {/* Vertical Divider */}
          <div className="w-px h-5 bg-zinc-700 mx-1" />

          {/* Group 3: Notes + Quick Upload Trigger (GM Only) */}
          {DOCK_CATEGORIES.filter((c) => c.group === 3).map((cat) => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(active ? null : cat.id)}
                title={cat.label}
                aria-label={cat.label}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          {isGM && (
            <>
              <div className="w-px h-5 bg-zinc-700 mx-1" />
              <button
                type="button"
                onClick={() => {
                  if (!activeCategory) onSelectCategory('character');
                  setCreatingFolder(true);
                }}
                title="Criar pasta ou importar ativo (Apenas Mestre)"
                aria-label="Criar pasta ou importar ativo"
                className="p-2 rounded-xl text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* FULL OWLBEAR RODEO STYLE "SCENES" MAP IMPORTER & AUTO-ASPECT GRID MODAL */}
      {isGM && sceneModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-label="Configurador de Cena e Grade Owlbear"
        >
          <form
            onSubmit={handleConfirmSceneModal}
            className="w-full max-w-5xl h-[82vh] max-h-[760px] bg-[#1e202b] border border-zinc-700/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row text-zinc-100"
          >
            {/* LEFT/CENTER INTERACTIVE PREVIEW WITH FLOATING AUTO-ASPECT BAR */}
            <div className="flex-1 bg-[#171821] relative flex flex-col overflow-hidden">
              {/* Top Header Bar inside Preview */}
              <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800/80 bg-[#1b1d27]">
                <div className="flex items-center gap-6">
                  <span className="text-xs font-bold uppercase tracking-widest text-violet-400 border-b-2 border-violet-500 pb-1">
                    {editingExistingSceneId ? 'EDITAR CENA' : 'NEW SCENE'}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    PROPORÇÃO AUTOMÁTICA OWLBEAR
                  </span>
                </div>
                <span className="text-lg font-bold text-white tracking-tight">Scenes</span>
              </div>

              {/* Owlbear Floating Top Dimension Pill: [|=] [T] -> Width 🔒 ↓ Height [↺] */}
              <div className="mt-4 mx-auto z-20 bg-[#262836]/95 border border-zinc-700/90 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-3">
                <span
                  className="text-xs font-mono text-zinc-400 flex items-center gap-1.5"
                  title="Alinhamento de colunas e linhas"
                >
                  <span>|≡</span>
                  <span>┬</span>
                </span>

                <div className="w-px h-4 bg-zinc-700" />

                {/* Width Input (→) */}
                <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-200">
                  <span className="text-zinc-400">→</span>
                  <input
                    type="number"
                    min={2}
                    max={200}
                    step={1}
                    aria-label="Largura do Mapa em Quadrados"
                    value={mapWidthSquares}
                    onChange={(e) => handleWidthSquaresChange(Number(e.target.value))}
                    className="w-16 bg-[#181922] border border-zinc-700 focus:border-violet-500 rounded-lg px-2 py-0.5 text-center font-mono font-bold text-white focus:outline-none"
                  />
                </label>

                {/* Lock Aspect Ratio Button (🔒 / 🔓) */}
                <button
                  type="button"
                  onClick={handleToggleAspectLock}
                  aria-label="Trancar Proporção Largura e Altura Automática"
                  title={
                    aspectLocked
                      ? 'Proporção Trancada: alterar a largura ajusta a altura automaticamente (Clique para destrancar)'
                      : 'Proporção Livre (Clique para trancar proporção automática)'
                  }
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    aspectLocked
                      ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {aspectLocked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Height Input (↓) */}
                <label className="flex items-center gap-1.5 text-xs font-mono text-zinc-200">
                  <span className="text-zinc-400">↓</span>
                  <input
                    type="number"
                    min={2}
                    max={200}
                    step={1}
                    aria-label="Altura do Mapa em Quadrados"
                    value={mapHeightSquares}
                    onChange={(e) => handleHeightSquaresChange(Number(e.target.value))}
                    className="w-16 bg-[#181922] border border-zinc-700 focus:border-violet-500 rounded-lg px-2 py-0.5 text-center font-mono font-bold text-white focus:outline-none"
                  />
                </label>

                <div className="w-px h-4 bg-zinc-700" />

                {/* Reset Dimensions Button (↺) */}
                <button
                  type="button"
                  onClick={handleResetDimensions}
                  title="Restaurar proporção original detectada"
                  className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Center Map Image + Live SVG Grid Overlay Preview */}
              <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
                <div
                  className="relative max-w-full max-h-full rounded-xl overflow-hidden shadow-2xl border border-zinc-700/80 bg-[#12131a]"
                  style={{
                    aspectRatio: `${mapWidthSquares} / ${mapHeightSquares}`,
                    width: 'min(100%, 560px)',
                  }}
                >
                  {sceneBgDataUrl ? (
                    <img
                      src={sceneBgDataUrl}
                      alt={sceneName}
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
                      Grade Tática ({mapWidthSquares} × {mapHeightSquares})
                    </div>
                  )}

                  {/* Live Grid Overlay */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${mapWidthSquares * 20} ${mapHeightSquares * 20}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <pattern
                        id="owlbear-preview-grid"
                        width={20}
                        height={20}
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 20 0 L 0 0 0 20"
                          fill="none"
                          stroke={gridColor}
                          strokeOpacity={gridOpacity}
                          strokeWidth={Math.max(0.5, gridLineWidthPx * 0.45)}
                          strokeDasharray={
                            lineType === 'dashed'
                              ? '4,3'
                              : lineType === 'dotted'
                                ? '1.5,2.5'
                                : undefined
                          }
                        />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#owlbear-preview-grid)" />
                  </svg>
                </div>
              </div>

              {/* Bottom Helper Pill inside Preview */}
              <div className="mb-4 mx-auto bg-[#262836]/95 border border-zinc-700/80 rounded-full px-4 py-1.5 text-[11px] text-zinc-300 font-mono flex items-center gap-2 shadow-xl">
                <span>
                  {mapWidthSquares} × {mapHeightSquares} quadrados
                </span>
                <span>·</span>
                <span className="text-violet-300">
                  {aspectLocked ? '🔒 Altura/Largura Automática Ativa' : '🔓 Proporção Manual'}
                </span>
              </div>
            </div>

            {/* RIGHT SIDEBAR CONTROLS (EXACT OWLBEAR SCENE CONTROLS) */}
            <div className="w-full md:w-80 bg-[#222430] border-l border-zinc-800 p-5 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={sceneName}
                    onChange={(e) => setSceneName(e.target.value)}
                    placeholder="Nome do Mapa..."
                    className="w-full bg-[#171821] border border-violet-500/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                {/* Lossless Quality Bar */}
                <div className="bg-[#171821] border border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">Qualidade Original</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px]">
                      Sem Perda (100%)
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-400">lossless {sceneFileSizeKb} kB</span>
                    <span className="text-amber-400">resolução nativa</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" />
                </div>

                {/* Grid Controls Section */}
                <div className="space-y-3 pt-1 border-t border-zinc-800">
                  <div className="text-xs font-bold text-zinc-200">Grid Controls</div>

                  {/* Color & Opacity */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1.5">Color</span>
                      <div className="flex items-center gap-2">
                        {[
                          { c: '#000000', label: 'Preto' },
                          { c: '#ffffff', label: 'Branco' },
                          { c: '#f97316', label: 'Laranja' },
                          { c: '#a855f7', label: 'Arcano' },
                        ].map((item) => (
                          <button
                            key={item.c}
                            type="button"
                            onClick={() => setGridColor(item.c)}
                            title={item.label}
                            style={{ backgroundColor: item.c }}
                            className={`w-5 h-5 rounded-full border cursor-pointer ${
                              gridColor === item.c
                                ? 'ring-2 ring-violet-400 border-white scale-110'
                                : 'border-zinc-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1.5">
                        Opacity ({Math.round(gridOpacity * 100)}%)
                      </span>
                      <input
                        type="range"
                        min={0.05}
                        max={0.9}
                        step={0.05}
                        value={gridOpacity}
                        onChange={(e) => setGridOpacity(Number(e.target.value))}
                        className="w-full accent-violet-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Grid Size, Line Width & Snapping */}
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Grid Size</label>
                      <input
                        type="text"
                        value={gridScaleLabel}
                        onChange={(e) => setGridScaleLabel(e.target.value)}
                        className="w-full bg-[#171821] border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Line Width</label>
                      <div className="flex items-center bg-[#171821] border border-zinc-700 rounded-xl px-2 py-1.5">
                        <input
                          type="number"
                          min={1}
                          max={6}
                          step={0.5}
                          value={gridLineWidthPx}
                          onChange={(e) => setGridLineWidthPx(Number(e.target.value) || 2)}
                          className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                        />
                        <span className="text-[10px] text-zinc-500 font-mono">px</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-400 mb-1">Snapping</label>
                      <button
                        type="button"
                        onClick={() => setSnappingEnabled((p) => !p)}
                        className={`w-full py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                          snappingEnabled
                            ? 'bg-violet-600/30 border-violet-500 text-violet-200'
                            : 'bg-[#171821] border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {snappingEnabled ? 'Ligado' : 'Livre'}
                      </button>
                    </div>
                  </div>

                  {/* Grid Type & Line Type */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1">Grid Type</span>
                      <div className="grid grid-cols-4 bg-[#171821] p-1 rounded-xl border border-zinc-800 gap-1">
                        {(
                          [
                            { id: 'square', icon: Grid },
                            { id: 'hex-v', icon: Hexagon },
                            { id: 'hex-h', icon: Hexagon },
                            { id: 'iso', icon: Diamond },
                          ] as const
                        ).map((gt) => {
                          const GIcon = gt.icon;
                          return (
                            <button
                              key={gt.id}
                              type="button"
                              onClick={() => setGridType(gt.id)}
                              className={`p-1.5 rounded-lg flex items-center justify-center cursor-pointer ${
                                gridType === gt.id
                                  ? 'bg-zinc-700 text-white'
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                            >
                              <GIcon className="w-3.5 h-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-zinc-400 mb-1">Line Type</span>
                      <div className="grid grid-cols-3 bg-[#171821] p-1 rounded-xl border border-zinc-800 gap-1">
                        {(
                          [
                            { id: 'solid', label: '—' },
                            { id: 'dashed', label: '---' },
                            { id: 'dotted', label: '···' },
                          ] as const
                        ).map((lt) => (
                          <button
                            key={lt.id}
                            type="button"
                            onClick={() => setLineType(lt.id)}
                            className={`py-1 rounded-lg text-xs font-mono cursor-pointer ${
                              lineType === lt.id
                                ? 'bg-zinc-700 text-white'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {lt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Measurement */}
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Measurement</label>
                    <select
                      value={measurementMode}
                      onChange={(e) => setMeasurementMode(e.target.value)}
                      className="w-full bg-[#171821] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="Chessboard (D&D 5e)">Chessboard (D&D 5e)</option>
                      <option value="Euclidean">Euclidean (Real)</option>
                      <option value="Manhattan">Manhattan (Grade)</option>
                    </select>
                  </div>
                </div>

                {/* Fog Controls Section */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="text-xs font-bold text-zinc-200">Fog Controls</div>
                  <span className="block text-[11px] text-zinc-400">Filled (Névoa de Guerra)</span>
                  <div className="grid grid-cols-2 bg-[#171821] p-1 rounded-xl border border-zinc-800 gap-1">
                    <button
                      type="button"
                      onClick={() => setFogFilled(false)}
                      className={`py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer ${
                        !fogFilled
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Desligada
                    </button>
                    <button
                      type="button"
                      onClick={() => setFogFilled(true)}
                      className={`py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer ${
                        fogFilled
                          ? 'bg-violet-600 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <CloudFog className="w-3.5 h-3.5" /> Preenchida
                    </button>
                  </div>
                </div>

                {/* Manual Wall Collision & Interactive Doors Section */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <BrickWall className="w-3.5 h-3.5" />
                      Colisão de Paredes & Portas
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {modalWalls.length} segs
                    </span>
                  </div>
                  <span className="block text-[10px] text-zinc-400 leading-relaxed">
                    Bloqueia passagem de tokens, luz e sombra nas paredes e portas fechadas desenhadas manualmente pelo Mestre.
                  </span>
                  <div className="grid grid-cols-2 bg-[#171821] p-1 rounded-xl border border-zinc-800 gap-1">
                    <button
                      type="button"
                      data-testid="scene-modal-wall-collision-off"
                      onClick={() => setWallCollisionEnabled(false)}
                      className={`py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer ${
                        !wallCollisionEnabled
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Desativado
                    </button>
                    <button
                      type="button"
                      data-testid="scene-modal-wall-collision-on"
                      onClick={() => setWallCollisionEnabled(true)}
                      className={`py-1.5 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer font-semibold ${
                        wallCollisionEnabled
                          ? 'bg-amber-500 text-zinc-950'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <BrickWall className="w-3.5 h-3.5" /> Ativado
                    </button>
                  </div>

                  {modalWalls.length > 0 && (
                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setModalWalls([])}
                        className="py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-rose-900/50 text-[10px] font-semibold text-zinc-300 hover:text-rose-300 cursor-pointer"
                        title="Limpar todas as paredes desta cena"
                      >
                        Limpar Paredes ({modalWalls.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Buttons (IMPORT / Cancel) */}
              <div className="pt-4 mt-4 border-t border-zinc-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSceneModalOpen(false)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                >
                  {editingExistingSceneId ? 'SALVAR GRADE' : 'IMPORT'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

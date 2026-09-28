'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from 'reactflow';
import {
  MlModelClientError,
  requestAdminMlModelInfo,
  requestAdminMlModelTree,
  type MlModelInfo,
  type MlModelTreeNode,
  type MlModelTreeStructure,
} from '@/services/mlModelClient';
import { formatRupiahId } from '@/lib/pricingQuoteUi';

const DEFAULT_DISPLAY_MAX_DEPTH = 3;
const DEFAULT_BASE_PRICE_PER_DAY_FOR_VISUAL = 500000;

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-3 border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function displayFeatureLabel(feature: string): string {
  return feature
    .replace(/^categorical__/, '')
    .replace(/^numerical__/, '')
    .replace(/_/g, ' ')
    .trim();
}

interface VisibleNodeInfo {
  node: MlModelTreeNode;
  collapsed: boolean;
  hiddenByCollapsedAncestor: boolean;
}

function buildVisibleMap(
  allNodes: MlModelTreeNode[],
  collapsedIds: Set<number>,
  maxDepth: number,
): Map<number, VisibleNodeInfo> {
  const byId = new Map<number, MlModelTreeNode>();
  for (const n of allNodes) byId.set(n.id, n);

  const visible = new Map<number, VisibleNodeInfo>();
  const stack: Array<{ id: number; hidden: boolean }> = allNodes.length > 0 ? [{ id: 0, hidden: false }] : [];

  while (stack.length) {
    const current = stack.pop()!;
    const node = byId.get(current.id);
    if (!node) continue;
    const hiddenByDepth = node.depth > maxDepth;
    const hidden = current.hidden || hiddenByDepth;

    const isCollapsed = !node.is_leaf && (collapsedIds.has(node.id) || hiddenByDepth);
    visible.set(node.id, {
      node,
      collapsed: isCollapsed,
      hiddenByCollapsedAncestor: hidden,
    });

    if (!hidden && !isCollapsed && !node.is_leaf) {
      if (node.right != null) stack.push({ id: node.right, hidden: false });
      if (node.left != null) stack.push({ id: node.left, hidden: false });
    }
  }

  return visible;
}

function computeSubtreeLeafCount(
  allNodes: MlModelTreeNode[],
  nodeId: number,
  cache: Map<number, number>,
): number {
  const cached = cache.get(nodeId);
  if (cached != null) return cached;
  const node = allNodes[nodeId];
  if (!node) return 0;
  if (node.is_leaf) {
    cache.set(nodeId, 1);
    return 1;
  }
  const left = node.left != null ? computeSubtreeLeafCount(allNodes, node.left, cache) : 0;
  const right = node.right != null ? computeSubtreeLeafCount(allNodes, node.right, cache) : 0;
  const total = left + right;
  cache.set(nodeId, total);
  return total;
}

interface LayoutItem {
  x: number;
  y: number;
}

function layoutVisibleTree(
  allNodes: MlModelTreeNode[],
  visible: Map<number, VisibleNodeInfo>,
  horizontalGap = 230,
  verticalGap = 135,
): Map<number, LayoutItem> {
  const byId = new Map<number, MlModelTreeNode>();
  for (const n of allNodes) byId.set(n.id, n);

  const layout = new Map<number, LayoutItem>();
  let nextLeafX = 0;

  function visit(nodeId: number, depth: number): number {
    const info = visible.get(nodeId);
    if (!info || info.hiddenByCollapsedAncestor) return 0;
    const node = info.node;

    const y = depth * verticalGap + 40;

    if (node.is_leaf || info.collapsed) {
      const x = nextLeafX * horizontalGap + 120;
      layout.set(nodeId, { x, y });
      nextLeafX += 1;
      return 1;
    }

    const leftSpan = node.left != null ? visit(node.left, depth + 1) : 0;
    const rightSpan = node.right != null ? visit(node.right, depth + 1) : 0;
    const totalSpan = leftSpan + rightSpan || 1;

    const leftCenterX =
      node.left != null ? layout.get(node.left)?.x ?? nextLeafX * horizontalGap : 0;
    const rightCenterX =
      node.right != null
        ? layout.get(node.right)?.x ?? (nextLeafX - 1) * horizontalGap
        : leftCenterX;

    const x = totalSpan === 1 ? leftCenterX : (leftCenterX + rightCenterX) / 2;
    layout.set(nodeId, { x, y });
    return totalSpan;
  }

  if (byId.has(0)) {
    visit(0, 0);
  }

  return layout;
}

function computeVisualPrice(predictionPct: number): number {
  const raw = DEFAULT_BASE_PRICE_PER_DAY_FOR_VISUAL * (1 + predictionPct);
  const rounded = Math.round(raw / 1000) * 1000;
  return rounded;
}

function DecisionTreeExplorer({ treeStructure }: { treeStructure: MlModelTreeStructure }) {
  const stats = treeStructure.tree_statistics;
  const [maxDepth, setMaxDepth] = useState<number>(DEFAULT_DISPLAY_MAX_DEPTH);
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<Edge>([]);

  const { visibleNodes, layout } = useMemo(() => {
    const visible = buildVisibleMap(treeStructure.nodes, collapsedIds, maxDepth);
    const ly = layoutVisibleTree(treeStructure.nodes, visible);
    return { visibleNodes: visible, layout: ly };
  }, [treeStructure.nodes, collapsedIds, maxDepth]);

  const totalLeavesCache = useMemo(() => {
    const cache = new Map<number, number>();
    for (let i = treeStructure.nodes.length - 1; i >= 0; i--) {
      computeSubtreeLeafCount(treeStructure.nodes, i, cache);
    }
    return cache;
  }, [treeStructure.nodes]);

  useEffect(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (const [id, info] of visibleNodes.entries()) {
      if (info.hiddenByCollapsedAncestor) continue;
      const pos = layout.get(id);
      if (!pos) continue;
      const node = info.node;
      const subtreeLeaves = totalLeavesCache.get(id) ?? 0;

      if (node.is_leaf) {
        const price = computeVisualPrice(node.prediction ?? 0);
        const pct = node.prediction ?? 0;
        const signClass =
          pct > 0.01 ? 'text-emerald-700 dark:text-emerald-300' :
          pct < -0.01 ? 'text-rose-700 dark:text-rose-300' :
          'text-slate-700 dark:text-slate-300';
        nodes.push({
          id: String(id),
          type: 'default',
          position: { x: pos.x - 95, y: pos.y - 42 },
          targetPosition: Position.Top,
          data: {
            label: (
              <div className="w-[190px] text-center font-mono">
                <div className="mb-1 flex items-center justify-center gap-2 text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <span>leaf #{node.id}</span>
                  <span>|</span>
                  <span>depth {node.depth}</span>
                </div>
                <p className={`text-sm font-black ${signClass}`}>value = {pct >= 0 ? '+' : ''}{(pct * 100).toFixed(2)}%</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  contoh: {formatRupiahId(price)}/hari
                </p>
              </div>
            ),
          },
          style: {
            borderRadius: 999,
            border: '2px solid #16a34a',
            background: '#f0fdf4',
            boxShadow: 'none',
            color: '#0f172a',
            width: 210,
          },
          draggable: false,
        });
      } else {
        const isCollapsed = info.collapsed;
        const thresh = node.threshold ?? 0;
        const feat = node.feature ?? `feature[${node.feature_index ?? '?'}]`;
        nodes.push({
          id: String(id),
          type: 'default',
          position: { x: pos.x - 105, y: pos.y - 46 },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          data: {
            label: (
              <div
                className="w-[210px] cursor-pointer select-none font-mono"
                onClick={() => {
                  setCollapsedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-300 pb-1 text-[9px] font-bold uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  <span>node #{node.id}</span>
                  <span>depth {node.depth}</span>
                </div>
                <p className="break-words text-center text-[12px] font-black leading-snug text-slate-950 dark:text-white">
                  {displayFeatureLabel(feat)}
                  <span className="mx-1 text-slate-500">&lt;=</span>
                  <span className="text-amber-600 dark:text-amber-300">
                    {Number.isInteger(thresh) ? thresh.toFixed(0) : thresh.toFixed(4)}
                  </span>
                </p>
                <p className="mt-1 truncate text-center text-[9px] text-slate-500 dark:text-slate-400">{feat}</p>
                <div className="mt-2 flex items-center justify-center gap-1 text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <span>{isCollapsed ? `${subtreeLeaves} leaves hidden` : `${subtreeLeaves} leaves`}</span>
                  <span className="material-symbols-outlined text-[12px]">
                    {isCollapsed ? 'add_circle' : 'remove_circle'}
                  </span>
                </div>
              </div>
            ),
          },
          style: {
            borderRadius: 3,
            border: '2px solid #2563eb',
            background: '#eff6ff',
            boxShadow: 'none',
            color: '#0f172a',
            width: 230,
          },
          draggable: false,
        });
      }

      if (!node.is_leaf && !info.collapsed && !info.hiddenByCollapsedAncestor) {
        if (node.left != null) {
          const leftInfo = visibleNodes.get(node.left);
          if (leftInfo && !leftInfo.hiddenByCollapsedAncestor) {
            edges.push({
              id: `e-${id}-L-${node.left}`,
              source: String(id),
              target: String(node.left),
              type: 'smoothstep',
              label: 'True',
              labelStyle: { fill: '#059669', fontWeight: 700, fontSize: 11 },
              labelBgStyle: { fill: '#ecfdf5', fillOpacity: 1 },
              labelBgPadding: [6, 4],
              style: { stroke: '#10b981', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
              animated: false,
            });
          }
        }
        if (node.right != null) {
          const rightInfo = visibleNodes.get(node.right);
          if (rightInfo && !rightInfo.hiddenByCollapsedAncestor) {
            edges.push({
              id: `e-${id}-R-${node.right}`,
              source: String(id),
              target: String(node.right),
              type: 'smoothstep',
              label: 'False',
              labelStyle: { fill: '#b45309', fontWeight: 700, fontSize: 11 },
              labelBgStyle: { fill: '#fffbeb', fillOpacity: 1 },
              labelBgPadding: [6, 4],
              style: { stroke: '#f59e0b', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
              animated: false,
            });
          }
        }
      }
    }

    setRfNodes(nodes);
    setRfEdges(edges);
  }, [visibleNodes, layout, treeStructure.nodes, collapsedIds, maxDepth, totalLeavesCache, setRfNodes, setRfEdges]);

  const effectiveMaxDepth = Math.min(maxDepth, stats.max_depth);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tree Index</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">#{stats.tree_index}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">estimator ke-{stats.tree_index + 1} dari 500</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Max Depth Aktual</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{stats.max_depth}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Kedalaman tree ini</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Node</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{stats.node_count.toLocaleString('id-ID')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Seluruh node termasuk leaf</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Jumlah Leaf</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{stats.leaf_count.toLocaleString('id-ID')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Node terminal dengan prediksi</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tampilkan sampai depth
          </label>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            value={effectiveMaxDepth}
            onChange={(e) => {
              setCollapsedIds(new Set());
              setMaxDepth(Number(e.target.value));
            }}
          >
            {Array.from({ length: Math.min(stats.max_depth, 10) + 1 }, (_, i) => i).map((d) => (
              <option key={d} value={d}>
                Depth 0–{d}
              </option>
            ))}
            {stats.max_depth > 10 && (
              <option key="full" value={stats.max_depth}>
                Semua Depth (0–{stats.max_depth}) — perhatikan performa
              </option>
            )}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            onClick={() => {
              setCollapsedIds((prev) => {
                const next = new Set(prev);
                treeStructure.nodes.forEach((n) => {
                  if (!n.is_leaf) next.add(n.id);
                });
                return next;
              });
            }}
            type="button"
          >
            Collapse Semua
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow transition hover:bg-primary/90"
            onClick={() => setCollapsedIds(new Set())}
            type="button"
          >
            Expand Sesuai Depth
          </button>
        </div>
      </div>

      <div className="h-[700px] rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onRfNodesChange}
          onEdgesChange={onRfEdgesChange}
          fitView
          minZoom={0.05}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          {/* @ts-expect-error: reactflow BackgroundVariant accepts dots at runtime; ts defs vary by version */}
          <Background variant="dots" gap={20} size={1} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

function TreeSelector({
  currentIndex,
  maxIndex,
  loading,
  onChange,
}: {
  currentIndex: number;
  maxIndex: number;
  loading: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pilih Tree</span>
      <button
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        disabled={loading || currentIndex <= 0}
        onClick={() => onChange(Math.max(0, currentIndex - 1))}
        type="button"
      >
        <span className="material-symbols-outlined text-[18px] align-middle">chevron_left</span>
        Sebelumnya
      </button>

      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 dark:bg-primary/10">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Tree</span>
        <input
          className="w-20 rounded-md border border-primary/40 bg-white px-2 py-1 text-center font-mono text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-primary/30 dark:bg-slate-900 dark:text-white"
          disabled={loading}
          min={0}
          max={maxIndex}
          type="number"
          value={currentIndex}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10);
            if (Number.isInteger(v) && v >= 0 && v <= maxIndex) onChange(v);
          }}
        />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          / {maxIndex.toLocaleString('id-ID')}
        </span>
      </div>

      <button
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        disabled={loading || currentIndex >= maxIndex}
        onClick={() => onChange(Math.min(maxIndex, currentIndex + 1))}
        type="button"
      >
        Berikutnya
        <span className="material-symbols-outlined text-[18px] align-middle">chevron_right</span>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          disabled={loading}
          onClick={() => onChange(0)}
          type="button"
        >
          Tree #1 (Idx 0)
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          disabled={loading}
          onClick={() => onChange(Math.floor(maxIndex / 2))}
          type="button"
        >
          Tree Tengah
        </button>
        <button
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          disabled={loading}
          onClick={() => onChange(maxIndex)}
          type="button"
        >
          Tree Terakhir
        </button>
      </div>
    </div>
  );
}

function LoadingCard({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-primary/20 bg-primary/5 p-6 dark:bg-primary/10">
      <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
      <div>
        <p className="text-sm font-black text-slate-900 dark:text-white">Memuat data model…</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
}

function ErrorCard({ message, hint, onRetry }: { message: string; hint?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/30">
      <div className="flex items-start gap-4">
        <span className="material-symbols-outlined text-3xl text-red-600 dark:text-red-400">error</span>
        <div className="flex-1">
          <p className="text-sm font-black text-red-800 dark:text-red-200">Tidak dapat memuat data model Random Forest</p>
          <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{message}</p>
          {hint ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{hint}</p> : null}
          {onRetry ? (
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-black text-white transition hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700"
              onClick={onRetry}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Coba Lagi
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function RandomForestModelClient() {
  const [state, setState] = useState<{
    infoLoading: boolean;
    treeLoading: boolean;
    error: string | null;
    hint: string | null;
    modelInfo: MlModelInfo | null;
    treeStructure: MlModelTreeStructure | null;
    treeIndex: number;
  }>({
    infoLoading: true,
    treeLoading: true,
    error: null,
    hint: null,
    modelInfo: null,
    treeStructure: null,
    treeIndex: 0,
  });

  const maxTreeIndex = state.modelInfo ? state.modelInfo.n_estimators - 1 : 499;
  const modelInfoRef = useRef<MlModelInfo | null>(null);

  const loadAll = useCallback(async (treeIdx: number) => {
    setState((prev) => ({ ...prev, infoLoading: !prev.modelInfo, treeLoading: true, error: null, hint: null }));
    try {
      const cachedModelInfo = modelInfoRef.current;
      const [info, tree] = await Promise.all([
        cachedModelInfo ? Promise.resolve(cachedModelInfo) : requestAdminMlModelInfo(),
        requestAdminMlModelTree(treeIdx),
      ]);
      modelInfoRef.current = info;
      setState((prev) => ({
        ...prev,
        modelInfo: info,
        treeStructure: tree,
        treeIndex: treeIdx,
        infoLoading: false,
        treeLoading: false,
        error: null,
        hint: null,
      }));
    } catch (err) {
      let message = 'Terjadi kesalahan tidak diketahui saat menghubungi ML service.';
      let hint: string | null =
        'Pastikan FastAPI ML service sudah berjalan (uvicorn di dalam web-app/ml-service) dan environment ML_SERVICE_BASE_URL pada Next.js sudah diatur.';
      if (err instanceof MlModelClientError) {
        if (err.code === 'ML_SERVICE_UNAVAILABLE') {
          message = 'ML service tidak tersedia atau request timeout.';
        } else if (err.code === 'ML_MODEL_NOT_READY') {
          message = 'Model artifact belum siap pada ML service.';
          hint = 'Periksa log startup FastAPI untuk melihat error load model (.pkl / metadata).';
        } else if (err.code === 'ML_TREE_INDEX_INVALID') {
          message = `Tree index tidak valid: ${err.message}`;
          hint = null;
        } else if (err.code === 'ML_CONTRACT_MISMATCH') {
          message = `Response ML tidak sesuai kontrak: ${err.message}`;
          hint = 'Periksa versi ML service vs frontend client.';
        } else if (err.code === 'AUTHENTICATION_REQUIRED' || err.code === 'ADMIN_AUTHORIZATION_REQUIRED') {
          message = err.message;
          hint = null;
        } else {
          message = err.message;
        }
      }
      setState((prev) => ({ ...prev, infoLoading: false, treeLoading: false, error: message, hint }));
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAll(0);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAll]);

  if (state.infoLoading && !state.modelInfo) {
    return <LoadingCard message="Menyiapkan info model Random Forest dan Decision Tree pertama dari FastAPI." />;
  }

  if (state.error && !state.modelInfo) {
    return (
      <ErrorCard
        hint={state.hint ?? undefined}
        message={state.error}
        onRetry={() => loadAll(state.treeIndex)}
      />
    );
  }

  const info = state.modelInfo;
  if (!info) return null;

  return (
    <div className="space-y-6">
      {state.error ? (
        <ErrorCard
          hint={state.hint ?? undefined}
          message={state.error}
          onRetry={() => loadAll(state.treeIndex)}
        />
      ) : null}

      <SectionCard
           title="Decision Tree Explorer"
      >
        <div className="space-y-5">
          <TreeSelector
            currentIndex={state.treeIndex}
            loading={state.treeLoading}
            maxIndex={maxTreeIndex}
            onChange={(next) => loadAll(next)}
          />

          {state.treeLoading ? (
            <LoadingCard message={`Memuat struktur Decision Tree #${state.treeIndex} dari ML service. Tree besar bisa memuat ~10.000 node.`} />
          ) : state.treeStructure ? (
            <DecisionTreeExplorer treeStructure={state.treeStructure} />
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { CatalogTool, Flow, FlowDefinition, FlowNode } from "@/types";

type Props = {
  orgId: string;
  projectId: string;
  flowId: string | null;
  onBack: () => void;
  onSaved: (flow: Flow) => void;
};

const EMPTY_DEF: FlowDefinition = {
  initial_node: "start",
  nodes: {
    start: {
      name: "start",
      role_message: "",
      task_messages: [{ role: "system", content: "Greet the user and ask how you can help." }],
      functions: [],
      respond_immediately: true,
      position: { x: 120, y: 80 },
    },
  },
};

function edgeDefaults(partial: Partial<Edge> & Pick<Edge, "id" | "source" | "target">): Edge {
  return {
    ...partial,
    type: "smoothstep",
    animated: true,
    label: partial.label ?? "next",
    data: { description: (partial.data as { description?: string } | undefined)?.description ?? "" },
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    style: { strokeWidth: 2 },
    deletable: true,
    selectable: true,
    focusable: true,
  };
}

function toGraph(definition: FlowDefinition): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(definition.nodes).map(([id, node], index) => ({
    id,
    position: node.position ?? { x: 80 + (index % 3) * 220, y: 80 + Math.floor(index / 3) * 140 },
    data: { label: node.name || id },
    deletable: true,
  }));
  const edges: Edge[] = [];
  for (const [id, node] of Object.entries(definition.nodes)) {
    for (const fn of node.functions ?? []) {
      if (fn.kind === "transition" && fn.next_node) {
        edges.push(
          edgeDefaults({
            id: `${id}-${fn.next_node}-${fn.name ?? "next"}`,
            source: id,
            target: fn.next_node,
            label: fn.name ?? "next",
            data: { description: fn.description ?? "" },
          }),
        );
      }
    }
  }
  return { nodes, edges };
}

function applyGraph(definition: FlowDefinition, nodes: Node[], edges: Edge[]): FlowDefinition {
  const nextNodes: Record<string, FlowNode> = {};
  for (const rf of nodes) {
    const existing = definition.nodes[rf.id] ?? {
      name: rf.id,
      task_messages: [{ role: "system", content: rf.id }],
      functions: [],
      respond_immediately: true,
    };
    const toolFns = (existing.functions ?? []).filter((fn) => fn.kind === "tool");
    const transitions = edges
      .filter((e) => e.source === rf.id)
      .map((e) => ({
        kind: "transition" as const,
        name: String(e.label || `to_${e.target}`),
        description: String((e.data as { description?: string } | undefined)?.description || `Continue to ${e.target}`),
        next_node: e.target,
      }));
    nextNodes[rf.id] = {
      ...existing,
      name: existing.name || rf.id,
      position: rf.position,
      functions: [...transitions, ...toolFns],
    };
  }
  const initial = definition.initial_node in nextNodes ? definition.initial_node : (nodes[0]?.id ?? "start");
  return { initial_node: initial, nodes: nextNodes };
}

export function FlowBuilderPage({ orgId, projectId, flowId, onBack, onSaved }: Props) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner orgId={orgId} projectId={projectId} flowId={flowId} onBack={onBack} onSaved={onSaved} />
    </ReactFlowProvider>
  );
}

function FlowBuilderInner({ orgId, projectId, flowId, onBack, onSaved }: Props) {
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [selected, setSelected] = useState<Flow | null>(null);
  const [name, setName] = useState("New flow");
  const [definition, setDefinition] = useState<FlowDefinition>(EMPTY_DEF);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("start");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(Boolean(flowId));
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  function loadDefinition(next: FlowDefinition) {
    setDefinition(next);
    const graph = toGraph(next);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedNodeId(next.initial_node);
    setSelectedEdgeId(null);
  }

  useEffect(() => {
    api.listTools(orgId, { limit: 100 }).then((page) => setTools(page.items)).catch(() => {});
  }, [orgId]);

  useEffect(() => {
    if (!flowId) {
      setSelected(null);
      setName("New flow");
      loadDefinition(EMPTY_DEF);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getFlow(flowId)
      .then((found) => {
        setSelected(found);
        setName(found.name);
        loadDefinition(found.definition);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load flow"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, orgId, projectId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) =>
        addEdge(
          edgeDefaults({
            id: `${connection.source}-${connection.target}-${Date.now()}`,
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
            label: "next",
            data: { description: `Continue to ${connection.target}` },
          }),
          eds,
        ),
      );
      setSelectedEdgeId(null);
    },
    [setEdges],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges],
  );

  function addNode() {
    const id = `node_${Object.keys(definition.nodes).length + 1}`;
    const node: FlowNode = {
      name: id,
      task_messages: [{ role: "system", content: "Continue the conversation." }],
      functions: [],
      respond_immediately: true,
      position: { x: 160 + nodes.length * 24, y: 200 + nodes.length * 16 },
    };
    const nextDef = { ...definition, nodes: { ...definition.nodes, [id]: node } };
    const nextNodes = [...nodes, { id, position: node.position!, data: { label: id }, deletable: true }];
    loadDefinition(applyGraph(nextDef, nextNodes, edges));
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }

  function updateSelectedNode(patch: Partial<FlowNode>) {
    if (!selectedNodeId) return;
    const current = definition.nodes[selectedNodeId];
    if (!current) return;
    const updated = { ...current, ...patch };
    setDefinition({
      ...definition,
      nodes: { ...definition.nodes, [selectedNodeId]: updated },
    });
    if (patch.name !== undefined) {
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, label: patch.name } } : n)),
      );
    }
  }

  function updateSelectedEdge(patch: { label?: string; description?: string; target?: string }) {
    if (!selectedEdgeId) return;
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== selectedEdgeId) return e;
        return {
          ...e,
          label: patch.label ?? e.label,
          target: patch.target ?? e.target,
          data: {
            ...(e.data as object),
            description: patch.description ?? (e.data as { description?: string })?.description,
          },
        };
      }),
    );
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId || nodes.length <= 1) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const nextEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
    const { [selectedNodeId]: _removed, ...rest } = definition.nodes;
    const nextDef = applyGraph({ ...definition, nodes: rest }, nextNodes, nextEdges);
    loadDefinition(nextDef);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const nextDef = applyGraph(definition, nodes, edges);
      setDefinition(nextDef);
      const saved = selected
        ? await api.updateFlow(selected.id, { name, definition: nextDef })
        : await api.createFlow(orgId, projectId, { name, definition: nextDef });
      setSelected(saved);
      loadDefinition(saved.definition);
      onSaved(saved);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const selectedNode = selectedNodeId ? definition.nodes[selectedNodeId] : null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const attachedToolIds = useMemo(
    () => new Set((selectedNode?.functions ?? []).filter((fn) => fn.kind === "tool").map((fn) => fn.tool_id)),
    [selectedNode],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Loading flow builder…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onBack} aria-label="Back to flows">
          <ArrowLeft className="h-4 w-4" />
          Flows
        </Button>
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="sr-only">Flow name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 max-w-md font-medium"
            aria-label="Flow name"
          />
        </div>
        <Button variant="outline" className="cursor-pointer" onClick={addNode}>
          Add node
        </Button>
        <Button className="cursor-pointer" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedFlash ? <Check className="h-4 w-4" /> : null}
          {saving ? "Saving…" : savedFlash ? "Saved" : selected ? "Save flow" : "Create flow"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mx-4 mt-3 sm:mx-6" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_300px]">
        <div className="relative min-h-[420px] border-b border-border xl:border-b-0 xl:border-r">
          <ReactFlow
            className="h-full bg-muted/20"
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            edgesReconnectable
            edgesFocusable
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
            onNodeClick={(_e, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_e, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => {
              setSelectedEdgeId(null);
            }}
            fitView
          >
            <Background gap={18} size={1} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
            Drag between nodes to connect · click a path to edit · Delete/Backspace removes selection
          </p>
        </div>

        <aside className="min-h-0 overflow-y-auto p-4">
          {selectedEdge ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Transition path</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Edit the function name, description, or destination. Drag the path ends on the canvas to reconnect.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={String(selectedEdge.label ?? "")}
                  onChange={(e) => updateSelectedEdge({ label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  value={String((selectedEdge.data as { description?: string } | undefined)?.description ?? "")}
                  onChange={(e) => updateSelectedEdge({ description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>From</Label>
                <Input value={selectedEdge.source} disabled />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Select value={selectedEdge.target} onValueChange={(v) => updateSelectedEdge({ target: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes
                      .filter((n) => n.id !== selectedEdge.source)
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {String(n.data.label || n.id)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="w-full cursor-pointer" onClick={deleteSelectedEdge}>
                <Trash2 className="h-4 w-4" />
                Delete path
              </Button>
            </div>
          ) : selectedNode && selectedNodeId ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Node</h3>
                <p className="mt-1 text-xs text-muted-foreground">Role, task, tools, and start node.</p>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={selectedNode.name} onChange={(e) => updateSelectedNode({ name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role message</Label>
                <Textarea
                  rows={3}
                  value={selectedNode.role_message ?? ""}
                  onChange={(e) => updateSelectedNode({ role_message: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Task</Label>
                <Textarea
                  rows={4}
                  value={selectedNode.task_messages?.[0]?.content ?? ""}
                  onChange={(e) =>
                    updateSelectedNode({
                      task_messages: [{ role: "system", content: e.target.value }],
                    })
                  }
                />
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedNode.respond_immediately !== false}
                  onCheckedChange={(v) => updateSelectedNode({ respond_immediately: v === true })}
                />
                Respond immediately
              </label>
              <div className="space-y-2">
                <Label>Initial node</Label>
                <Select
                  value={definition.initial_node}
                  onValueChange={(v) => setDefinition({ ...definition, initial_node: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(definition.nodes).map((id) => (
                      <SelectItem key={id} value={id}>
                        {definition.nodes[id].name || id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Catalog tools</Label>
                {tools.length === 0 && <p className="text-xs text-muted-foreground">No tools in the org catalog.</p>}
                {tools.map((tool) => {
                  const checked = attachedToolIds.has(tool.id);
                  return (
                    <label key={tool.id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const current = selectedNode.functions ?? [];
                          const next =
                            v === true
                              ? [...current, { kind: "tool" as const, tool_id: tool.id }]
                              : current.filter((fn) => !(fn.kind === "tool" && fn.tool_id === tool.id));
                          updateSelectedNode({ functions: next });
                        }}
                      />
                      {tool.name}
                    </label>
                  );
                })}
              </div>
              <Button
                variant="outline"
                className="w-full cursor-pointer"
                disabled={nodes.length <= 1}
                onClick={deleteSelectedNode}
              >
                <Trash2 className="h-4 w-4" />
                Delete node
              </Button>
              {selected && (
                <Button
                  variant="outline"
                  className="w-full cursor-pointer text-destructive"
                  onClick={() =>
                    void api.archiveFlow(selected.id).then(() => {
                      onBack();
                    })
                  }
                >
                  Archive flow
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a node or a connecting path on the canvas.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

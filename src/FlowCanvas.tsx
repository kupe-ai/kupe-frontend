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
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { CatalogTool, FlowDefinition, FlowNode } from "@/types";

type Props = {
  orgId: string;
  definition: FlowDefinition;
  onChange: (next: FlowDefinition) => void;
};

export const EMPTY_FLOW: FlowDefinition = {
  initial_node: "start",
  nodes: {},
};

export const STARTER_FLOW: FlowDefinition = {
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
            label: fn.name || "next",
            data: { description: fn.description || "" },
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
      task_messages: [{ role: "system", content: "Continue the conversation." }],
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

export function FlowCanvas({ orgId, definition, onChange }: Props) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner orgId={orgId} definition={definition} onChange={onChange} />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner({ orgId, definition, onChange }: Props) {
  const [tools, setTools] = useState<CatalogTool[]>([]);
  const [localDef, setLocalDef] = useState<FlowDefinition>(definition);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    Object.keys(definition.nodes)[0] ?? null,
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  function loadDefinition(next: FlowDefinition) {
    setLocalDef(next);
    const graph = toGraph(next);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setSelectedNodeId(next.initial_node in next.nodes ? next.initial_node : Object.keys(next.nodes)[0] ?? null);
    setSelectedEdgeId(null);
  }

  useEffect(() => {
    api.listTools(orgId, { limit: 100 }).then((page) => setTools(page.items)).catch(() => {});
  }, [orgId]);

  useEffect(() => {
    loadDefinition(definition);
    // Mount / remount only — parent bumps `key` on agent load / revert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(next: FlowDefinition) {
    setLocalDef(next);
    onChange(next);
  }

  function flushGraph(nextNodes = nodes, nextEdges = edges, base = localDef) {
    const next = applyGraph(base, nextNodes, nextEdges);
    loadDefinition(next);
    onChange(next);
  }

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      setEdges((eds) => {
        const next = addEdge(
          edgeDefaults({
            id: `${connection.source}-${connection.target}-${Date.now()}`,
            source: connection.source!,
            target: connection.target!,
            sourceHandle: connection.sourceHandle ?? undefined,
            targetHandle: connection.targetHandle ?? undefined,
            label: "next",
            data: { description: `Continue to ${connection.target}` },
          }),
          eds,
        );
        queueMicrotask(() => flushGraph(nodes, next));
        return next;
      });
      setSelectedEdgeId(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, localDef, setEdges],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((eds) => {
        const next = reconnectEdge(oldEdge, newConnection, eds);
        queueMicrotask(() => flushGraph(nodes, next));
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, localDef, setEdges],
  );

  function addNode() {
    const id = `node_${Object.keys(localDef.nodes).length + 1}`;
    const node: FlowNode = {
      name: id,
      task_messages: [{ role: "system", content: "Continue the conversation." }],
      functions: [],
      respond_immediately: true,
      position: { x: 160 + nodes.length * 24, y: 200 + nodes.length * 16 },
    };
    const nextDef = { ...localDef, nodes: { ...localDef.nodes, [id]: node } };
    const nextNodes = [...nodes, { id, position: node.position!, data: { label: id }, deletable: true }];
    const applied = applyGraph(nextDef, nextNodes, edges);
    loadDefinition(applied);
    onChange(applied);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }

  function updateSelectedNode(patch: Partial<FlowNode>) {
    if (!selectedNodeId) return;
    const current = localDef.nodes[selectedNodeId];
    if (!current) return;
    const updated = { ...current, ...patch };
    const next = {
      ...localDef,
      nodes: { ...localDef.nodes, [selectedNodeId]: updated },
    };
    commit(next);
    if (patch.name !== undefined) {
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, label: patch.name } } : n)),
      );
    }
  }

  function updateSelectedEdge(patch: { label?: string; description?: string; target?: string }) {
    if (!selectedEdgeId) return;
    setEdges((eds) => {
      const next = eds.map((e) => {
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
      });
      queueMicrotask(() => flushGraph(nodes, next));
      return next;
    });
  }

  function deleteSelectedEdge() {
    if (!selectedEdgeId) return;
    const next = edges.filter((e) => e.id !== selectedEdgeId);
    setSelectedEdgeId(null);
    flushGraph(nodes, next);
  }

  function deleteSelectedNode() {
    if (!selectedNodeId || nodes.length <= 1) return;
    const nextNodes = nodes.filter((n) => n.id !== selectedNodeId);
    const nextEdges = edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId);
    const { [selectedNodeId]: _removed, ...rest } = localDef.nodes;
    const nextDef = applyGraph({ ...localDef, nodes: rest }, nextNodes, nextEdges);
    loadDefinition(nextDef);
    onChange(nextDef);
  }

  const selectedNode = selectedNodeId ? localDef.nodes[selectedNodeId] : null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const attachedToolIds = useMemo(
    () => new Set((selectedNode?.functions ?? []).filter((fn) => fn.kind === "tool").map((fn) => fn.tool_id)),
    [selectedNode],
  );

  const empty = Object.keys(localDef.nodes).length === 0;

  if (empty) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No conversation graph. The agent will run as a linear voice agent until you add one.
        </p>
        <Button
          variant="outline"
          className="cursor-pointer"
          onClick={() => {
            loadDefinition(STARTER_FLOW);
            onChange(STARTER_FLOW);
          }}
        >
          Add starter flow
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[520px] flex-col overflow-hidden rounded-md border border-border">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={addNode}>
          Add node
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            loadDefinition(EMPTY_FLOW);
            onChange(EMPTY_FLOW);
          }}
        >
          Clear flow
        </Button>
        <p className="ml-auto text-xs text-muted-foreground">Saved with the agent</p>
      </div>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[1fr_280px]">
        <div className="relative min-h-[360px] border-b border-border xl:border-b-0 xl:border-r">
          <ReactFlow
            className="h-full min-h-[360px] bg-muted/20"
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => {
              onNodesChange(changes);
            }}
            onNodeDragStop={() => flushGraph()}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              const removed = changes.some((c) => c.type === "remove");
              if (removed) {
                queueMicrotask(() => flushGraph());
              }
            }}
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
                  Edit the function name, description, or destination.
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
                  value={localDef.initial_node}
                  onValueChange={(v) => commit({ ...localDef, initial_node: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(localDef.nodes).map((id) => (
                      <SelectItem key={id} value={id}>
                        {localDef.nodes[id].name || id}
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a node or a connecting path on the canvas.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

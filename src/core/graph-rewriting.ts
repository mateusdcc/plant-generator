import { Diagnostics, type Diagnostic } from "./diagnostics";
import type { StructuredParameter } from "./symbols";

/** Node in a finite edge/node rewriting graph. @public */
export interface RewriteNode {
	readonly id: number;
	readonly label: string;
	readonly attributes: StructuredParameter;
}

/** Directed labeled graph edge. @public */
export interface RewriteEdge {
	readonly id: number;
	readonly source: number;
	readonly target: number;
	readonly label: string;
	readonly attributes: StructuredParameter;
}

/** Finite graph consumed by edge- or node-replacement systems. @public */
export interface RewriteGraph {
	readonly nodes: readonly RewriteNode[];
	readonly edges: readonly RewriteEdge[];
}

/** Local replacement subgraph with explicit contact ports. @public */
export interface GraphReplacement {
	readonly nodes: readonly RewriteNode[];
	readonly edges: readonly RewriteEdge[];
	readonly entryNodeId: number;
	readonly exitNodeId: number;
}

/** Edge-replacement production. @public */
export interface EdgeRewriteProduction {
	readonly id: string;
	readonly predecessorLabel: string;
	readonly replacement: GraphReplacement;
}

/** Node-replacement production. @public */
export interface NodeRewriteProduction {
	readonly id: string;
	readonly predecessorLabel: string;
	readonly replacement: GraphReplacement;
}

/** Validates node/edge IDs, references, and self-contained replacement ports. @public */
export function validateRewriteGraph(graph: RewriteGraph): readonly Diagnostic[] {
	const diagnostics = new Diagnostics();
	for (let index = 0; index < graph.nodes.size(); index++) {
		if (graph.nodes[index]?.id !== index)
			diagnostics.error("INVALID_GRAPH", `Rewrite node ${index} has a noncanonical id.`);
	}
	for (let index = 0; index < graph.edges.size(); index++) {
		const edge = graph.edges[index];
		if (edge === undefined) continue;
		if (edge.id !== index) diagnostics.error("INVALID_GRAPH", `Rewrite edge ${index} has a noncanonical id.`);
		if (graph.nodes[edge.source] === undefined || graph.nodes[edge.target] === undefined) {
			diagnostics.error("INVALID_GRAPH", `Rewrite edge ${edge.id} references a missing node.`);
		}
	}
	return diagnostics.all();
}

function findEdgeProduction(
	productions: readonly EdgeRewriteProduction[],
	label: string,
): EdgeRewriteProduction | undefined {
	for (const production of productions) if (production.predecessorLabel === label) return production;
	return undefined;
}

/**
 * Replaces every matching edge in parallel using entry/exit contact nodes.
 *
 * @remarks This implements the edge-rewriting distinction in Chapter 1,
 * Section 1.4.1 without coupling it to a turtle.
 * @public
 */
export function rewriteEdges(graph: RewriteGraph, productions: readonly EdgeRewriteProduction[]): RewriteGraph {
	const nodes = new Array<RewriteNode>();
	const edges = new Array<RewriteEdge>();
	for (const node of graph.nodes) nodes.push(node);
	for (const edge of graph.edges) {
		const production = findEdgeProduction(productions, edge.label);
		if (production === undefined) {
			edges.push({ ...edge, id: edges.size() });
			continue;
		}
		const remap: Record<number, number> = {};
		remap[production.replacement.entryNodeId] = edge.source;
		remap[production.replacement.exitNodeId] = edge.target;
		for (const localNode of production.replacement.nodes) {
			if (remap[localNode.id] !== undefined) continue;
			remap[localNode.id] = nodes.size();
			nodes.push({ ...localNode, id: nodes.size() });
		}
		for (const localEdge of production.replacement.edges) {
			const source = remap[localEdge.source];
			const target = remap[localEdge.target];
			assert(
				source !== undefined && target !== undefined,
				`production ${production.id} references an unmapped node`,
			);
			edges.push({ ...localEdge, id: edges.size(), source, target });
		}
	}
	return { nodes, edges };
}

function findNodeProduction(
	productions: readonly NodeRewriteProduction[],
	label: string,
): NodeRewriteProduction | undefined {
	for (const production of productions) if (production.predecessorLabel === label) return production;
	return undefined;
}

/** Replaces nodes in parallel, reconnecting incoming edges to entry ports and outgoing edges to exit ports. @public */
export function rewriteNodes(graph: RewriteGraph, productions: readonly NodeRewriteProduction[]): RewriteGraph {
	const nodes = new Array<RewriteNode>();
	const edges = new Array<RewriteEdge>();
	const entryMap: Record<number, number> = {};
	const exitMap: Record<number, number> = {};
	for (const original of graph.nodes) {
		const production = findNodeProduction(productions, original.label);
		if (production === undefined) {
			const id = nodes.size();
			nodes.push({ ...original, id });
			entryMap[original.id] = id;
			exitMap[original.id] = id;
			continue;
		}
		const localMap: Record<number, number> = {};
		for (const localNode of production.replacement.nodes) {
			localMap[localNode.id] = nodes.size();
			nodes.push({ ...localNode, id: nodes.size() });
		}
		const entry = localMap[production.replacement.entryNodeId];
		const exit = localMap[production.replacement.exitNodeId];
		assert(entry !== undefined && exit !== undefined, `production ${production.id} has invalid ports`);
		entryMap[original.id] = entry;
		exitMap[original.id] = exit;
		for (const localEdge of production.replacement.edges) {
			const source = localMap[localEdge.source];
			const target = localMap[localEdge.target];
			assert(
				source !== undefined && target !== undefined,
				`production ${production.id} references a missing local node`,
			);
			edges.push({ ...localEdge, id: edges.size(), source, target });
		}
	}
	for (const edge of graph.edges) {
		const source = exitMap[edge.source];
		const target = entryMap[edge.target];
		assert(source !== undefined && target !== undefined, "original edge references a missing node");
		edges.push({ ...edge, id: edges.size(), source, target });
	}
	return { nodes, edges };
}

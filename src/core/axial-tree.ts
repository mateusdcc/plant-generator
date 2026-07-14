import { Diagnostics, type Diagnostic } from "./diagnostics";
import type { ModuleSymbol, SymbolId } from "./symbols";

/** Node in an axial-tree view of a bracketed word. @public */
export interface AxialTreeNode {
	readonly id: number;
	readonly symbol: ModuleSymbol;
	readonly parentId?: number;
	readonly children: readonly number[];
	readonly depth: number;
	readonly sourceIndex: number;
}

/** Renderer-neutral axial tree plus its validation diagnostics. @public */
export interface AxialTree {
	readonly roots: readonly number[];
	readonly nodes: readonly AxialTreeNode[];
	readonly diagnostics: readonly Diagnostic[];
}

function sameId(a: SymbolId, b: SymbolId): boolean {
	return typeOf(a) === typeOf(b) && a === b;
}

/** Converts a bracketed word into explicit parent/lateral relationships. @public */
export function wordToAxialTree(
	word: readonly ModuleSymbol[],
	branchOpen: SymbolId = "[",
	branchClose: SymbolId = "]",
): AxialTree {
	const diagnostics = new Diagnostics();
	const mutableNodes = new Array<{
		id: number;
		symbol: ModuleSymbol;
		parentId?: number;
		children: number[];
		depth: number;
		sourceIndex: number;
	}>();
	const roots = new Array<number>();
	const stack = new Array<number>();
	let parentId: number | undefined;
	for (let index = 0; index < word.size(); index++) {
		const value = word[index];
		if (value === undefined) continue;
		if (sameId(value.id, branchOpen)) {
			stack.push(parentId ?? -1);
			continue;
		}
		if (sameId(value.id, branchClose)) {
			if (stack.size() === 0)
				diagnostics.error("UNBALANCED_BRANCH", "Branch pop has no matching push.", { symbolIndex: index });
			else {
				const restored = stack.pop();
				parentId = restored === -1 ? undefined : restored;
			}
			continue;
		}
		const nodeId = mutableNodes.size();
		const parent = parentId === undefined ? undefined : mutableNodes[parentId];
		const node = {
			id: nodeId,
			symbol: value,
			children: new Array<number>(),
			depth: parent === undefined ? 0 : parent.depth + 1,
			sourceIndex: index,
		};
		if (parentId !== undefined) {
			parent?.children.push(nodeId);
			mutableNodes.push({ ...node, parentId });
		} else {
			mutableNodes.push(node);
			roots.push(nodeId);
		}
		parentId = nodeId;
	}
	if (stack.size() > 0) diagnostics.error("UNBALANCED_BRANCH", "Word ends with open branches.");
	return { roots, nodes: mutableNodes, diagnostics: diagnostics.all() };
}

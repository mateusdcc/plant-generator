/** Severity of a structured generation diagnostic. @public */
export type DiagnosticSeverity = "info" | "warning" | "error";

/** Stable diagnostic codes suitable for automated handling. @public */
export type DiagnosticCode =
	| "INVALID_GRAMMAR"
	| "INVALID_WEIGHT"
	| "INVALID_PARAMETER"
	| "AMBIGUOUS_PRODUCTION"
	| "UNBALANCED_BRANCH"
	| "UNKNOWN_SYMBOL"
	| "UNKNOWN_REGISTRY_ID"
	| "UNSUPPORTED_SCHEMA_VERSION"
	| "LIMIT_ITERATIONS"
	| "LIMIT_SYMBOLS"
	| "LIMIT_STACK"
	| "LIMIT_SEGMENTS"
	| "LIMIT_ORGANS"
	| "LIMIT_VERTICES"
	| "LIMIT_TRIANGLES"
	| "LIMIT_WORK"
	| "LIMIT_INSTANCES"
	| "CANCELLED"
	| "INVALID_GRAPH"
	| "INVALID_MESH"
	| "UNSUPPORTED_CAPABILITY"
	| "POOL_EXHAUSTED";

/** Location attached to a diagnostic where known. @public */
export interface DiagnosticLocation {
	readonly productionId?: string;
	readonly symbolIndex?: number;
	readonly path?: string;
}

/** Structured non-throwing validation or generation report. @public */
export interface Diagnostic {
	readonly code: DiagnosticCode;
	readonly severity: DiagnosticSeverity;
	readonly message: string;
	readonly location?: DiagnosticLocation;
}

/** Receives diagnostics without requiring event allocation when omitted. @public */
export interface DiagnosticsListener {
	/** Receives a diagnostic immediately after it is recorded. */
	onDiagnostic(diagnostic: Diagnostic): void;
}

/** Mutable collector used at orchestration boundaries. @public */
export class Diagnostics {
	private readonly values = new Array<Diagnostic>();

	public constructor(private readonly listener?: DiagnosticsListener) {}

	/** Records and synchronously publishes an existing diagnostic. */
	public add(diagnostic: Diagnostic): void {
		this.values.push(diagnostic);
		this.listener?.onDiagnostic(diagnostic);
	}

	/** Records an informational diagnostic. */
	public info(code: DiagnosticCode, message: string, location?: DiagnosticLocation): void {
		this.add(
			location === undefined
				? { code, severity: "info", message }
				: { code, severity: "info", message, location },
		);
	}

	/** Records a recoverable warning diagnostic. */
	public warn(code: DiagnosticCode, message: string, location?: DiagnosticLocation): void {
		this.add(
			location === undefined
				? { code, severity: "warning", message }
				: { code, severity: "warning", message, location },
		);
	}

	/** Records an error diagnostic. */
	public error(code: DiagnosticCode, message: string, location?: DiagnosticLocation): void {
		this.add(
			location === undefined
				? { code, severity: "error", message }
				: { code, severity: "error", message, location },
		);
	}

	/** Returns the collector's stable insertion-ordered diagnostics. */
	public all(): readonly Diagnostic[] {
		return this.values;
	}

	/** Reports whether any recorded diagnostic has error severity. */
	public hasErrors(): boolean {
		for (const diagnostic of this.values) if (diagnostic.severity === "error") return true;
		return false;
	}
}

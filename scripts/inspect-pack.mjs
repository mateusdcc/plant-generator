import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";

const packed = JSON.parse(execFileSync("npm", ["pack", "--json"], { encoding: "utf8" }));
const filename = packed[0]?.filename;
if (!filename) throw new Error("npm pack did not report a filename");
try {
	const listing = execFileSync("tar", ["-tzf", filename], { encoding: "utf8" }).trim().split("\n");
	const required = [
		"package/out/init.luau",
		"package/out/index.d.ts",
		"package/README.md",
		"package/LICENSE",
		"package/NOTICE.md",
	];
	for (const entry of required) if (!listing.includes(entry)) throw new Error(`packed package is missing ${entry}`);
	const forbidden = listing.filter(
		(entry) =>
			/\.(pdf|tsbuildinfo)$/i.test(entry) ||
			entry.startsWith("package/src/") ||
			entry.startsWith("package/tests/") ||
			entry.startsWith("package/tmp/"),
	);
	if (forbidden.length > 0) throw new Error(`packed package contains forbidden files: ${forbidden.join(", ")}`);
	process.stdout.write(
		`Verified ${filename}: ${listing.length} intended files; no PDF/source/test/temp artifacts.\n`,
	);
} finally {
	unlinkSync(filename);
}

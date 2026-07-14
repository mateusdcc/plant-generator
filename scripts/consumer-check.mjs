import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const fixture = resolve(root, "tmp/consumer-fixture");
rmSync(fixture, { recursive: true, force: true });
mkdirSync(resolve(fixture, "src"), { recursive: true });
const packed = JSON.parse(execFileSync("npm", ["pack", "--json"], { cwd: root, encoding: "utf8" }));
const filename = packed[0]?.filename;
if (!filename) throw new Error("npm pack did not report a filename");
const tarball = resolve(root, filename);
try {
	writeFileSync(
		resolve(fixture, "package.json"),
		JSON.stringify(
			{
				name: "plant-generator-consumer-fixture",
				private: true,
				scripts: { build: "rbxtsc" },
				dependencies: { "@rbxts/plant-generator": `file:${tarball}` },
				devDependencies: {
					"@rbxts/compiler-types": "3.0.0-types.0",
					"@rbxts/types": "1.0.938",
					"roblox-ts": "3.0.0",
					typescript: "5.5.3",
				},
			},
			null,
			2,
		),
	);
	writeFileSync(
		resolve(fixture, "tsconfig.json"),
		JSON.stringify(
			{
				compilerOptions: {
					allowSyntheticDefaultImports: true,
					downlevelIteration: true,
					forceConsistentCasingInFileNames: true,
					module: "commonjs",
					moduleDetection: "force",
					moduleResolution: "Node",
					noLib: true,
					strict: true,
					target: "ESNext",
					typeRoots: ["node_modules/@rbxts"],
					rootDir: "src",
					outDir: "out",
				},
				include: ["src/**/*.ts"],
			},
			null,
			2,
		),
	);
	writeFileSync(
		resolve(fixture, "src/index.ts"),
		`import { PLANT_PRESETS, PlantCompiler, PlantGenerator } from "@rbxts/plant-generator";\nconst model = PlantCompiler.compile(PLANT_PRESETS.conifer!);\nexport const result = PlantGenerator.generate(model, { seed: 1, iterations: 2 });\n`,
	);
	writeFileSync(
		resolve(fixture, "default.project.json"),
		JSON.stringify(
			{
				name: "PlantGeneratorConsumerFixture",
				tree: {
					$className: "DataModel",
					ReplicatedStorage: {
						$className: "ReplicatedStorage",
						rbxts_include: { $path: "include" },
						node_modules: {
							$className: "Folder",
							"@rbxts": { $path: "node_modules/@rbxts" },
						},
						Fixture: { $path: "out" },
					},
				},
			},
			null,
			2,
		),
	);
	execFileSync("npm", ["install", "--ignore-scripts"], { cwd: fixture, stdio: "inherit" });
	execFileSync("npm", ["run", "build"], { cwd: fixture, stdio: "inherit" });
	const initOutput = resolve(fixture, "out/init.luau");
	const indexOutput = resolve(fixture, "out/index.luau");
	const output = readFileSync(existsSync(initOutput) ? initOutput : indexOutput, "utf8");
	if (!output.includes("plant-generator")) throw new Error("consumer output does not contain the package import");
	process.stdout.write("Clean tarball consumer installed and compiled through roblox-ts.\n");
} finally {
	rmSync(tarball, { force: true });
	rmSync(fixture, { recursive: true, force: true });
}

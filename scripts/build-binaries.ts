// Standalone binaries for the GitHub release: bun build --compile, cross-compiled from one machine.
// Each embeds the Bun runtime the target needs; the x64 one uses Bun's baseline build, which runs on
// CPUs without AVX2. The same source and Bun version give the same bytes, wherever they are built.
// Linux only, as netbeagle reads Linux's /proc and /sys (WSL included).
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const TARGETS: Record<string, string> = {
	"netbeagle-linux-x64": "bun-linux-x64-baseline",
	"netbeagle-linux-arm64": "bun-linux-arm64",
};

const out = process.argv[2] ?? join("dist", "bin");
mkdirSync(out, { recursive: true });
for (const [file, target] of Object.entries(TARGETS)) {
	const r = spawnSync(
		"bun",
		[
			"build",
			"src/cli.ts",
			"--compile",
			"--minify",
			`--target=${target}`,
			"--outfile",
			join(out, file),
		],
		{ stdio: "inherit" },
	);
	if (r.status !== 0) process.exit(r.status ?? 1);
}

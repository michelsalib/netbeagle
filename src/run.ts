// Runs a command and returns what it printed, or "" when it is missing: every reader copes with
// an empty answer. The exit status is not checked, as lsof exits 1 when one of its searches finds
// nothing, after printing the others. Tests pass their own, with recorded output.

import { spawnSync } from "node:child_process";

export type Run = (cmd: string, args: string[]) => string;

export const run: Run = (cmd, args) => {
	const r = spawnSync(cmd, args, {
		encoding: "utf8",
		timeout: 15000,
		maxBuffer: 64 * 1024 * 1024,
		windowsHide: true,
	});
	return r.error ? "" : (r.stdout ?? "");
};

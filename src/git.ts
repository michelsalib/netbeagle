// Which git checkout a directory is in, read from the files git keeps, without running git: a
// .git directory is a main checkout, a .git file pointing into .git/worktrees/ a linked worktree
// (git worktree add), and HEAD names the branch.

import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { GitCheckout } from "./model.ts";

const read = (path: string) => {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
};

/** The checkout holding `dir`, or undefined. `cache` saves walking up the same directories twice. */
export function checkoutOf(
	dir: string,
	cache = new Map<string, GitCheckout | undefined>(),
): GitCheckout | undefined {
	const seen: string[] = [];
	let d = resolve(dir);
	let found: GitCheckout | undefined;
	for (;;) {
		if (cache.has(d)) {
			found = cache.get(d);
			break;
		}
		seen.push(d);
		found = at(d);
		if (found) break;
		const up = dirname(d);
		if (up === d) break;
		d = up;
	}
	for (const s of seen) cache.set(s, found);
	return found;
}

/** The checkout whose top is `d`, if `d` has a .git. */
function at(d: string): GitCheckout | undefined {
	const dotgit = join(d, ".git");
	let gitdir: string;
	try {
		if (statSync(dotgit).isDirectory()) gitdir = dotgit;
		else {
			// "gitdir: /path/to/main/.git/worktrees/NAME", or a relative path
			const target = read(dotgit)?.match(/^gitdir:\s*(.+?)\s*$/m)?.[1];
			if (!target) return undefined;
			gitdir = isAbsolute(target) ? target : resolve(d, target);
		}
	} catch {
		return undefined;
	}
	const head = read(join(gitdir, "HEAD"));
	if (head === undefined) return undefined;
	return {
		root: d,
		branch: head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/m)?.[1],
		worktree: /[\\/]worktrees[\\/][^\\/]+[\\/]?$/.test(gitdir),
	};
}

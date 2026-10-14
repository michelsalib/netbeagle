// Where a process comes from, beyond its own working directory: the app that launched it (Claude
// Code, VS Code, Orca…), and the project it works for when its directory says nothing, as with a
// browser a Claude session started from its scratch folder, maybe after that worktree was removed.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { checkoutOf } from "./git.ts";
import type { GitCheckout, Process } from "./model.ts";

/** Apps that launch servers and browsers: an agent, an editor, a worktree manager. */
const APPS: [string, (p: Process) => boolean][] = [
	[
		"claude",
		(p) =>
			/^claude$/i.test(p.name) ||
			/anthropic\.claude-code|@anthropic-ai[\\/]claude-code/i.test(p.cmd),
	],
	["codex", (p) => /^codex$/i.test(p.name)],
	["cursor", (p) => /\.cursor-server|[\\/]cursor(\.exe)?(\s|$)/i.test(p.cmd)],
	[
		"VS Code",
		(p) =>
			/\.vscode-server|Microsoft VS Code|^code$/i.test(`${p.cmd} ${p.name}`),
	],
	[
		"Orca",
		(p) => /[\\/]\.?orca(-wsl)?[\\/]|^orca$/i.test(`${p.cmd} ${p.name}`),
	],
];

const appOf = (p: Process) => APPS.find(([, test]) => test(p))?.[0];

/** A Claude Code session's scratch folder: /tmp/claude-UID/<project path, encoded>/<session id>/… */
const SESSION =
	/[\\/]claude-\d+[\\/](-[^\\/]+)[\\/]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[\\/]|$)/i;

/** How Claude Code names a project: its path with every character but letters and digits as "-". */
const encode = (s: string) => s.replace(/[^A-Za-z0-9]/g, "-");

const dirs = (d: string) => {
	try {
		return readdirSync(d, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name);
	} catch {
		return [];
	}
};

/**
 * The directory an encoded project name stands for, found level by level among the directories that
 * exist. When it no longer exists, `missing` is what could not be found: the removed worktree's name.
 */
export function decodeProject(
	encoded: string,
	list: (dir: string) => string[] = dirs,
): { dir: string; missing?: string } {
	let dir = "/";
	let rest = encoded.replace(/^-/, "");
	while (rest) {
		// the longest entry that matches: "matchem-dp-infra" before "matchem-dp"
		const next = list(dir)
			.filter((e) => rest === encode(e) || rest.startsWith(`${encode(e)}-`))
			.sort((a, b) => b.length - a.length)[0];
		if (!next) return { dir, missing: rest };
		dir = join(dir, next);
		rest = rest.slice(encode(next).length + 1);
	}
	return { dir };
}

const exists = (d: string) => {
	try {
		return statSync(d).isDirectory();
	} catch {
		return false;
	}
};

/**
 * Sets each process's `app` (the nearest known app among itself and what started it, or the Claude
 * session whose scratch folder it runs in) and, when its own directory is in no checkout, its
 * `project`: the one of that Claude session, or of the nearest parent that has one.
 */
export function annotate(
	processes: Process[],
	cache = new Map<string, GitCheckout | undefined>(),
) {
	const by = new Map(processes.map((p) => [p.pid, p]));
	const parents = (p: Process) => {
		const out: Process[] = [];
		let q = p;
		while (q.ppid && q.ppid > 1 && !out.some((x) => x.pid === q.ppid)) {
			const up = by.get(q.ppid);
			if (!up || (p.uid !== undefined && up.uid !== p.uid)) break;
			out.push(up);
			q = up;
		}
		return out;
	};
	for (const p of processes) {
		const up = parents(p);
		const session = p.cwd?.match(SESSION);
		const app =
			[p, ...up].map(appOf).find(Boolean) ?? (session ? "claude" : undefined);
		if (app) p.app = app;
		if (p.git) continue;
		if (session?.[1]) {
			const { dir, missing } = decodeProject(session[1]);
			const git = !missing && exists(dir) ? checkoutOf(dir, cache) : undefined;
			p.project = git
				? { ...git, via: "session" }
				: {
						root: missing ? join(dir, missing) : dir,
						worktree: false,
						via: "session",
						...(missing && { removed: true }),
					};
			// launched by a session that is over: nothing of it is left above this process
			if (!up.some((x) => appOf(x) === "claude")) p.orphan = true;
			continue;
		}
		const parent = up.find((x) => x.git);
		if (parent?.git) p.project = { ...parent.git, via: "parent" };
	}
}

// What `netbeagle watch` draws: a header, the ports as a table, the selected one in detail, and
// the keys. Pure: lines of text from the state, cut to the terminal's width.

import {
	paint,
	place,
	placeParts,
	type RenderOptions,
	reachLabel,
	tilde,
} from "../format.ts";
import type { Process } from "../model.ts";
import { startedBy } from "../stop.ts";
import {
	MARK_MS,
	type Row,
	type State,
	selectedRow,
	targets,
	visible,
} from "./state.ts";

/** Lines the selected port's details take, always: its title and up to 9 more. */
export const DETAIL = 10;

/** PORT ("udp 65535"), PROCESS, WHERE, UP, CLIENTS; the last column takes what is left. */
const WIDTHS = [9, 20, 30, 4, 7];

/** Rows the table shows: what the header, the details and the keys leave. */
export const tableRoom = (height: number) => Math.max(3, height - 4 - DETAIL);

/** The first row shown: where the list was scrolled to, moved only as far as the selection needs. */
export function scrolled(s: State, room: number): number {
	const rows = visible(s);
	const at = Math.max(
		0,
		rows.findIndex((r) => r.key === selectedRow(s)?.key),
	);
	let top = Math.min(s.top, Math.max(0, rows.length - room));
	if (at < top) top = at;
	if (at >= top + room) top = at - room + 1;
	return Math.max(0, top);
}

/** "45s", "12m", "3h", "2d": how long ago `t` was. */
export function age(t: number | undefined, now: number): string {
	if (t === undefined) return "";
	const s = Math.max(0, Math.round((now - t) / 1000));
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.floor(s / 60)}m`;
	if (s < 86400) return `${Math.floor(s / 3600)}h`;
	return `${Math.floor(s / 86400)}d`;
}

/** Where a server runs: its container, or its process's checkout or directory. */
export function where(r: Row, home?: string): string {
	const l = r.listener;
	if (l.container) return `container ${l.container.name}`;
	return l.process ? place(l.process, home) : "";
}

/** `where` in `w` characters: a long checkout name is cut, its tags ("(removed) · claude") kept. */
function whereCell(r: Row, w: number, home?: string): string {
	const p = r.listener.process;
	if (r.listener.container || !p) return where(r, home);
	const { name, tags } = placeParts(p, home);
	if (!name || !tags) return name || tags;
	return `${cut(name, Math.max(4, w - tags.length - 1))} ${tags}`;
}

const ESC = "\x1b";

/** Characters a terminal shows: colour codes (ESC [ … m) left out. */
function visibleLength(s: string): number {
	let n = 0;
	for (let i = 0; i < s.length; i++) {
		if (s[i] === ESC) i = s.indexOf("m", i);
		else n++;
		if (i < 0) break;
	}
	return n;
}

/** `s` cut to `w` visible characters, its colour codes kept whole. */
export function cut(s: string, w: number): string {
	if (visibleLength(s) <= w) return s;
	let out = "";
	let shown = 0;
	for (let i = 0; i < s.length && shown < w - 1; i++) {
		if (s[i] === ESC) {
			const end = s.indexOf("m", i);
			out += s.slice(i, end + 1);
			i = end;
			continue;
		}
		out += s[i];
		shown++;
	}
	// a cut colour is closed; plain text stays plain
	return s.includes(ESC) ? `${out}…${ESC}[0m` : `${out}…`;
}
const pad = (s: string, w: number) => cut(s, w).padEnd(w);

export function render(
	s: State,
	width: number,
	height: number,
	o: RenderOptions & { now: number; home?: string },
): string[] {
	const c = paint(o);
	const rows = visible(s);
	const sel = selectedRow(s);
	const out: string[] = [];
	const head = s.snap
		? `${s.snap.hostname}  ${rows.length} port${rows.length === 1 ? "" : "s"}${s.filter ? ` matching "${s.filter}"` : ""}  updated ${age(s.updated, o.now)} ago`
		: "reading the machine…";
	out.push(cut(`${c.bold("netbeagle watch")}  ${c.dim(head)}`, width));

	// the table: as many rows as fit above the details, the selected one in view
	const cells = rows.map((r) => {
		const l = r.listener;
		const p = l.process;
		return [
			`${l.proto} ${l.port}`,
			p
				? `${p.name} ${p.pid}`
				: l.container
					? ""
					: `${l.user ?? "another user"}'s`,
			whereCell(r, WIDTHS[2] ?? 30, o.home),
			age(p?.started, o.now),
			l.clients.length ? String(l.clients.length) : "",
			reachLabel(l, o),
		];
	});
	const titles = [
		"PORT",
		"PROCESS",
		"WHERE",
		"UP",
		"CLIENTS",
		"REACHABLE FROM",
	];
	// fixed widths: a longer name or "59s" turning "1m" never shifts the columns
	const widths = WIDTHS;
	const line = (cols: string[]) =>
		cut(
			cols
				.map((x, i) => (i === cols.length - 1 ? x : pad(x, widths[i] ?? 0)))
				.join("  "),
			width - 2,
		);
	// fixed places: the table always as tall, the details always as tall, so nothing moves as the
	// selection or the filter changes
	const detail = (sel ? details(s, sel, width, o) : []).slice(0, DETAIL);
	while (detail.length < DETAIL) detail.push("");
	const room = tableRoom(height);
	out.push(`  ${c.dim(line(titles))}`);
	const first = scrolled(s, room);
	for (const [i, r] of rows.entries()) {
		if (i < first || i >= first + room) continue;
		const text = line(cells[i] ?? []);
		const mark = r.closed
			? c.red("−")
			: r.appeared && o.now - r.appeared < MARK_MS
				? c.green("+")
				: " ";
		const body =
			r.key === sel?.key ? c.inverse(text) : r.closed ? c.dim(text) : text;
		out.push(`${mark} ${body}`);
	}
	if (!rows.length)
		out.push(
			c.dim(
				s.snap ? (s.filter ? "  nothing matches" : "  nothing listens") : "",
			),
		);
	while (out.length < 2 + room) out.push("");
	out.push("");
	out.push(...detail);
	while (out.length < height - 1) out.push("");

	// the last line: a question, a message, the filter being typed, or the keys
	out.length = Math.max(0, height - 1);
	out.push(
		s.confirm
			? c.yellow(`${s.confirm.question} y/n`)
			: s.filtering
				? `/${s.filter}${c.dim("▏  enter to keep, esc to clear")}`
				: s.message
					? s.message.error
						? c.red(s.message.text)
						: c.green(s.message.text)
					: c.dim(
							"↑↓ select  k stop  K stop with what started it  / filter  r refresh  q quit",
						),
	);
	return out;
}

/** The selected port in full: command, directory, what started it, what stopping would take, clients. */
function details(
	s: State,
	r: Row,
	width: number,
	o: RenderOptions & { home?: string },
): string[] {
	const c = paint(o);
	const l = r.listener;
	const p = l.process;
	const kv: [string, string][] = [];
	if (l.container)
		kv.push([
			"container",
			`${l.container.name}  ${c.dim(l.container.image)}${l.published ? c.dim(`  → :${l.published.containerPort}`) : ""}`,
		]);
	if (p) {
		kv.push(["command", p.cmd]);
		if (p.git)
			kv.push([
				"checkout",
				`${tilde(p.git.root, o.home)}  ${p.git.branch ? `branch ${p.git.branch}` : "detached HEAD"}${p.git.worktree ? c.dim("  (worktree)") : ""}`,
			]);
		if (p.project)
			kv.push([
				"project",
				`${tilde(p.project.root, o.home)}  ${p.project.removed ? c.yellow("removed") : p.project.branch ? `branch ${p.project.branch}` : ""}${c.dim(p.project.via === "session" ? "  (from its Claude session)" : "  (from what started it)")}`,
			]);
		if (p.cwd && p.cwd !== p.git?.root)
			kv.push(["directory", tilde(p.cwd, o.home)]);
		if (p.app) kv.push(["app", p.app]);
		if (p.orphan)
			kv.push([
				"",
				c.yellow(
					"its Claude session has ended: probably left behind (k stops it)",
				),
			]);
		if (s.snap) {
			const up = startedBy(s.snap, p.pid).slice(0, 4);
			if (up.length)
				kv.push([
					"started by",
					up.map((x: Process) => `${x.name} ${x.pid}`).join(" ← "),
				]);
			const tree = targets(s, r, true);
			if (tree.length > 1)
				kv.push(["K stops", tree.map((x) => `${x.name} ${x.pid}`).join(", ")]);
		}
	} else if (!l.container)
		kv.push([
			"process",
			c.yellow(
				`${l.user ?? "another user"}'s: run with sudo (or as administrator) to see it`,
			),
		]);
	kv.push(["bound to", l.addresses.join(", ")]);
	if (l.clients.length)
		kv.push([
			"clients",
			l.clients
				.slice(0, 3)
				.map(
					(x) =>
						`${x.remote.address}:${x.remote.port}${x.peer.kind === "local" && x.peer.process ? ` ${x.peer.process.name} ${x.peer.process.pid}` : ""}`,
				)
				.join(", ") + (l.clients.length > 3 ? ` +${l.clients.length - 3}` : ""),
		]);
	return [
		c.bold(`${l.proto} ${l.port}${r.closed ? c.red("  closed") : ""}`),
		...kv.map(
			([k, v]) =>
				`  ${c.dim(k.padEnd(10))} ${cut(v, Math.max(10, width - 14))}`,
		),
	];
}

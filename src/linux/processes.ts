// Which process owns each socket: /proc/PID/fd links to socket:[INODE]. Other users' fd
// directories are unreadable without root; netbeagle counts them so it can say so.

import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import type { Process } from "../model.ts";

export interface ProcessScan {
	processes: Process[];
	/** Socket inode → pid. A socket shared by several processes (a forked server) keeps the first. */
	owners: Map<number, number>;
	/** Processes whose fd directory could not be read. */
	hidden: number;
}

export function scanProcesses(proc: string): ProcessScan {
	const processes: Process[] = [];
	const owners = new Map<number, number>();
	let hidden = 0;
	let pids: string[] = [];
	try {
		pids = readdirSync(proc).filter((d) => /^\d+$/.test(d));
	} catch {}
	// lowest pid first, so a forked server's sockets go to the parent
	pids.sort((a, b) => Number(a) - Number(b));
	for (const p of pids) {
		const pid = Number(p);
		const dir = join(proc, p);
		let fds: string[];
		try {
			fds = readdirSync(join(dir, "fd"));
		} catch {
			hidden++;
			continue;
		}
		let sockets = 0;
		for (const fd of fds) {
			let target: string;
			try {
				target = readlinkSync(join(dir, "fd", fd));
			} catch {
				continue;
			}
			const m = target.match(/^socket:\[(\d+)\]$/);
			if (!m) continue;
			sockets++;
			const inode = Number(m[1]);
			if (!owners.has(inode)) owners.set(inode, pid);
		}
		if (sockets === 0) continue;
		processes.push(readProcess(dir, pid));
	}
	return { processes, owners, hidden };
}

function readProcess(dir: string, pid: number): Process {
	const text = (f: string) => {
		try {
			return readFileSync(join(dir, f), "utf8");
		} catch {
			return "";
		}
	};
	const comm = text("comm").trim();
	const argv = text("cmdline").split("\0").filter(Boolean);
	// comm is the main thread's name, which runtimes rename ("MainThread"): then the program's name
	const program = argv[0]?.split("/").pop();
	const name =
		(comm && argv.join(" ").includes(comm) ? comm : program || comm) ||
		String(pid);
	const cmd = argv.join(" ") || `[${name}]`;
	const uid = Number(text("status").match(/^Uid:\s+(\d+)/m)?.[1] ?? -1);
	return { pid, name, cmd, uid };
}

/** User names by uid, from an /etc/passwd file. */
export function readUsers(passwd: string): Record<number, string> {
	const users: Record<number, string> = {};
	let text = "";
	try {
		text = readFileSync(passwd, "utf8");
	} catch {}
	for (const line of text.split("\n")) {
		const [name, , uid] = line.split(":");
		if (name && uid && /^\d+$/.test(uid)) users[Number(uid)] = name;
	}
	return users;
}

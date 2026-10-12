// Reads one Snapshot of the machine. Every path is relative to `root`, so tests can point it
// at a fixture tree instead of the real /proc and /sys.

import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import { readContainers } from "./docker.ts";
import { readInterfaces, systemAddresses } from "./linux/interfaces.ts";
import { readUsers, scanProcesses } from "./linux/processes.ts";
import { readRoutes } from "./linux/routes.ts";
import { readSockets } from "./linux/sockets.ts";
import type { Address, Container, Snapshot } from "./model.ts";

export interface CollectOptions {
	/** Where proc/, sys/ and etc/ are; "/" for the real machine. */
	root?: string;
	/** Addresses by interface; default os.networkInterfaces(). */
	addresses?: Record<string, Address[]>;
	/** Containers; default from `docker inspect`. */
	containers?: Container[];
	uid?: number;
	hostname?: string;
}

export function collect(o: CollectOptions = {}): Snapshot {
	const root = o.root ?? "/";
	const proc = join(root, "proc");
	const read = (p: string) => {
		try {
			return readFileSync(join(root, p), "utf8");
		} catch {
			return "";
		}
	};
	const interfaces = readInterfaces(
		join(root, "sys"),
		o.addresses ?? systemAddresses(),
	);
	const scan = scanProcesses(proc);
	const sockets = readSockets(proc).map((s) => ({
		...s,
		pid: scan.owners.get(s.inode),
	}));
	const names = new Set(interfaces.map((i) => i.name));
	const containers = (o.containers ?? readContainers()).map((c) => ({
		...c,
		networks: c.networks.map((n) => ({
			...n,
			bridge: n.bridge && names.has(n.bridge) ? n.bridge : undefined,
		})),
	}));
	return {
		hostname: o.hostname ?? hostname(),
		environment: /microsoft|wsl/i.test(read("proc/sys/kernel/osrelease"))
			? "wsl"
			: "linux",
		interfaces,
		routes: readRoutes(proc),
		sockets,
		processes: scan.processes,
		containers,
		users: readUsers(join(root, "etc/passwd")),
		dns: [...read("etc/resolv.conf").matchAll(/^\s*nameserver\s+(\S+)/gm)].map(
			(m) => m[1] ?? "",
		),
		uid: o.uid ?? process.getuid?.() ?? 0,
		hidden: scan.hidden,
	};
}

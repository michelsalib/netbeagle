// Sockets from /proc/net/{tcp,tcp6,udp,udp6}: one line each, addresses in hex.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Proto, Socket, SocketState } from "../model.ts";
import { procIPv4, procIPv6 } from "../net.ts";

const TCP_STATES: Record<string, SocketState> = {
	"01": "ESTABLISHED",
	"02": "SYN_SENT",
	"03": "SYN_RECV",
	"04": "FIN_WAIT1",
	"05": "FIN_WAIT2",
	"06": "TIME_WAIT",
	"07": "CLOSE",
	"08": "CLOSE_WAIT",
	"09": "LAST_ACK",
	"0A": "LISTEN",
	"0B": "CLOSING",
};

/** One /proc/net/tcp-style table; the first line is a header. */
export function parseSockets(
	text: string,
	proto: Proto,
	v6: boolean,
): Socket[] {
	const out: Socket[] = [];
	for (const line of text.split("\n").slice(1)) {
		const f = line.trim().split(/\s+/);
		if (f.length < 10) continue;
		const [, local = "", remote = "", st = "", , , , uid = "0", , inode = "0"] =
			f;
		const ep = (s: string) => {
			const [hex = "", port = "0"] = s.split(":");
			const a = v6
				? procIPv6(hex)
				: { family: 4 as const, address: procIPv4(hex) };
			return { ...a, port: Number.parseInt(port, 16) };
		};
		const l = ep(local);
		const r = ep(remote);
		// UDP has no states: 07 is a bound socket with no peer, 01 one connected to a peer
		const state: SocketState | undefined =
			proto === "udp"
				? r.port === 0
					? "UNCONN"
					: "ESTABLISHED"
				: TCP_STATES[st.toUpperCase()];
		if (!state) continue;
		out.push({
			proto,
			family: l.family,
			local: { address: l.address, port: l.port },
			remote: { address: r.address, port: r.port },
			state,
			uid: Number(uid),
			inode: Number(inode),
		});
	}
	return out;
}

const read = (path: string) => {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return "";
	}
};

export function readSockets(proc: string): Socket[] {
	return [
		...parseSockets(read(join(proc, "net/tcp")), "tcp", false),
		...parseSockets(read(join(proc, "net/tcp6")), "tcp", true),
		...parseSockets(read(join(proc, "net/udp")), "udp", false),
		...parseSockets(read(join(proc, "net/udp6")), "udp", true),
	];
}

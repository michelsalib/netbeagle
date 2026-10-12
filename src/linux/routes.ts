// The main routing table, from /proc/net/route and /proc/net/ipv6_route.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Route } from "../model.ts";
import { hexIPv6, maskPrefix, procIPv4 } from "../net.ts";

const RTF_UP = 0x1;
const RTF_GATEWAY = 0x2;
const RTF_REJECT = 0x200;

export function parseRoutes4(text: string): Route[] {
	const out: Route[] = [];
	for (const line of text.split("\n").slice(1)) {
		const [iface, dest, gateway, flags, , , metric, mask] = line
			.trim()
			.split(/\s+/);
		if (!iface || !dest || !gateway || !flags || !mask) continue;
		const f = Number.parseInt(flags, 16);
		if (!(f & RTF_UP) || f & RTF_REJECT) continue;
		out.push({
			family: 4,
			dest: procIPv4(dest),
			prefix: maskPrefix(mask),
			gateway: f & RTF_GATEWAY ? procIPv4(gateway) : undefined,
			iface,
			metric: Number(metric) || 0,
		});
	}
	return out;
}

export function parseRoutes6(text: string): Route[] {
	const out: Route[] = [];
	for (const line of text.split("\n")) {
		const f = line.trim().split(/\s+/);
		if (f.length < 10) continue;
		const [
			dest = "",
			plen = "0",
			,
			,
			next = "",
			metric = "0",
			,
			,
			flags = "0",
			iface = "",
		] = f;
		const fl = Number.parseInt(flags, 16);
		if (!(fl & RTF_UP) || fl & RTF_REJECT) continue;
		const d = hexIPv6(dest);
		const prefix = Number.parseInt(plen, 16);
		// multicast, and the host routes of our own addresses: not where traffic goes
		if (
			d.startsWith("ff") ||
			(prefix === 128 && iface !== "lo") ||
			(iface === "lo" && d !== "::1")
		)
			continue;
		const gw = hexIPv6(next);
		out.push({
			family: 6,
			dest: d,
			prefix,
			gateway: fl & RTF_GATEWAY && gw !== "::" ? gw : undefined,
			iface,
			metric: Number.parseInt(metric, 16),
		});
	}
	return out;
}

export function readRoutes(proc: string): Route[] {
	const read = (f: string) => {
		try {
			return readFileSync(join(proc, f), "utf8");
		} catch {
			return "";
		}
	};
	return [
		...parseRoutes4(read("net/route")),
		...parseRoutes6(read("net/ipv6_route")),
	];
}

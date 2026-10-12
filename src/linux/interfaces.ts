// Interfaces from /sys/class/net: kind, state, bridge membership and traffic. Addresses come
// from getifaddrs (node's os.networkInterfaces), as /sys has none.

import { existsSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { basename, join } from "node:path";
import type { Address, Iface, IfaceKind } from "../model.ts";

/** Addresses by interface name, from os.networkInterfaces(). */
export function systemAddresses(): Record<string, Address[]> {
	const out: Record<string, Address[]> = {};
	for (const [name, infos] of Object.entries(networkInterfaces()))
		out[name] = (infos ?? []).map((i) => ({
			family: i.family === "IPv6" ? 6 : 4,
			address: i.address.replace(/%.*$/, ""),
			prefix: Number(i.cidr?.split("/")[1] ?? (i.family === "IPv6" ? 128 : 32)),
		}));
	return out;
}

export function readInterfaces(
	sys: string,
	addresses: Record<string, Address[]>,
): Iface[] {
	const net = join(sys, "class/net");
	let names: string[] = [];
	try {
		names = readdirSync(net);
	} catch {}
	const ifaces = names.map((name) => {
		const dir = join(net, name);
		const text = (f: string) => {
			try {
				return readFileSync(join(dir, f), "utf8").trim();
			} catch {
				return "";
			}
		};
		const num = (f: string) => Number(text(f)) || 0;
		let master: string | undefined;
		try {
			master = basename(readlinkSync(join(dir, "master")));
		} catch {}
		let members: string[] = [];
		try {
			members = readdirSync(join(dir, "brif"));
		} catch {
			members = readdirSync(dir)
				.filter((f) => f.startsWith("lower_"))
				.map((f) => f.slice("lower_".length));
		}
		const state = text("operstate");
		const mac = text("address");
		return {
			name,
			index: num("ifindex"),
			kind: kindOf(dir, text),
			state: state === "up" ? "up" : state === "down" ? "down" : "unknown",
			mtu: num("mtu"),
			mac: mac && mac !== "00:00:00:00:00:00" ? mac : undefined,
			addresses: addresses[name] ?? [],
			master,
			members: members.sort(),
			rxBytes: num("statistics/rx_bytes"),
			txBytes: num("statistics/tx_bytes"),
		} satisfies Iface;
	});
	// the loopback reports "unknown": it is up when it has addresses
	for (const i of ifaces)
		if (i.kind === "loopback" && i.state === "unknown" && i.addresses.length)
			i.state = "up";
	return ifaces.sort((a, b) => a.index - b.index);
}

function kindOf(dir: string, text: (f: string) => string): IfaceKind {
	const type = text("type");
	if (type === "772") return "loopback";
	const devtype = text("uevent").match(/^DEVTYPE=(.*)$/m)?.[1];
	if (devtype === "wlan" || existsSync(join(dir, "wireless"))) return "wifi";
	if (devtype === "bridge" || existsSync(join(dir, "bridge"))) return "bridge";
	if (devtype === "vlan") return "vlan";
	if (devtype === "bond" || existsSync(join(dir, "bonding"))) return "bond";
	if (devtype === "wireguard" || type === "65534")
		return devtype === "wireguard" ? "wireguard" : "tun";
	// a veth's iflink is its peer in another namespace, never itself
	if (basename(dir).startsWith("veth")) return "veth";
	if (existsSync(join(dir, "device"))) return "ethernet";
	return "virtual";
}

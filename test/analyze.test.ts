import { expect, test } from "bun:test";
import {
	connections,
	listeners,
	map,
	routeTo,
	unowned,
	who,
} from "../src/analyze.ts";
import { fixture, pg } from "./helpers.ts";

const snap = fixture();

test("listeners: one row per port and owner, both families merged", () => {
	const ls = listeners(snap);
	expect(
		ls.map((l) => `${l.proto} ${l.port} ${l.addresses.join(",")}`),
	).toEqual([
		"tcp 22 0.0.0.0,::",
		"udp 53 127.0.0.53",
		"tcp 5000 127.0.0.1",
		"tcp 5432 0.0.0.0",
		"tcp 8080 192.168.1.10",
	]);
	const by = Object.fromEntries(ls.map((l) => [l.port, l]));
	expect(by[22]?.process).toBeUndefined();
	expect(by[22]?.user).toBe("root");
	expect(by[53]?.user).toBe("systemd-resolve");
	expect(by[5000]?.process?.name).toBe("node");
	expect(by[5432]?.container?.name).toBe("pg");
});

test("reach: this machine, every interface but bridge ports, or the interface holding the address", () => {
	const by = Object.fromEntries(listeners(snap).map((l) => [l.port, l.reach]));
	expect(by[5000]).toEqual({ scope: "local", interfaces: ["lo"] });
	expect(by[22]).toEqual({
		scope: "everywhere",
		interfaces: ["lo", "eth0", "br-abc"],
	});
	expect(by[8080]).toEqual({ scope: "interfaces", interfaces: ["eth0"] });
});

test("clients: a local one with its process, a remote one over IPv6-mapped IPv4", () => {
	const by = Object.fromEntries(listeners(snap).map((l) => [l.port, l]));
	expect(by[5000]?.clients).toHaveLength(1);
	const local = by[5000]?.clients[0]?.peer;
	expect(local?.kind === "local" && local.process?.name).toBe("curl");
	expect(by[22]?.clients.map((c) => c.remote.address)).toEqual([
		"192.168.1.50",
	]);
});

test("connections: direction, and what is at the other end", () => {
	const cs = connections(snap).filter((c) => c.state === "ESTABLISHED");
	const curl = cs.filter((c) => c.process?.name === "curl");
	expect(curl.map((c) => c.direction)).toEqual(["out", "out"]);
	const toNode = curl.find((c) => c.remote.port === 5000)?.peer;
	expect(toNode?.kind === "local" && toNode.listener?.port).toBe(5000);
	const out = curl.find((c) => c.remote.port === 443)?.peer;
	expect(out?.kind === "remote" && out.route).toMatchObject({
		kind: "gateway",
		iface: "eth0",
		gateway: "192.168.1.1",
		source: "192.168.1.10",
	});
	expect(cs.find((c) => c.process?.name === "node")?.direction).toBe("in");
	expect(connections(snap).some((c) => c.state === "TIME_WAIT")).toBe(true);
});

test("routeTo: loopback, own address, container, on-link, gateway", () => {
	expect(routeTo(snap, "127.0.0.5").kind).toBe("loopback");
	expect(routeTo(snap, "192.168.1.10")).toMatchObject({
		kind: "local",
		iface: "eth0",
	});
	expect(routeTo(snap, "172.18.0.2")).toMatchObject({
		kind: "container",
		iface: "br-abc",
		source: "172.18.0.1",
	});
	expect(routeTo(snap, "192.168.1.77")).toMatchObject({
		kind: "network",
		iface: "eth0",
	});
	expect(routeTo(snap, "8.8.8.8")).toMatchObject({
		kind: "gateway",
		gateway: "192.168.1.1",
	});
	// rejected routes are not routes: docker0's network goes out the default way
	expect(routeTo(snap, "172.17.0.2").iface).toBe("eth0");
	expect(routeTo(snap, "2001:db8::1").kind).toBe("unreachable");
});

test("a published port with no socket (docker without its proxy) is still listed", () => {
	const web = {
		...pg,
		id: "ffffffffffff",
		name: "web",
		ports: [
			{
				proto: "tcp" as const,
				hostIp: "127.0.0.1",
				hostPort: 8000,
				containerPort: 80,
			},
		],
	};
	const l = listeners(fixture([pg, web])).find((x) => x.port === 8000);
	expect(l).toMatchObject({
		container: { name: "web" },
		reach: { scope: "local" },
	});
	expect(l?.sockets).toEqual([]);
});

test("who: listeners and, apart, connections to that port elsewhere", () => {
	expect(who(snap, 5000).listeners).toHaveLength(1);
	expect(who(snap, 5000).outbound).toEqual([]);
	expect(who(snap, 443).listeners).toEqual([]);
	expect(who(snap, 443).outbound.map((c) => c.process?.name)).toEqual(["curl"]);
});

test("map: bound-everywhere apart, bridge ports folded, idle interfaces named", () => {
	const m = map(snap);
	expect(m.everywhere.map((l) => l.port)).toEqual([22, 5432]);
	expect(m.interfaces.map((v) => v.iface.name)).toEqual([
		"lo",
		"eth0",
		"br-abc",
	]);
	expect(m.idle).toEqual(["docker0"]);
	const by = Object.fromEntries(m.interfaces.map((v) => [v.iface.name, v]));
	expect(by.lo?.listeners.map((l) => l.port)).toEqual([53, 5000]);
	expect(by.lo?.local.map((c) => c.remote.port)).toEqual([5000]);
	expect(by.eth0?.listeners.map((l) => l.port)).toEqual([8080]);
	expect(by.eth0?.outbound.map((c) => c.remote.address)).toEqual([
		"140.82.121.4",
	]);
	expect(by["br-abc"]?.containers.map((x) => x.container.name)).toEqual(["pg"]);
	expect(m.dns[0]?.route.kind).toBe("loopback");
});

test("sockets of other users without a process are counted", () => {
	// sshd's 3, docker-proxy's 1, systemd-resolved's 1
	expect(unowned(snap)).toBe(5);
});

import { expect, test } from "bun:test";
import { doctor } from "../src/doctor.ts";
import { renderDoctor } from "../src/format.ts";
import type { Snapshot, Socket } from "../src/model.ts";
import { fixture, macFixture, windowsFixture } from "./helpers.ts";

const summary = (snap: Snapshot) =>
	doctor(snap).map((f) => `${f.severity} ${f.rule} ${f.proto} ${f.port}`);

const listen = (address: string, port: number, pid: number): Socket => ({
	proto: "tcp",
	family: address.includes(":") ? 6 : 4,
	local: { address, port },
	remote: { address: address.includes(":") ? "::" : "0.0.0.0", port: 0 },
	state: "LISTEN",
	pid,
	uid: 1000,
});

test("each system's fixture: a published database, dev servers off this machine", () => {
	expect(summary(fixture())).toEqual([
		"warning exposed tcp 5432",
		"info exposed tcp 8080",
	]);
	// node on * (tcp46); the database is on 127.0.0.1 only
	expect(summary(macFixture())).toEqual(["info exposed tcp 8080"]);
	// node on the Ethernet address, and on :: (IPv6 only)
	expect(summary(windowsFixture())).toEqual([
		"info exposed tcp 3000",
		"info exposed tcp 8080",
	]);
});

test("a published container: the fix is to publish it on 127.0.0.1", () => {
	const [pg] = doctor(fixture());
	expect(pg?.title).toBe(
		"PostgreSQL on tcp 5432 is reachable from every interface",
	);
	expect(pg?.details[0]).toBe("container pg, bound to 0.0.0.0");
	expect(pg?.fix).toContain("-p 127.0.0.1:5432:5432");
});

test("debuggers and the docker API off this machine are errors; containers known by image", () => {
	const snap = structuredClone(fixture([]));
	snap.processes.push({
		pid: 700,
		name: "node",
		cmd: "node --inspect=0.0.0.0 app.js",
	});
	snap.sockets.push(listen("0.0.0.0", 9229, 700));
	const [inspector] = doctor(snap);
	expect(inspector).toMatchObject({ severity: "error", port: 9229 });
	expect(inspector?.fix).toContain("--inspect=127.0.0.1");
	// a redis container published on 6380: its image says what it is
	const withRedis = fixture([
		{
			id: "r",
			name: "cache",
			image: "redis:7-alpine",
			networks: [],
			ports: [
				{
					proto: "tcp",
					hostIp: "0.0.0.0",
					hostPort: 6380,
					containerPort: 6379,
				},
			],
		},
	]);
	expect(doctor(withRedis).find((f) => f.port === 6380)).toMatchObject({
		title: "Redis on tcp 6380 is reachable from every interface",
		fix: expect.stringContaining("-p 127.0.0.1:6380:6379"),
	});
});

test("localhost split between IPv4 and IPv6: who answers each way", () => {
	const snap = structuredClone(windowsFixture());
	// postgres 2000 has 127.0.0.1:5432; node 3000 takes [::1]:5432
	snap.sockets.push({ ...listen("::1", 5432, 3000), v6only: true });
	const [f] = doctor(snap).filter((x) => x.rule === "port-shared");
	expect(f?.title).toBe(
		"localhost:5432 reaches postgres 2000 over IPv4 and node 3000 over IPv6",
	);
	expect(f?.details).toContain(
		"localhost over IPv4 (127.0.0.1:5432) → postgres 2000",
	);
	expect(f?.details).toContain("localhost over IPv6 ([::1]:5432) → node 3000");
});

test("a local server in front of a published container, for this machine's clients", () => {
	const snap = structuredClone(fixture());
	snap.processes.push({
		pid: 800,
		name: "postgres",
		cmd: "postgres -D /var/lib/pg",
	});
	snap.sockets.push(listen("127.0.0.1", 5432, 800));
	const f = doctor(snap).find((x) => x.rule === "port-shared");
	expect(f?.details).toEqual(
		expect.arrayContaining([
			"localhost over IPv4 (127.0.0.1:5432) → postgres 800",
			"localhost over IPv6 ([::1]:5432) → nobody",
			"other machines → container pg",
		]),
	);
});

test("not a conflict: distinct addresses of their own, or one server's workers", () => {
	const snap = structuredClone(fixture([]));
	snap.processes.push(
		{ pid: 901, name: "resolved", cmd: "resolved" },
		{ pid: 902, name: "dnsstub", cmd: "dnsstub" },
		{ pid: 903, name: "nginx", cmd: "nginx: worker process" },
		{ pid: 904, name: "nginx", cmd: "nginx: worker process" },
	);
	snap.sockets.push(
		listen("127.0.0.53", 53, 901),
		listen("10.255.255.254", 53, 902),
		listen("0.0.0.0", 8443, 903),
		listen("0.0.0.0", 8443, 904),
	);
	expect(doctor(snap).filter((x) => x.rule === "port-shared")).toEqual([]);
});

test("rendered: one block per finding, a summary; nothing to say says so", () => {
	const text = renderDoctor(doctor(fixture()), { color: false });
	expect(text).toContain(
		"! PostgreSQL on tcp 5432 is reachable from every interface\n  container pg",
	);
	expect(text).toContain(
		"· a development server on tcp 8080 is reachable from eth0",
	);
	expect(text).toEndWith("1 warning, 1 note");
	expect(renderDoctor([], { color: false })).toBe("✓ no problems found");
});

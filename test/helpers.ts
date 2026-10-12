import { join } from "node:path";
import { collect } from "../src/collect.ts";
import type { Container } from "../src/model.ts";

export const fixtureRoot = join(import.meta.dir, "fixtures", "root");

export const pg: Container = {
	id: "0123456789ab",
	name: "pg",
	image: "postgres:18",
	project: "app",
	networks: [{ name: "app_default", bridge: "br-abc", ip: "172.18.0.2" }],
	ports: [
		{ proto: "tcp", hostIp: "0.0.0.0", hostPort: 5432, containerPort: 5432 },
		{ proto: "tcp", hostIp: "::", hostPort: 5432, containerPort: 5432 },
	],
};

/** The machine scripts/fixture.py describes. */
export const fixture = (containers: Container[] = [pg]) =>
	collect({
		root: fixtureRoot,
		addresses: {
			lo: [
				{ family: 4, address: "127.0.0.1", prefix: 8 },
				{ family: 6, address: "::1", prefix: 128 },
			],
			eth0: [
				{ family: 4, address: "192.168.1.10", prefix: 24 },
				{ family: 6, address: "fe80::5054:ff:fe12:3456", prefix: 64 },
			],
			"br-abc": [{ family: 4, address: "172.18.0.1", prefix: 16 }],
		},
		containers,
		uid: 1000,
		hostname: "box",
	});

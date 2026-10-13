#!/usr/bin/env node
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import {
	connections,
	listeners,
	map,
	routeTo,
	unowned,
	who,
} from "./analyze.ts";
import { collect } from "./collect.ts";
import { doctor } from "./doctor.ts";
import {
	connectionJson,
	elevate,
	ifaceViewJson,
	listenerJson,
	mapJson,
	paint,
	type RenderOptions,
	renderConnections,
	renderDoctor,
	renderInterfaces,
	renderList,
	renderMap,
	renderRoute,
	renderWho,
	routeJson,
} from "./format.ts";
import { ALIASES, COMMAND_HELP, commandHelp, overview } from "./help.ts";
import { banner } from "./logo.ts";
import { maskCmd, type Snapshot } from "./model.ts";

const TAGLINE =
	"see what listens on each port, who reaches it, and how everything connects";

let usageHint = "netbeagle --help";

function usage(message: string): number {
	console.error(`netbeagle: ${message}\nsee: ${usageHint}`);
	return 2;
}

async function main(argv: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			json: { type: "boolean" },
			tcp: { type: "boolean" },
			udp: { type: "boolean" },
			all: { type: "boolean", short: "a" },
			"no-docker": { type: "boolean" },
			"show-secrets": { type: "boolean" },
			help: { type: "boolean", short: "h" },
			version: { type: "boolean", short: "v" },
		},
	});
	// the logo only for a person at a terminal; scripts get the plain text, e.g. $(netbeagle --version)
	const art = process.stdout.isTTY;
	const logo = () =>
		banner(
			[
				`netbeagle ${pkg.version}`,
				"",
				"see what listens on each",
				"port, who reaches it, and",
				"how everything connects",
			],
			{
				color: !process.env.NO_COLOR,
				truecolor: /^(truecolor|24bit)$/i.test(process.env.COLORTERM ?? ""),
				columns: process.stdout.columns,
			},
		);
	const asked = positionals[0] === "help";
	const topic =
		(asked ? positionals[1] : values.help ? positionals[0] : undefined) ??
		undefined;
	if (values.help || asked) {
		if (topic) {
			const text = commandHelp(topic);
			if (!text) return usage(`no command '${topic}'`);
			process.stdout.write(text);
			return 0;
		}
		process.stdout.write(
			art
				? `${logo()}\n${overview()}`
				: `netbeagle ${pkg.version}\n${TAGLINE}\n\n${overview()}`,
		);
		return 0;
	}
	if (values.version) {
		process.stdout.write(art ? logo() : `${pkg.version}\n`);
		return 0;
	}
	const [given = "list", ...args] = positionals;
	const command = ALIASES[given] ?? given;
	if (!COMMAND_HELP[command]) return usage(`no command '${given}'`);
	usageHint = `netbeagle ${command} --help`;
	if (!["linux", "darwin", "win32"].includes(process.platform)) {
		console.error(
			`netbeagle runs on Linux, macOS and Windows, not ${process.platform}`,
		);
		return 2;
	}

	const tty = process.stdout.isTTY;
	const snap: Snapshot = collect(values["no-docker"] ? { containers: [] } : {});
	if (!values["show-secrets"])
		for (const p of snap.processes) p.cmd = maskCmd(p.cmd);
	const opts: RenderOptions = {
		color: tty && !process.env.NO_COLOR,
		width: tty ? process.stdout.columns : undefined,
		wsl: snap.environment === "wsl",
		windows: snap.environment === "windows",
	};
	const print = (render: () => string, data: () => unknown) =>
		console.log(values.json ? JSON.stringify(data(), null, 2) : render());
	const proto = (p: "tcp" | "udp") =>
		values.tcp || values.udp ? !!values[p] : true;
	const hiddenNote = () => {
		const n = unowned(snap);
		if (n && !values.json)
			console.error(
				paint({
					...opts,
					color: !!process.stderr.isTTY && !process.env.NO_COLOR,
				}).dim(
					`\n${n} sockets belong to other users' processes: ${elevate(opts)} to see which`,
				),
			);
	};

	switch (command) {
		case "list": {
			const ls = listeners(snap).filter((l) => proto(l.proto));
			print(
				() => renderList(ls, opts),
				() => ls.map(listenerJson),
			);
			hiddenNote();
			return 0;
		}
		case "who": {
			const port = Number(args[0]?.replace(/^:/, ""));
			if (!args[0] || !Number.isInteger(port) || port < 1 || port > 65535)
				return usage("who takes a port number, e.g. netbeagle who 5432");
			const r = who(snap, port);
			print(
				() => renderWho(r, opts),
				() => ({
					port,
					listeners: r.listeners.map(listenerJson),
					outbound: r.outbound.map(connectionJson),
				}),
			);
			return r.listeners.length || r.outbound.length ? 0 : 1;
		}
		case "conns": {
			const cs = connections(snap)
				.filter((c) => proto(c.proto))
				.filter((c) => values.all || c.state === "ESTABLISHED");
			print(
				() => renderConnections(cs, opts),
				() => cs.map(connectionJson),
			);
			hiddenNote();
			return 0;
		}
		case "interfaces": {
			const m = map(snap);
			print(
				() => renderInterfaces(m.interfaces, m.idle, opts),
				() => m.interfaces.map(ifaceViewJson),
			);
			return 0;
		}
		case "route": {
			const host = args[0];
			if (!host)
				return usage(
					"route takes a host name or an address, e.g. netbeagle route github.com",
				);
			let ip = host;
			if (!isIP(host)) {
				try {
					ip = (await lookup(host)).address;
				} catch {
					console.error(`netbeagle: cannot resolve ${host}`);
					return 1;
				}
			}
			const r = routeTo(snap, ip);
			print(
				() => renderRoute(r, host, opts),
				() => ({ host, ...routeJson(r) }),
			);
			return r.kind === "unreachable" ? 1 : 0;
		}
		case "doctor": {
			const findings = doctor(snap);
			print(
				() => renderDoctor(findings, opts),
				() => findings,
			);
			hiddenNote();
			return findings.some((f) => f.severity === "error") ? 1 : 0;
		}
		case "map": {
			const m = map(snap);
			print(
				() => renderMap(m, opts),
				() => mapJson(m),
			);
			return 0;
		}
	}
	return usage(`no command '${given}'`);
}

main(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	(e: unknown) => {
		if (
			e instanceof Error &&
			"code" in e &&
			String(e.code).startsWith("ERR_PARSE_ARGS")
		)
			process.exitCode = usage(e.message);
		else {
			console.error(`netbeagle: ${e instanceof Error ? e.message : String(e)}`);
			process.exitCode = 1;
		}
	},
);

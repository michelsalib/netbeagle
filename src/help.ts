// netbeagle --help: an overview of the commands, and netbeagle COMMAND --help (or netbeagle help
// COMMAND) for one command alone: its usage, what it does, the options it takes, examples.

/** Every option, as the help lists it. */
const OPTIONS: Record<string, [string, string]> = {
	json: ["--json", "machine-readable output"],
	tcp: ["--tcp", "TCP only"],
	udp: ["--udp", "UDP only"],
	all: [
		"-a, --all",
		"also connections that are opening or closing (TIME_WAIT…)",
	],
	"no-docker": [
		"--no-docker",
		"don't ask docker which containers publish ports",
	],
	"show-secrets": [
		"--show-secrets",
		"don't mask the values of --token=, --password and the like\nin command lines",
	],
	help: ["-h, --help", "show help: netbeagle COMMAND --help for one command"],
	version: ["-v, --version", "show the version"],
};

export interface CommandHelp {
	/** Usage lines, without "netbeagle ". */
	usage: string[];
	/** One line for the overview. */
	summary: string;
	/** What it does, in a few lines. */
	about: string;
	/** Keys of OPTIONS it takes, besides --help. */
	options: string[];
	examples: string[];
}

export const COMMAND_HELP: Record<string, CommandHelp> = {
	list: {
		usage: ["[list]"],
		summary:
			"every listening port: its process or container, and who can reach it",
		about: `Lists every port something listens on, with the process (or the docker container)
behind it, the addresses it is bound to, and who can reach it: this machine only,
every interface, or the interfaces holding its address. Ports docker publishes
without a socket of their own are listed too. This is what netbeagle does with no
command.`,
		options: ["json", "tcp", "udp", "no-docker"],
		examples: ["netbeagle", "netbeagle list --tcp --json"],
	},
	who: {
		usage: ["who PORT"],
		summary: "what listens on PORT, who can reach it, who is connected to it",
		about: `Shows what listens on PORT: the process and its command line, or the container
and the address inside it the port forwards to; the addresses it is bound to and
the interfaces that reach it; and every client connected right now, with its
process when it runs here. Also lists connections from this machine to PORT
elsewhere. Exits 1 when there are none.`,
		options: ["json", "show-secrets", "no-docker"],
		examples: ["netbeagle who 5432", "netbeagle who 443"],
	},
	conns: {
		usage: ["conns"],
		summary: "every connection, by process, with what is at the other end",
		about: `Lists the open connections of each process: inbound ones (←) to its listening
ports and outbound ones (→). The other end is named when it is on this machine
(its process, or the container behind the port) or in a container; otherwise
netbeagle shows the interface and gateway the traffic leaves through.`,
		options: ["json", "all", "tcp", "udp", "no-docker"],
		examples: ["netbeagle conns", "netbeagle conns --all"],
	},
	interfaces: {
		usage: ["interfaces"],
		summary: "every network interface: addresses, routes, bridges, containers",
		about: `Lists the network interfaces: kind (ethernet, wifi, bridge, veth, tun…), state,
addresses, the routes going through each, the ports of a bridge and the docker
containers on it, and the traffic so far.`,
		options: ["json", "no-docker"],
		examples: ["netbeagle interfaces", "netbeagle if --json"],
	},
	route: {
		usage: ["route HOST"],
		summary: "which interface and gateway traffic to HOST takes",
		about: `Resolves HOST (a name or an address) and shows where packets to it go, as the
kernel's main routing table decides: this machine, a container, a network one of
the interfaces is on, or a gateway; with the route and the source address.`,
		options: ["json", "no-docker"],
		examples: ["netbeagle route github.com", "netbeagle route 172.18.0.2"],
	},
	map: {
		usage: ["map"],
		summary: "how everything connects, interface by interface",
		about: `The whole picture: the ports open on every interface; then each interface with
its routes, the ports bound to it, the containers behind it, and the connections
leaving through it; on the loopback, which local process talks to which. Ends
with the DNS servers and the way to them.`,
		options: ["json", "no-docker"],
		examples: ["netbeagle map"],
	},
};

/** Accepted names for commands. */
export const ALIASES: Record<string, string> = {
	ls: "list",
	if: "interfaces",
	ifaces: "interfaces",
	connections: "conns",
	graph: "map",
};

const optionLines = (keys: string[]) => {
	const rows = [...keys, "help"]
		.map((k) => OPTIONS[k])
		.filter((o): o is [string, string] => !!o);
	const w = Math.max(...rows.map(([f]) => f.length));
	return rows.map(
		([f, d]) =>
			`  ${f.padEnd(w)}  ${d.replaceAll("\n", `\n  ${" ".repeat(w)}  `)}`,
	);
};

export function overview(): string {
	const entries = Object.values(COMMAND_HELP);
	const w = Math.max(...entries.map((h) => (h.usage[0] ?? "").length));
	return [
		"Usage: netbeagle [COMMAND] [OPTIONS]",
		"",
		"Commands:",
		...entries.map((h) => `  ${(h.usage[0] ?? "").padEnd(w)}  ${h.summary}`),
		"",
		"Options:",
		...optionLines(["json", "no-docker", "show-secrets", "version"]),
		"",
		"netbeagle COMMAND --help shows one command's usage, options and examples.",
		process.platform === "win32"
			? "Without an administrator terminal, other users' command lines are hidden."
			: "Without root, sockets of other users' processes show no process: sudo shows them all.",
		"",
		"From the same pack: envhound, which startup file sets each environment variable.",
		"  npx envhound",
		"",
	].join("\n");
}

export function commandHelp(name: string): string | undefined {
	const h = COMMAND_HELP[ALIASES[name] ?? name];
	if (!h) return undefined;
	return [
		`Usage: ${h.usage.map((u) => `netbeagle ${u}`).join("\n       ")}`,
		"",
		h.about,
		"",
		"Options:",
		...optionLines(h.options),
		"",
		"Examples:",
		...h.examples.map((e) => `  ${e}`),
		"",
	].join("\n");
}

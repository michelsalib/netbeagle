// What netbeagle reads from the machine, in one snapshot: everything else is computed from it,
// so tests (and --json consumers) can work from a saved one.

export type Family = 4 | 6;
export type Proto = "tcp" | "udp";

export interface Address {
	family: Family;
	address: string;
	/** Prefix length, e.g. 24 for 192.168.1.10/24. */
	prefix: number;
}

export type IfaceKind =
	| "loopback"
	| "ethernet"
	| "wifi"
	| "bridge"
	| "veth"
	| "vlan"
	| "bond"
	| "tun"
	| "wireguard"
	| "virtual";

export interface Iface {
	name: string;
	index: number;
	kind: IfaceKind;
	state: "up" | "down" | "unknown";
	mtu: number;
	mac?: string;
	addresses: Address[];
	/** The bridge (or bond) this interface is a port of. */
	master?: string;
	/** For a bridge or bond: its ports. */
	members: string[];
	rxBytes: number;
	txBytes: number;
}

export interface Route {
	family: Family;
	/** Network address, e.g. 0.0.0.0 for the default route. */
	dest: string;
	prefix: number;
	gateway?: string;
	iface: string;
	metric: number;
}

export interface Endpoint {
	address: string;
	port: number;
}

export type SocketState =
	| "LISTEN"
	| "ESTABLISHED"
	| "SYN_SENT"
	| "SYN_RECV"
	| "FIN_WAIT1"
	| "FIN_WAIT2"
	| "TIME_WAIT"
	| "CLOSE"
	| "CLOSE_WAIT"
	| "LAST_ACK"
	| "CLOSING"
	/** A UDP socket bound with no peer: it receives from anyone, netbeagle treats it as listening. */
	| "UNCONN";

export interface Socket {
	proto: Proto;
	/** The address family once IPv4-mapped IPv6 addresses (::ffff:1.2.3.4) are unwrapped. */
	family: Family;
	local: Endpoint;
	remote: Endpoint;
	state: SocketState;
	uid: number;
	inode: number;
	/** Unknown when the process belongs to another user and netbeagle runs without root. */
	pid?: number;
}

export interface Process {
	pid: number;
	name: string;
	/** The full command line, arguments joined by spaces. */
	cmd: string;
	uid: number;
}

export interface ContainerNetwork {
	name: string;
	/** The host interface the network uses, e.g. docker0 or br-b9465e98212d. */
	bridge?: string;
	ip?: string;
}

export interface PublishedPort {
	proto: Proto;
	hostIp: string;
	hostPort: number;
	containerPort: number;
}

export interface Container {
	id: string;
	name: string;
	image: string;
	/** The compose project, when it was started by docker compose. */
	project?: string;
	networks: ContainerNetwork[];
	ports: PublishedPort[];
}

export interface Snapshot {
	hostname: string;
	/** "wsl" in Windows Subsystem for Linux, where Windows forwards localhost ports into the VM. */
	environment: "linux" | "wsl";
	interfaces: Iface[];
	routes: Route[];
	sockets: Socket[];
	processes: Process[];
	containers: Container[];
	/** User names by uid. */
	users: Record<number, string>;
	/** Name servers from /etc/resolv.conf. */
	dns: string[];
	/** Our uid: sockets of other users have no process unless we are root. */
	uid: number;
	/** Processes whose sockets netbeagle could not read (other users', without root). */
	hidden: number;
}

const SECRET_WORD =
	"(?:token|secret|passw(?:or)?d|api[-_]?key|private[-_]?key|credential|auth(?![a-z]))";
// --token=…, --password …, ?api_key=…: the value goes, the name stays
const SECRET_ARG = new RegExp(
	`((?:^|\\s)--?[\\w-]*${SECRET_WORD}[\\w-]*(?:=|\\s+)|[\\w-]*${SECRET_WORD}[\\w-]*=)(?!-)[^\\s&]+`,
	"gi",
);

/** A command line as netbeagle shows it: values of token- or password-like arguments masked. */
export const maskCmd = (cmd: string) => cmd.replace(SECRET_ARG, "$1********");

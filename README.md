<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="netbeagle logo: a friendly beagle peeking over a network switch, paws on its edge, two ports plugged in and one link light blinking">
</p>

<h1 align="center">netbeagle</h1>

<p align="center">See which process (or container) listens on each port, who can reach it, who is connected to it, and how everything on your machine connects.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/netbeagle"><img src="https://img.shields.io/npm/v/netbeagle?color=a8521a" alt="npm version"></a>
  <a href="https://github.com/michelsalib/netbeagle/actions/workflows/ci.yml"><img src="https://github.com/michelsalib/netbeagle/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/node/v/netbeagle" alt="Node version">
  <img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-blue" alt="Linux, macOS and Windows">
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/netbeagle" alt="MIT license"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/michelsalib/netbeagle"><img src="https://api.scorecard.dev/projects/github.com/michelsalib/netbeagle/badge" alt="OpenSSF Scorecard"></a>
</p>

What is on port 5432, a local postgres or the one in docker? Can my laptop's neighbours reach it, or only
this machine? Which process keeps a connection open to that server, and through which interface and
gateway does it leave? netbeagle answers those in one command, by reading what the system already
knows (`/proc` and `/sys` on Linux, `netstat` and `lsof` on macOS, PowerShell on Windows) and asking
docker which container sits behind each published port.

**Try it, nothing to install:**

```sh
npx netbeagle             # every listening port
npx netbeagle map         # how everything connects
npx netbeagle who 5432    # what is on 5432
npx netbeagle doctor      # what is exposed that shouldn't be
```

```
$ netbeagle doctor
! PostgreSQL on tcp 5432 is reachable from every interface
  container pg, bound to 0.0.0.0, ::
  any machine that can reach eth0 can try passwords, or log in where pg_hba.conf trusts, unless a firewall stops it
  fix: publish it on this machine only: -p 127.0.0.1:5432:5432 (in compose: "127.0.0.1:5432:5432")

! localhost:3000 reaches node 812 over IPv4 and bun 977 over IPv6
  node 812 on 127.0.0.1
  bun 977 on ::1
  localhost over IPv4 (127.0.0.1:3000) → node 812
  localhost over IPv6 ([::1]:3000) → bun 977
  other machines → nobody
  fix: a client may pick either (browsers and node try IPv6 first, many others IPv4): stop one, or move it to another port

2 warnings
```

```
$ netbeagle
PORT      ADDRESS       REACHABLE FROM     CLIENTS  OWNER
tcp 22    *             every interface    1        root's process (sudo to see it)
udp 53    127.0.0.53    this machine only           systemd-resolve's process (sudo to see it)
tcp 5000  127.0.0.1     this machine only  1        node 300
tcp 5432  0.0.0.0       every interface             container pg :5432
tcp 8080  192.168.1.10  eth0                        node 300
```

```
$ netbeagle map
box

listening on every interface
  tcp 22    root's process (sudo to see it)  ← 1 client
  tcp 5432  container pg :5432

lo  loopback  up  127.0.0.1/8 ::1/128
  routes  ::1/128
  listen  udp 53    systemd-resolve's process (sudo to see it)
  listen  tcp 5000  node 300  ← 1 client
  local   curl 400 → :5000 node 300

eth0  ethernet  up  192.168.1.10/24 fe80::5054:ff:fe12:3456/64
  routes  default via 192.168.1.1, 192.168.1.0/24
  listen  tcp 8080  node 300
  out     curl 400 → 140.82.121.4:443

br-abc  bridge  up  172.18.0.1/16  docker network app_default
  routes  172.18.0.0/16
  holds   pg 172.18.0.2  ← host :5432
  1 port: veth1

down, no address: docker0
dns  127.0.0.53 (local resolver)
```

### Dev servers in several worktrees

Two checkouts of the same app, each running `bun run dev`, look the same to `ps`: `node …/vite`. netbeagle
tells them apart by the git checkout and branch each runs in:

```
$ netbeagle who 5173
tcp 5173  node 41207
  process    node /home/me/src/app-feature/node_modules/.bin/vite  (pid 41207, me)
  checkout   ~/src/app-feature  branch feature-x  (worktree)
  started by bun 41190 ← zsh 40122
  …
$ netbeagle kill 5173 --tree
tcp 5173  node 41207  app-feature (feature-x)  started by bun 41190
         and bun 41190  app-feature (feature-x)  started by zsh 40122
stop them? [y/N] y
stopped 41190, 41207
```

`netbeagle watch` shows the same live, and stops the selected one with `k` (its process) or `K` (with the
`bun run dev`, `npm` or watcher that started it, so nothing starts it again; never your shell).

## Install

netbeagle is a single JavaScript file that runs on Node ≥ 20 or Bun, on Linux (WSL included), macOS and
Windows. Without either, the installers fetch a standalone binary instead, which needs nothing.

```sh
npx netbeagle map               # or: bunx netbeagle map, nothing to install
npm install -g netbeagle        # or: bun add -g netbeagle
curl -fsSL https://github.com/michelsalib/netbeagle/releases/latest/download/install.sh | sh
```

To pin a version, or to read the script before running it:

```sh
curl -fsSL https://github.com/michelsalib/netbeagle/releases/download/v0.4.0/install.sh -o install.sh
less install.sh && sh install.sh
gh attestation verify install.sh -R michelsalib/netbeagle   # optional: proves GitHub Actions built it
```

On Windows, in PowerShell:

```powershell
irm https://github.com/michelsalib/netbeagle/releases/latest/download/install.ps1 | iex
```

With a package manager, which installs the standalone binary:

```sh
brew install michelsalib/netbeagle/netbeagle                    # Homebrew, macOS and Linux
scoop bucket add netbeagle https://github.com/michelsalib/scoop-netbeagle
scoop install netbeagle/netbeagle                               # Scoop, Windows
```

`install.sh` puts `netbeagle` in `~/.local/bin` (`NETBEAGLE_INSTALL_DIR` to change it, `NETBEAGLE_VERSION=0.4.0`
to pin a version), checks it against the release's `SHA256SUMS`, and runs it on Node, or on Bun when there
is no Node ≥ 20. With neither, or with `NETBEAGLE_BINARY=1`, it installs the standalone binary for your
system (Linux and macOS, x64 and arm64). `install.ps1` does the same on Windows, in
`%LOCALAPPDATA%\Programs\netbeagle`: `netbeagle.mjs` and a `netbeagle.cmd` launcher, or `netbeagle.exe`.
Neither edits your `PATH`: they print what to run.

**Updates.** Once a week netbeagle asks the npm registry, in the background, whether a newer version
exists, and when there is one says so after a command, with the update command for how you installed it:
`netbeagle upgrade` for `install.sh` and `install.ps1`, `brew upgrade netbeagle`, `scoop update netbeagle`,
`npm install -g netbeagle@latest`, and so on. It stays quiet in scripts, CI, with `--json`, and with
`NETBEAGLE_NO_UPDATE_CHECK=1`. `netbeagle upgrade` never runs anything it downloads: the new file must match
the release's `SHA256SUMS` on GitHub and be the one published on npm (for a binary, the `SHA256SUMS` npm
has), so a tampered release would have to be tampered with on both. Then it replaces itself in one rename.

The binaries are release files too (`netbeagle-linux-x64`, `netbeagle-linux-arm64`, `netbeagle-darwin-x64`,
`netbeagle-darwin-arm64`, `netbeagle-windows-x64.exe`), listed in `SHA256SUMS` and attested like the rest;
see [SECURITY.md](SECURITY.md#verifying-a-release).

On Linux and macOS, without root, netbeagle can't see other users' processes, so their sockets show no
process; `sudo netbeagle` shows them all. Windows names every socket's process, but shows other users'
command lines only in an administrator terminal. netbeagle only reads: see
[what it does with your machine](SECURITY.md#what-netbeagle-does-with-your-machine).

## Commands

| Command | What it shows |
|---|---|
| `netbeagle` / `netbeagle list` | every listening port (TCP and UDP): the addresses it is bound to, who can reach it (this machine only, every interface, or the interfaces holding its address), how many clients are connected, and its owner: a process, or the docker container behind a published port |
| `netbeagle who PORT` | what listens on `PORT`: its command line, or its container with the address and network inside; where it is reachable from; every client connected now, with its process when it runs here; and connections from this machine to `PORT` elsewhere. Exits 1 when there are none |
| `netbeagle conns` | every connection, grouped by process: inbound (←) to its ports and outbound (→), with the process, container or route at the other end. `--all` adds sockets opening or closing |
| `netbeagle interfaces` | every interface: kind (ethernet, wifi, bridge, veth, tun, wireguard…), state, addresses, routes, bridge ports, docker containers on it, traffic |
| `netbeagle route HOST` | where packets to `HOST` go: this machine, a container, an attached network, or a gateway; with the interface, the route and the source address |
| `netbeagle watch` | live: every port with its process, the **git checkout and branch** it runs in (or its directory), how long it has been up and its clients, refreshed every couple of seconds; ports that open or close are marked. Select one to see its command line and what started it; `k` stops it, `K` stops it with what started it (`bun run dev`, `npm`, a watcher), `/` filters by branch, port or name |
| `netbeagle kill PORT` | stops what listens on `PORT`, after saying which process it is, in which checkout, started by what, and asking. `--tree` also stops what started it, `--force` kills at once, `-y` doesn't ask; a container is `docker stop`ped |
| `netbeagle doctor` | what is wrong with how this machine listens, each with what is behind it and its fix: databases, caches, debuggers and the docker API reachable from other machines (dev servers too, as notes), and ports two programs share, with which one `localhost` reaches over IPv4 and over IPv6. Exits 1 on errors |
| `netbeagle map` | the whole picture, interface by interface: what is open everywhere, what is bound to each interface, the containers behind each bridge, the connections leaving through each one, which local process talks to which, and the DNS servers |

`netbeagle COMMAND --help` (or `netbeagle help COMMAND`) shows one command's usage, options and examples.
`if`, `ifaces`, `connections`, `graph` and `ls` are accepted too.

Options: `--json`, `--tcp`, `--udp`, `-a, --all`, `--no-docker` (don't ask docker), `--show-secrets` (command
lines are shown with the values of `--token=`, `--password` and the like masked by default).

## How it works

Each system is read its own way, into the same picture, so every command works the same everywhere.

- **Linux**: sockets from `/proc/net/tcp`, `tcp6`, `udp` and `udp6`; IPv4 clients of a socket bound to `::`
  (`::ffff:1.2.3.4`) are shown as IPv4. Each socket's process is found through the `socket:[inode]` links
  in `/proc/PID/fd`. Without root, other users' processes can't be read: their sockets show the user
  only, and `sudo netbeagle` shows them all. Interfaces from `/sys/class/net` (kind, state, bridge and
  its ports, traffic) and their addresses from `getifaddrs`; routes from the kernel's main table,
  `/proc/net/route` and `/proc/net/ipv6_route`.
- **macOS**: every user's sockets from `netstat -an` (`tcp46` for a socket taking both families), and
  the process behind each from `lsof`: without root, only your own, so other users' show no process and
  `sudo netbeagle` shows them all. Interfaces from `ifconfig -a` (bridge members included), their traffic
  from `netstat -ibn`, which one is Wi-Fi from `networksetup`; routes from `netstat -rn`, without the
  ARP entries and interface-scoped copies; processes from `ps`.
- **Windows**: one PowerShell call. Sockets and their processes from `Get-NetTCPConnection` and
  `Get-NetUDPEndpoint` (`netstat` translates its states into the system's language; these don't),
  interfaces, addresses, traffic and DNS servers from .NET's `NetworkInterface`, routes from `Get-NetRoute`
  (their metric plus the interface's, as Windows compares them), command lines from `Win32_Process`.
  It takes a couple of seconds, PowerShell's start included.
- `route` picks the longest matching prefix, then the lowest metric, as the system does (policy
  routing, `ip rule` on Linux, is not replayed).
- **Containers**: `docker inspect` of the running containers gives their networks (and the host bridge
  each uses, `docker0` or `br-<network id>`) and their published ports. A published port belongs to
  its container, whether `docker-proxy` holds a socket for it or the firewall forwards it with none.
- **Containers on macOS and Windows**: Docker Desktop runs them in a VM, so their networks are not on this
  machine; a published port shows its container all the same.
- **Who reaches what**: a socket on `127.0.0.1`, `::1` or another address of the loopback is reachable
  from this machine only; on `0.0.0.0` or `::`, from every interface; on one address, from the interface
  holding it. A socket on `::` takes IPv4 too by default on Linux (`net.ipv6.bindv6only` is 0) and on
  macOS (`tcp46`), and IPv6 only on Windows unless its program asks for both: those say
  `every interface, IPv6 only`. Firewall rules are not taken into account.
- **WSL**: Windows forwards its own `localhost` to ports bound to `127.0.0.1` or every interface in the
  WSL VM, so those say `+ Windows`.
- Connections between two processes of this machine are matched end to end, so `curl 400 → :5000 node
  300` names both sides.

## Status

Linux (WSL included), macOS and Windows. Planned: more `netbeagle doctor` checks (no default route or
two of them, a VPN taking all traffic, DNS servers with no route), firewall rules, network namespaces
(inside containers).

## The pack

netbeagle has a sibling, built the same way: one small file for Node or Bun, or a standalone binary,
nothing to configure.

| Tool | What it finds | Try it |
|---|---|---|
| **netbeagle** | which process or container listens on each port, who can reach it, and how everything on your machine connects | `npx netbeagle` |
| **[envhound](https://github.com/michelsalib/envhound)** | which startup file (or registry key) sets each environment variable, and your `PATH` | `npx envhound` |

## Development

```sh
bun install
bun run dev -- map          # run from source
bun test                    # unit tests on the fixtures of each system, plus the built CLI on node on this machine
bun run typecheck
bun run lint                # Biome: formatting and lint
bun run build               # dist/netbeagle.js, plain JS for node >= 20
```

`test/fixtures/root` is a small Linux machine as `/proc`, `/sys` and `/etc` show it, written by
`scripts/fixture.py` (its docstring describes it); `test/fixtures/macos` holds what its commands print
on a Mac, and `test/fixtures/windows` what netbeagle's PowerShell script prints on Windows. Source uses only `node:` APIs, so the build runs on
both Node and Bun.

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull requests and releases.

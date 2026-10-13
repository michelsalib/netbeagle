# Changelog

All notable changes to netbeagle. Versions follow [semantic versioning](https://semver.org).

## 0.3.0 (2026-10-13)

### Added

- `netbeagle doctor`: what is wrong with how this machine listens, each with what is behind it and
  its fix. Databases, caches, Jupyter, the Node.js inspector and the docker API reachable from other
  machines (the last two are errors: they run code), dev servers as notes; a published container's
  fix is its `-p 127.0.0.1:…`. And ports two programs share, with which one `localhost` reaches over
  IPv4 and over IPv6. `--json`; exits 1 on errors.
- `netbeagle watch`: every port live, with the git checkout and branch each server runs in (or its
  directory), its uptime and clients; ports that open or close are marked. Select one for its command
  line and what started it; `k` stops it (again: SIGKILL), `K` stops it with the `bun run dev`, `npm`
  or watcher that started it, a container is `docker stop`ped; `/` filters.
- `netbeagle kill PORT`: says which process listens on it, in which checkout, started by what, and asks
  before stopping it. `--tree`, `--force`, `-y`.
- `who` shows a server's git checkout and branch (or directory), what started it and since when.
- Processes carry their parent, start time, working directory (Linux and macOS) and git checkout in
  `--json`.
- Homebrew (macOS and Linux) and Scoop (Windows):
  `brew install michelsalib/netbeagle/netbeagle`, or
  `scoop bucket add netbeagle https://github.com/michelsalib/scoop-netbeagle` then
  `scoop install netbeagle/netbeagle`. Each release updates them.

### Fixed

- A port's clients are the connections open now: not those closing (TIME_WAIT, CLOSE_WAIT), which
  counted for up to a minute after a burst of requests. `conns --all` still shows them.
- A client of a container's published port is one client: docker-proxy's connection to the
  container on its behalf is shown with it ("each relayed by docker-proxy to 172.18.0.3:6379"), no
  longer as a connection to that port elsewhere, and `conns` names docker-proxy even without root.
- On Linux, every process is read, not only those holding a socket: a server's parent too.
- A local server on a port a container also publishes (postgres on 127.0.0.1:5432 beside a container
  on 0.0.0.0:5432) is its own listener, no longer counted as the container's.

## 0.2.0 (2026-10-12)

### Added

- macOS and Windows. On macOS, netbeagle reads `netstat`, `lsof`, `ifconfig` and `ps`: without root,
  other users' sockets show no process, as on Linux. On Windows, one PowerShell call gives every
  socket's process, the interfaces, routes and DNS servers; other users' command lines need an
  administrator terminal.
- Standalone binaries for macOS (x64, arm64) and Windows (x64), `install.sh` on macOS and
  `install.ps1` on Windows.
- A socket on `::` that takes IPv6 only (Windows' default, `tcp6` on macOS, `net.ipv6.bindv6only=1`
  on Linux) is reachable from `every interface, IPv6 only`, and only from interfaces with an IPv6
  address.

### Changed

- In `--json`, a socket's `uid` and `inode` can be missing (Windows has neither; macOS doesn't tell
  other users' without root), and a listener's `user` too. A socket no process holds any more has
  `orphan: true`.
- The `list` table shows the first two addresses of a service bound to more, and how many others.

### Fixed

- Without root, sockets closing (TIME_WAIT) are no longer counted among other users' sockets.

## 0.1.0 (2026-10-12)

### Added

- `netbeagle list`: every listening port, its owner (process or docker container), the addresses it is
  bound to, who can reach it and how many clients it has.
- `netbeagle who PORT`, `netbeagle conns`, `netbeagle interfaces`, `netbeagle route HOST` and
  `netbeagle map`.
- `--json` on every command; `--no-docker`; command lines masked unless `--show-secrets`.
- Linux and WSL, from `/proc`, `/sys` and `docker inspect`.
- `--version` and `--help` show the logo in a terminal: the beagle, looking over a network switch.
- Install with `npx netbeagle`, `npm install -g netbeagle` or `install.sh`, which falls back to a
  standalone binary (x64, arm64) without Node or Bun. Release files carry signed build provenance.
- `netbeagle --help` and the README point to envhound, netbeagle's sibling: which startup file sets
  each environment variable.

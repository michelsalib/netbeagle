# Changelog

All notable changes to netbeagle. Versions follow [semantic versioning](https://semver.org).

## Unreleased

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

# Changelog

All notable changes to netbeagle. Versions follow [semantic versioning](https://semver.org).

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

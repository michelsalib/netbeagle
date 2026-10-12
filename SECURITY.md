# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately, through GitHub:
**[Report a vulnerability](https://github.com/michelsalib/netbeagle/security/advisories/new)**.
Don't open a public issue for them.

You'll get an answer within a week. Once a fix is released, the advisory is published with credit
to you, unless you'd rather not be named.

Only the latest release gets security fixes.

## What netbeagle does with your machine

These are worth knowing when you judge what counts as a vulnerability:

- **It only reads.** netbeagle reads `/proc` (sockets, and each process's open files and command
  line), `/sys/class/net` and `/etc/resolv.conf`. It changes nothing: no file is written, no
  interface, route or firewall rule is touched.
- **It runs `docker`**: `docker ps -q` and `docker inspect` of the running containers, to know which
  container sits behind each published port. `--no-docker` turns that off.
- **Root is optional.** Without it, other users' processes can't be read, and their sockets show only
  the user. Under `sudo` it sees them all, and still only reads.
- **Secret values are masked** in command lines (the values of `--token=`, `--password` and the like)
  in every output, `--json` included, unless you pass `--show-secrets`.
- **Network:** none, except `netbeagle route HOST` with a host name, which asks your DNS resolver for its
  address.

## Verifying a release

Every release is built by GitHub Actions from the tagged commit, and its files carry signed build
provenance, also attached to the release as `netbeagle.intoto.jsonl`:

```sh
# the GitHub release files: netbeagle.js, install.sh and the standalone binaries
gh attestation verify netbeagle.js -R michelsalib/netbeagle
sha256sum --check --ignore-missing SHA256SUMS
# the npm package
npm audit signatures
```

The build is reproducible: `git checkout vX.Y.Z && bun install --frozen-lockfile && bun run build`
gives the same `dist/netbeagle.js` as the release's `SHA256SUMS` (with the Bun version in
`.bun-version`).

The sources are analysed by CodeQL on every pull request, and the project's practices are tracked by
[OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/michelsalib/netbeagle).

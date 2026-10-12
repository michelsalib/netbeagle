# Contributing to netbeagle

Bug reports, ideas and pull requests are welcome. For anything bigger than a fix, open an issue
first so we can agree on the approach.

## Setting up

You need [Bun](https://bun.sh) (the version in `.bun-version`), Node 20 or newer, and Linux or WSL.

```sh
bun install
bun run dev -- map          # run from source
bun test                    # unit tests on test/fixtures/root, plus the built CLI on node on this machine
bun run typecheck
bun run lint                # Biome: formatting and lint; `bunx biome check --write` fixes most of it
```

`test/fixtures/root` is a small machine as `/proc`, `/sys` and `/etc` show it, written by
`scripts/fixture.py`: change the script, not the files, and run `python3 scripts/fixture.py`. CI checks
the two agree.

## Pull requests

- Keep each pull request to one change, with a test that fails without it.
- CI must pass on x64 and arm64; `main` only accepts pull requests with green checks.
- Write commit messages that say what changed and why, in plain sentences.
- User-visible changes go in `CHANGELOG.md`, under "Unreleased".

## Releasing (maintainers)

1. In a pull request, move the "Unreleased" notes of `CHANGELOG.md` under the new version and bump
   `version` in `package.json`.
2. Once it's merged, tag the merge commit and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. The release workflow tests and builds the files, then waits for approval in the `release`
   environment. Approve it to publish to npm and create the GitHub release.

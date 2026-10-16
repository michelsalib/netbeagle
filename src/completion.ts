// Shell completion. The scripts are thin: on every <Tab> they call `netbeagle __complete <words...>`,
// so candidates are always live: `netbeagle kill <Tab>` lists the ports listening now, each with
// what holds it.

import { ALIASES, COMMAND_HELP, OPTIONS } from "./help.ts";

export const SHELLS = ["bash", "zsh", "fish", "powershell"] as const;
export type CompletionShell = (typeof SHELLS)[number];

/** A listening port as completion offers it. */
export interface PortCandidate {
	port: number;
	/** What holds it: "node 4127  app-feature (feature-x)", "container pg". */
	about: string;
}

/** The commands that take a port, and offer the ones listening now. */
const TAKES_PORT = new Set(["who", "kill", "open"]);

/** --long for an OPTIONS key: "-y, --yes" gives --yes. */
const long = (key: string) =>
	(OPTIONS[key]?.[0] ?? "").split(", ").find((f) => f.startsWith("--")) ??
	`--${key}`;

/**
 * Candidates for the last word of `words` (the words after `netbeagle`, the last one being typed), as
 * `name` or `name<TAB>description`. `ports` is called only when ports are wanted: it reads the machine.
 */
export function complete(
	words: string[],
	ports: () => PortCandidate[],
): string[] {
	const cur = words.at(-1) ?? "";
	const positionals = words.slice(0, -1).filter((w) => !w.startsWith("-"));
	const given = positionals[0];
	const command = given && (ALIASES[given] ?? given);

	let candidates: [string, string?][] = [];
	if (cur.startsWith("-")) {
		// the command's own options, or every option before a command
		const keys =
			command && COMMAND_HELP[command]
				? COMMAND_HELP[command].options
				: Object.keys(OPTIONS);
		candidates = [...new Set([...keys, "help"])].map((k) => [
			long(k),
			OPTIONS[k]?.[1].split("\n")[0],
		]);
	} else if (positionals.length === 0)
		candidates = [
			...Object.entries(COMMAND_HELP).map(
				([name, h]) => [name, h.summary] as [string, string],
			),
			["help", "help for netbeagle, or for one command"],
		];
	else if (positionals.length === 1 && command && TAKES_PORT.has(command))
		candidates = ports().map((p) => [String(p.port), p.about]);
	else if (positionals.length === 1 && command === "help")
		candidates = Object.entries(COMMAND_HELP).map(([name, h]) => [
			name,
			h.summary,
		]);
	else if (positionals.length === 1 && command === "completion")
		candidates = SHELLS.map((s) => [s]);

	return candidates
		.filter(([name]) => name.startsWith(cur))
		.map(([name, desc]) => (desc ? `${name}\t${desc}` : name));
}

export function completionScript(shell: CompletionShell): string {
	switch (shell) {
		case "bash":
			return `# netbeagle completion for bash. Add to ~/.bashrc:  eval "$(netbeagle completion bash)"
_netbeagle() {
    # a loop, not "\${COMP_WORDS[@]:1:COMP_CWORD}": macOS's bash 3.2 joins that slice into one word
    local i args=()
    for ((i = 1; i <= COMP_CWORD; i++)); do args+=("\${COMP_WORDS[i]}"); done
    local IFS=$'\\n'
    COMPREPLY=($(netbeagle __complete "\${args[@]}" 2>/dev/null | cut -f1))
}
complete -F _netbeagle netbeagle
`;
		case "zsh":
			return `# netbeagle completion for zsh. Add to ~/.zshrc (after compinit):  eval "$(netbeagle completion zsh)"
_netbeagle() {
    local -a lines candidates
    local line name
    lines=("\${(@f)$(netbeagle __complete "\${(@)words[2,CURRENT]}" 2>/dev/null)}")
    for line in $lines; do
        [[ -n $line ]] || continue
        name=\${\${line%%$'\\t'*}//:/\\\\:}
        if [[ $line == *$'\\t'* ]]; then candidates+=("$name:\${line#*$'\\t'}"); else candidates+=("$name"); fi
    done
    (( \${#candidates} )) && _describe netbeagle candidates
}
compdef _netbeagle netbeagle
`;
		case "fish":
			return `# netbeagle completion for fish. Save as ~/.config/fish/completions/netbeagle.fish:
#   netbeagle completion fish > ~/.config/fish/completions/netbeagle.fish
complete -c netbeagle -f -a '(netbeagle __complete (commandline -opc)[2..-1] (commandline -ct) 2>/dev/null)'
`;
		// Windows PowerShell drops empty arguments to programs, so the word being typed goes first,
		// behind a "_" that keeps it from being empty
		case "powershell":
			return `# netbeagle completion for PowerShell. Add to your profile (notepad $PROFILE):
#   netbeagle completion powershell | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName netbeagle -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $before = @($commandAst.CommandElements | Select-Object -Skip 1 |
        Where-Object { $_.Extent.EndOffset -lt $cursorPosition } |
        ForEach-Object { $_.Extent.Text })
    netbeagle __complete-powershell "_$wordToComplete" @before 2>$null | ForEach-Object {
        $name, $desc = $_ -split "\`t", 2
        [System.Management.Automation.CompletionResult]::new($name, $name, 'ParameterValue', $(if ($desc) { $desc } else { $name }))
    }
}
`;
	}
}

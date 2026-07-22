export const SUPPORTED_SHELLS = ["powershell", "bash", "zsh", "fish"] as const;
export type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

const commands = [
  "start",
  "status",
  "doctor",
  "devices",
  "login",
  "logout",
  "completions",
];

function powershellScript(): string {
  const list = commands.map((c) => `'${c}'`).join(", ");
  return `# PowerShell completion for Glossa. Source it from your PowerShell profile.
Register-ArgumentCompleter -Native -CommandName glossa -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    $commands = @(${list})
    switch ($commandAst.CommandElements[1].Value) {
        'devices' {
            @('list', 'rename', 'revoke') | Where-Object { $_ -like "$wordToComplete*" } |
                ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
            return
        }
        'completions' {
            @('powershell', 'bash', 'zsh', 'fish') | Where-Object { $_ -like "$wordToComplete*" } |
                ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
            return
        }
    }
    $commands | Where-Object { $_ -like "$wordToComplete*" } |
        ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
}
`;
}

function bashScript(): string {
  return `# Bash completion for Glossa. Source it or install under /etc/bash_completion.d.
_glossa() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( \$(compgen -W "${commands.join(" ")} --help --version" -- "\$cur") )
    return
  fi
  case "\${COMP_WORDS[1]}" in
    devices)
      COMPREPLY=( \$(compgen -W "list rename revoke" -- "\$cur") )
      return ;;
    completions)
      COMPREPLY=( \$(compgen -W "powershell bash zsh fish" -- "\$cur") )
      return ;;
    start)
      COMPREPLY=( \$(compgen -W "--allow-broad-root" -- "\$cur") )
      return ;;
  esac
  COMPREPLY=( \$(compgen -W "--json --browser --help" -- "\$cur") )
}
complete -F _glossa glossa
`;
}

function zshScript(): string {
  return `#compdef glossa
# Zsh completion for Glossa. Source it or drop into a directory on \$fpath as _glossa.
_glossa() {
  local -a commands
  commands=(
    'start:expose a workspace'
    'status:show account, relay, and active workers'
    'doctor:run readiness checks'
    'devices:manage enrolled computers'
    'login:ensure a Glossa session'
    'logout:remove local credentials'
    'completions:emit a shell completion script'
  )
  _arguments -C '1: :->commands' '*::arg:->args'
  case "\$state" in
    commands) _describe 'glossa command' commands ;;
    args)
      case \$words[1] in
        devices) _arguments '1:action:(list rename revoke)' ;;
        completions) _arguments '1:shell:(powershell bash zsh fish)' ;;
        start) _arguments '--allow-broad-root[allow home or drive roots]' ;;
      esac ;;
  esac
}
_glossa "\$@"
`;
}

function fishScript(): string {
  const lines = [
    "# Fish completion for Glossa. Source it or drop into ~/.config/fish/completions.",
    "complete -c glossa -f",
    ...commands.map((c) => `complete -c glossa -n '__fish_use_subcommand' -a '${c}'`),
    "complete -c glossa -n '__fish_seen_subcommand_from devices' -a 'list rename revoke'",
    "complete -c glossa -n '__fish_seen_subcommand_from completions' -a 'powershell bash zsh fish'",
    "complete -c glossa -n '__fish_seen_subcommand_from start' -l allow-broad-root",
    "complete -c glossa -n '__fish_seen_subcommand_from status' -l json",
    "complete -c glossa -n '__fish_seen_subcommand_from logout' -l browser",
    "",
  ];
  return `${lines.join("\n")}`;
}

export function completionScript(shell: SupportedShell): string {
  switch (shell) {
    case "powershell":
      return powershellScript();
    case "bash":
      return bashScript();
    case "zsh":
      return zshScript();
    case "fish":
      return fishScript();
  }
}

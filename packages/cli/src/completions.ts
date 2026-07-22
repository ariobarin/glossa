export const SUPPORTED_SHELLS = ["powershell", "bash", "zsh", "fish"] as const;
export type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

const commands = [
  "start",
  "status",
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
    $elements = $commandAst.CommandElements
    $last = $elements[$elements.Count - 1]
    # Position of the argument being completed (1 = first argument after glossa).
    # A trailing space starts a new argument; otherwise we complete the last token.
    if ($cursorPosition -gt $last.Extent.EndOffset) {
        $position = $elements.Count
    } else {
        $position = $elements.Count - 1
    }
    if ($position -eq 1) {
        # First argument: offer subcommands. Path-like input matches no command,
        # so PowerShell falls back to filesystem completion for glossa ./<TAB>.
        $commands | Where-Object { $_ -like "$wordToComplete*" } |
            ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
        return
    }
    # Later arguments: complete subcommand values, otherwise return nothing so
    # PowerShell completes filesystem paths (for example: glossa start ./<TAB>).
    switch ($elements[1].Value) {
        'devices' {
            @('list', 'rename', 'revoke') | Where-Object { $_ -like "$wordToComplete*" } |
                ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
        }
        'completions' {
            @('powershell', 'bash', 'zsh', 'fish') | Where-Object { $_ -like "$wordToComplete*" } |
                ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
        }
    }
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
  local cmd="\${COMP_WORDS[1]}"
  if [[ "\$cur" == -* ]]; then
    case "\$cmd" in
      start)   COMPREPLY=( \$(compgen -W "--allow-broad-root" -- "\$cur") ) ;;
      status)  COMPREPLY=( \$(compgen -W "--json" -- "\$cur") ) ;;
      devices) COMPREPLY=( \$(compgen -W "--json" -- "\$cur") ) ;;
      logout)  COMPREPLY=( \$(compgen -W "--browser" -- "\$cur") ) ;;
    esac
    return
  fi
  case "\$cmd" in
    devices)     COMPREPLY=( \$(compgen -W "list rename revoke" -- "\$cur") ) ;;
    completions) COMPREPLY=( \$(compgen -W "powershell bash zsh fish" -- "\$cur") ) ;;
    start)       ;;  # workspace directory: fall through to filename completion
  esac
}
# -o default lets readline fall back to filename completion for the workspace
# path argument (for example: glossa start ./<TAB>) when no match is produced.
complete -o default -F _glossa glossa
`;
}

function zshScript(): string {
  return `# Zsh completion for Glossa. Source this after compinit from your profile.
_glossa() {
  local -a commands
  commands=(
    'start:expose a workspace'
    'status:show account, relay, and active workers'
    'devices:manage enrolled computers'
    'login:ensure a Glossa session'
    'logout:remove local credentials'
    'completions:emit a shell completion script'
  )
  _arguments -C '1: :->commands' '*::arg:->args'
  case "\$state" in
    commands)
      _describe 'glossa command' commands
      # Also offer files so the workspace path argument completes (glossa ./<TAB>).
      _files
      ;;
    args)
      case \$words[2] in
        devices) _arguments '1:action:(list rename revoke)' ;;
        completions) _arguments '1:shell:(powershell bash zsh fish)' ;;
        start)
          _arguments '--allow-broad-root[allow home or drive roots]'
          _files
          ;;
      esac ;;
  esac
}
compdef _glossa glossa
`;
}

function fishScript(): string {
  const lines = [
    "# Fish completion for Glossa. Source it or drop into ~/.config/fish/completions.",
    // No global -f: the first argument may be a workspace directory, so fish
    // should still offer files there.
    ...commands.map((c) => `complete -c glossa -n '__fish_use_subcommand' -a '${c}'`),
    "complete -c glossa -f -n '__fish_seen_subcommand_from devices' -a 'list rename revoke'",
    "complete -c glossa -f -n '__fish_seen_subcommand_from completions' -a 'powershell bash zsh fish'",
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

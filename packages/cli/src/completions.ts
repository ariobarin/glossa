export const SUPPORTED_SHELLS = ["powershell", "bash", "zsh", "fish"] as const;
export type SupportedShell = (typeof SUPPORTED_SHELLS)[number];

const commands = [
  "ui",
  "start",
  "status",
  "doctor",
  "devices",
  "completions",
  "update",
  "upgrade",
  "login",
  "logout",
];

function powershellScript(): string {
  const list = commands.map((command) => `'${command}'`).join(", ");
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
        @($commands + '--help' + '--version') |
            Where-Object { $_ -like "$wordToComplete*" } |
            ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
        return
    }
    $command = $elements[1].Value
    if ($wordToComplete -like '-*') {
        switch ($command) {
            'ui' {
                @('--allow-broad-root', '--device-name') | Where-Object { $_ -like "$wordToComplete*" } |
                    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }
            }
            'start' {
                @('--allow-broad-root', '--device-name') | Where-Object { $_ -like "$wordToComplete*" } |
                    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }
            }
            'status' {
                @('--json') | Where-Object { $_ -like "$wordToComplete*" } |
                    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }
            }
            'doctor' {
                @('--json') | Where-Object { $_ -like "$wordToComplete*" } |
                    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }
            }
            'devices' {
                if ($position -eq 3 -and $elements[2].Value -eq 'list') {
                    @('--json') | Where-Object { $_ -like "$wordToComplete*" } |
                        ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }
                }
            }
            'logout' {
                @('--browser') | Where-Object { $_ -like "$wordToComplete*" } |
                    ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_) }
            }
        }
        return
    }
    if ($position -eq 2) {
        switch ($command) {
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
}
`;
}

function bashScript(): string {
  return `# Bash completion for Glossa. Source it or install under /etc/bash_completion.d.
_glossa() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${commands.join(" ")} --help --version" -- "$cur") )
    return
  fi
  local cmd="\${COMP_WORDS[1]}"
  if [[ "$cur" == -* ]]; then
    case "$cmd" in
      ui|start) COMPREPLY=( $(compgen -W "--allow-broad-root --device-name" -- "$cur") ) ;;
      status|doctor) COMPREPLY=( $(compgen -W "--json" -- "$cur") ) ;;
      devices)
        if [ "$COMP_CWORD" -eq 3 ] && [ "\${COMP_WORDS[2]}" = "list" ]; then
          COMPREPLY=( $(compgen -W "--json" -- "$cur") )
        fi ;;
      logout) COMPREPLY=( $(compgen -W "--browser" -- "$cur") ) ;;
    esac
    return
  fi
  case "$cmd" in
    devices)
      if [ "$COMP_CWORD" -eq 2 ]; then
        COMPREPLY=( $(compgen -W "list rename revoke" -- "$cur") )
      fi ;;
    completions)
      if [ "$COMP_CWORD" -eq 2 ]; then
        COMPREPLY=( $(compgen -W "powershell bash zsh fish" -- "$cur") )
      fi ;;
    ui|start) ;; # workspace directory: fall through to filename completion
  esac
}
# -o default lets readline fall back to filename completion for workspace paths
# when the completion function produces no matches.
complete -o default -F _glossa glossa
`;
}

function zshScript(): string {
  return `# Zsh completion for Glossa. Source this after compinit from your profile.
_glossa() {
  local context state state_descr line
  typeset -A opt_args
  local -a glossa_commands
  glossa_commands=(
    'ui:open the interactive session HUD'
    'start:expose a workspace'
    'status:show account, relay, and active workers'
    'doctor:check local and relay readiness'
    'devices:manage enrolled computers'
    'completions:emit a shell completion script'
    'update:update from the npm beta channel'
    'upgrade:alias for update'
    'login:ensure a Glossa session'
    'logout:remove local credentials'
  )
  _arguments -C '1:command or workspace:->commands' '*::argument:->args'
  case "$state" in
    commands)
      _describe 'glossa command' glossa_commands
      _files
      ;;
    args)
      case $words[2] in
        devices)
          if (( CURRENT == 3 )); then
            _values 'device action' list rename revoke
          elif [[ $words[3] == list ]]; then
            _arguments '--json[print machine-readable JSON]'
          fi
          ;;
        completions) _arguments '2:shell:(powershell bash zsh fish)' ;;
        ui|start)
          _arguments \
            '--allow-broad-root[allow home or drive roots]' \
            '--device-name[name this computer on first enrollment]:device name:' \
            '2:workspace:_directories'
          ;;
        status|doctor) _arguments '--json[print machine-readable JSON]' ;;
        logout) _arguments '--browser[also sign out of the browser session]' ;;
      esac
      ;;
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
    ...commands.map((command) =>
      `complete -c glossa -n '__fish_use_subcommand' -a '${command}'`,
    ),
    "complete -c glossa -f -n '__fish_seen_subcommand_from devices; and test (count (commandline -opc)) -eq 2' -a 'list rename revoke'",
    "complete -c glossa -f -n '__fish_seen_subcommand_from completions; and test (count (commandline -opc)) -eq 2' -a 'powershell bash zsh fish'",
    "complete -c glossa -n '__fish_seen_subcommand_from ui start' -l allow-broad-root",
    "complete -c glossa -n '__fish_seen_subcommand_from ui start' -l device-name -r",
    "complete -c glossa -n '__fish_seen_subcommand_from status doctor' -l json",
    "complete -c glossa -n '__fish_seen_subcommand_from devices; and contains -- list (commandline -opc)' -l json",
    "complete -c glossa -n '__fish_seen_subcommand_from logout' -l browser",
    "",
  ];
  return lines.join("\n");
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

export class UsageError extends Error {}

export type CliInvocation =
  | { command: "workspace"; path?: string }
  | { command: "help" }
  | { command: "version" };

function parseWorkspace(args: string[]): CliInvocation {
  let selectedPath: string | undefined;
  let optionsEnded = false;

  for (const argument of args) {
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
    } else if (!optionsEnded && argument.startsWith("-")) {
      throw new UsageError(`Unknown option: ${argument}`);
    } else if (selectedPath) {
      throw new UsageError("Glossa accepts at most one directory.");
    } else {
      selectedPath = argument;
    }
  }

  return {
    command: "workspace",
    ...(selectedPath ? { path: selectedPath } : {}),
  };
}

export function parseInvocation(args: string[]): CliInvocation {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    return { command: "help" };
  }
  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    return { command: "version" };
  }
  return parseWorkspace(args);
}

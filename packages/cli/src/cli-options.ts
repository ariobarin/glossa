import { existsSync } from "node:fs";
import path from "node:path";
import { deviceNameSchema } from "@glossa/protocol";

export class UsageError extends Error {}

export type HelpTopic =
  | "start"
  | "status"
  | "doctor"
  | "devices"
  | "update"
  | "login"
  | "logout";

export type CliInvocation =
  | { command: "start"; path?: string; allowBroadRoot: boolean; deviceName?: string }
  | { command: "status"; json: boolean }
  | { command: "doctor"; json: boolean }
  | { command: "devices"; action: "list"; json: boolean }
  | { command: "devices"; action: "rename"; deviceId: string; name: string }
  | { command: "devices"; action: "revoke"; deviceId: string }
  | { command: "update" }
  | { command: "login" }
  | { command: "logout"; browser: boolean }
  | { command: "help"; topic?: HelpTopic }
  | { command: "version" };

const helpTopics = new Set<HelpTopic>([
  "start",
  "status",
  "doctor",
  "devices",
  "update",
  "login",
  "logout",
]);

function parseDeviceName(value: string): string {
  const parsed = deviceNameSchema.safeParse(value);
  if (!parsed.success) {
    throw new UsageError(
      "Device names must be 1 to 80 characters with no control characters.",
    );
  }
  return parsed.data;
}

function parseWorkspaceCommand(args: string[]): CliInvocation {
  if (args.includes("--help") || args.includes("-h")) {
    return { command: "help", topic: "start" };
  }
  let selectedPath: string | undefined;
  let allowBroadRoot = false;
  let deviceName: string | undefined;
  let optionsEnded = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
    } else if (!optionsEnded && argument === "--allow-broad-root") {
      allowBroadRoot = true;
    } else if (!optionsEnded && argument === "--device-name") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new UsageError("--device-name requires a value.");
      }
      deviceName = parseDeviceName(value);
      index += 1;
    } else if (!optionsEnded && argument.startsWith("--device-name=")) {
      deviceName = parseDeviceName(argument.slice("--device-name=".length));
    } else if (!optionsEnded && argument.startsWith("-")) {
      throw new UsageError(`Unknown start option: ${argument}`);
    } else if (selectedPath) {
      throw new UsageError("Start accepts at most one directory.");
    } else {
      selectedPath = argument;
    }
  }
  return {
    command: "start",
    ...(selectedPath ? { path: selectedPath } : {}),
    allowBroadRoot,
    ...(deviceName ? { deviceName } : {}),
  };
}

function singleJsonOption(command: string, args: string[]): boolean {
  if (args.length === 0) return false;
  if (args.length === 1 && args[0] === "--json") return true;
  throw new UsageError(`${command} accepts only --json.`);
}

function parseDevices(args: string[]): CliInvocation {
  const [action, ...options] = args;
  if (!action || action === "--help" || action === "-h") {
    return { command: "help", topic: "devices" };
  }
  if (action === "list") {
    return { command: "devices", action, json: singleJsonOption("Devices list", options) };
  }
  if (action === "rename" && options.length === 2) {
    return { command: "devices", action, deviceId: options[0]!, name: options[1]! };
  }
  if (action === "revoke" && options.length === 1) {
    return { command: "devices", action, deviceId: options[0]! };
  }
  throw new UsageError("Use: glossa devices list, rename <id> <name>, or revoke <id>.");
}

function likelyDirectory(value: string): boolean {
  return (
    value === "." ||
    value === ".." ||
    path.isAbsolute(value) ||
    value.includes("/") ||
    value.includes("\\") ||
    existsSync(value)
  );
}

const KNOWN_COMMANDS = [
  "start",
  "status",
  "doctor",
  "devices",
  "update",
  "upgrade",
  "login",
  "logout",
] as const;

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let previous = Array.from({ length: n + 1 }, (_, index) => index);
  for (let i = 1; i <= m; i += 1) {
    const current = [i];
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + cost,
      );
    }
    previous = current;
  }
  return previous[n]!;
}

export function suggestCommand(input: string): string | undefined {
  const lower = input.toLowerCase();
  if (lower.length >= 3) {
    const prefixMatches = KNOWN_COMMANDS.filter((command) => command.startsWith(lower));
    if (prefixMatches.length === 1) return prefixMatches[0];
  }
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const command of KNOWN_COMMANDS) {
    const distance = editDistance(lower, command);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = command;
    }
  }
  if (best && bestDistance <= 3 && bestDistance <= Math.ceil(lower.length / 2)) {
    return best;
  }
  return undefined;
}

export function parseInvocation(args: string[]): CliInvocation {
  const [command, ...options] = args;
  if (!command) return parseWorkspaceCommand([]);
  if (command === "--help" || command === "-h") {
    if (options.length > 0) throw new UsageError("Help accepts one command name.");
    return { command: "help" };
  }
  if (command === "help") {
    if (options.length > 1) throw new UsageError("Help accepts one command name.");
    const topic = options[0];
    if (!topic) return { command: "help" };
    if (!helpTopics.has(topic as HelpTopic)) {
      throw new UsageError(`Unknown help topic: ${topic}`);
    }
    return { command: "help", topic: topic as HelpTopic };
  }
  if (command === "--version" || command === "-v") {
    if (options.length > 0) throw new UsageError("Version accepts no arguments.");
    return { command: "version" };
  }
  if (command === "start") return parseWorkspaceCommand(options);
  if (command === "status") {
    if (options.includes("--help") || options.includes("-h")) {
      return { command: "help", topic: "status" };
    }
    return { command: "status", json: singleJsonOption("Status", options) };
  }
  if (command === "doctor") {
    if (options.includes("--help") || options.includes("-h")) {
      return { command: "help", topic: "doctor" };
    }
    return { command: "doctor", json: singleJsonOption("Doctor", options) };
  }
  if (command === "devices") return parseDevices(options);
  if (command === "update" || command === "upgrade") {
    if (options.includes("--help") || options.includes("-h")) {
      return { command: "help", topic: "update" };
    }
    if (options.length > 0) {
      throw new UsageError(`${command === "update" ? "Update" : "Upgrade"} accepts no arguments.`);
    }
    return { command: "update" };
  }
  if (command === "login") {
    if (options.includes("--help") || options.includes("-h")) {
      return { command: "help", topic: "login" };
    }
    if (options.length > 0) throw new UsageError("Login accepts no arguments.");
    return { command: "login" };
  }
  if (command === "logout") {
    if (options.includes("--help") || options.includes("-h")) {
      return { command: "help", topic: "logout" };
    }
    if (options.length === 0) return { command: "logout", browser: false };
    if (options.length === 1 && options[0] === "--browser") {
      return { command: "logout", browser: true };
    }
    throw new UsageError("Logout accepts only --browser.");
  }
  if (command === "--") return parseWorkspaceCommand(options);
  if (command.startsWith("-")) return parseWorkspaceCommand(args);
  if (likelyDirectory(command)) return parseWorkspaceCommand(args);
  const suggestion = suggestCommand(command);
  throw new UsageError(
    suggestion
      ? `Unknown command: ${command}. Did you mean "${suggestion}"?`
      : `Unknown command: ${command}`,
  );
}

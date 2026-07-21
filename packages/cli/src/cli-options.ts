import { existsSync } from "node:fs";
import path from "node:path";

export class UsageError extends Error {}

export type HelpTopic = "start" | "status" | "devices" | "login" | "logout";

export type CliInvocation =
  | { command: "start"; path?: string; allowBroadRoot: boolean }
  | { command: "status"; json: boolean }
  | { command: "devices"; action: "list"; json: boolean }
  | { command: "devices"; action: "rename"; deviceId: string; name: string }
  | { command: "devices"; action: "revoke"; deviceId: string }
  | { command: "login" }
  | { command: "logout"; browser: boolean }
  | { command: "help"; topic?: HelpTopic }
  | { command: "version" };

const helpTopics = new Set<HelpTopic>(["start", "status", "devices", "login", "logout"]);

function parseStart(args: string[]): CliInvocation {
  if (args.includes("--help") || args.includes("-h")) {
    return { command: "help", topic: "start" };
  }
  let selectedPath: string | undefined;
  let allowBroadRoot = false;
  let optionsEnded = false;
  for (const argument of args) {
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
    } else if (!optionsEnded && argument === "--allow-broad-root") {
      allowBroadRoot = true;
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

export function parseInvocation(args: string[]): CliInvocation {
  const [command, ...options] = args;
  if (!command) return parseStart([]);
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
  if (command === "start") return parseStart(options);
  if (command === "status") {
    if (options.includes("--help") || options.includes("-h")) {
      return { command: "help", topic: "status" };
    }
    return { command: "status", json: singleJsonOption("Status", options) };
  }
  if (command === "devices") return parseDevices(options);
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
  if (command === "--") return parseStart(options);
  if (command.startsWith("-")) return parseStart(args);
  if (likelyDirectory(command)) return parseStart(args);
  throw new UsageError(`Unknown command: ${command}`);
}

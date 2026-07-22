import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { ManagedSessionEvent } from "./worker/managed-session.js";

export type PaletteCommand = "start" | "stop" | "status" | "devices" | "help" | "clear" | "quit";

export interface PaletteUiActions {
  workspace: string;
  start(signal: AbortSignal, onEvent: (event: ManagedSessionEvent) => void): Promise<void>;
  status(): Promise<void>;
  devices(): Promise<void>;
}

const commands: readonly PaletteCommand[] = [
  "start",
  "stop",
  "status",
  "devices",
  "help",
  "clear",
  "quit",
];

export function parsePaletteCommand(value: string): PaletteCommand | undefined {
  const command = value.trim().toLocaleLowerCase();
  if (command === "?" || command === "h") return "help";
  if (command === "q" || command === "exit") return "quit";
  return commands.find((candidate) => candidate === command);
}

export function completePaletteCommand(line: string): [string[], string] {
  const normalized = line.trimStart().toLocaleLowerCase();
  const matches = commands.filter((command) => command.startsWith(normalized));
  return [matches.length > 0 ? [...matches] : [...commands], line];
}

export function renderPaletteIntro(workspace: string, color = !process.env.NO_COLOR): string {
  const bold = (value: string): string => color ? `\u001b[1m${value}\u001b[0m` : value;
  const dim = (value: string): string => color ? `\u001b[2m${value}\u001b[0m` : value;
  return [
    `${bold("Glossa")}  ${dim(workspace)}`,
    dim("A small command surface. Tab completes; ? shows help."),
  ].join("\n");
}

export function paletteEventLine(event: ManagedSessionEvent): string | undefined {
  if (event.type === "status") {
    if (event.status.state === "connected") return event.status.reconnected ? "Reconnected." : "Connected. ChatGPT can use this workspace.";
    if (event.status.state === "retrying") return `Connection lost: ${event.status.error.message} Retrying…`;
    if (event.status.state === "disconnected") return "Disconnected.";
    return "Connecting…";
  }
  if (event.type === "notice") return event.message;
  if (event.type === "activity") {
    const id = event.requestId.slice(0, 8);
    if (event.jobType === "run_command") {
      const label = event.phase === "requested"
        ? "Command requested"
        : event.ok ? "Command started" : "Command rejected";
      return `${label} (${id}).`;
    }
    if (event.jobType === "write_file") {
      const label = event.phase === "requested"
        ? "File write started"
        : event.ok ? "File write completed" : "File write rejected";
      return `${label} (${id}).`;
    }
    const label = event.phase === "requested"
      ? "Command cancellation requested"
      : event.ok ? "Command cancellation completed" : "Command cancellation rejected";
    return `${label} (${id}).`;
  }
  return undefined;
}

export async function runCommandPalette(
  actions: PaletteUiActions,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<void> {
  const inputTty = "isTTY" in input ? Boolean(input.isTTY) : false;
  const outputTty = "isTTY" in output ? Boolean(output.isTTY) : false;
  if (!inputTty || !outputTty) {
    throw new Error("glossa ui requires an interactive terminal. Use glossa start instead.");
  }

  const rl = createInterface({
    input,
    output,
    terminal: true,
    completer: completePaletteCommand,
  });
  rl.setPrompt("glossa › ");
  output.write(`${renderPaletteIntro(actions.workspace)}\n\n`);

  let sessionController: AbortController | undefined;
  let sessionPromise: Promise<void> | undefined;
  let busy = false;
  let closed = false;

  const write = (message: string): void => {
    output.write(`${message}\n`);
  };

  const stopSession = async (): Promise<void> => {
    if (!sessionController || !sessionPromise) {
      write("No workspace session is running.");
      return;
    }
    const pending = sessionPromise;
    sessionController.abort();
    await pending;
  };

  const startSession = (): void => {
    if (sessionController) {
      write("The workspace session is already running.");
      return;
    }
    const controller = new AbortController();
    sessionController = controller;
    write("Files may be modified and commands run with the full environment and permissions of this account. Type stop to disconnect.");
    write(`Starting ${actions.workspace}…`);
    sessionPromise = actions.start(controller.signal, (event) => {
      const line = paletteEventLine(event);
      if (line) write(line);
    }).catch((error: unknown) => {
      write(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (sessionController === controller) {
        sessionController = undefined;
        sessionPromise = undefined;
      }
      if (!closed && !busy) rl.prompt();
    });
  };

  const handle = async (line: string): Promise<void> => {
    const command = parsePaletteCommand(line);
    if (!command) {
      write(line.trim() ? `Unknown command: ${line.trim()}. Type ? for help.` : "");
      return;
    }
    if (command === "start") startSession();
    else if (command === "stop") await stopSession();
    else if (command === "status") await actions.status();
    else if (command === "devices") await actions.devices();
    else if (command === "clear") output.write("\u001b[2J\u001b[H");
    else if (command === "help") {
      write("start    expose this workspace");
      write("stop     disconnect the running workspace");
      write("status   check account and relay status");
      write("devices  list enrolled computers");
      write("clear    clear the terminal");
      write("quit     stop and return to the shell");
    } else {
      closed = true;
      if (sessionController && sessionPromise) await stopSession();
      rl.close();
    }
  };

  await new Promise<void>((resolve) => {
    rl.on("line", (line) => {
      if (busy || closed) return;
      busy = true;
      rl.pause();
      void handle(line).catch((error: unknown) => {
        write(error instanceof Error ? error.message : String(error));
      }).finally(() => {
        busy = false;
        if (!closed) {
          rl.resume();
          rl.prompt();
        }
      });
    });
    rl.on("SIGINT", () => {
      if (sessionController) {
        write("Stopping workspace session…");
        sessionController.abort();
        rl.prompt();
      } else {
        closed = true;
        rl.close();
      }
    });
    rl.once("close", resolve);
    rl.prompt();
  });
}

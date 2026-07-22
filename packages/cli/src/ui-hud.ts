import { emitKeypressEvents, type Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import type { ManagedSessionEvent } from "./worker/managed-session.js";

export interface HudActivity {
  label: string;
  requestId: string;
  ok?: boolean;
}

export interface HudState {
  workspace: string;
  deviceName?: string;
  connection: "starting" | "connecting" | "connected" | "retrying" | "disconnected" | "error";
  message: string | undefined;
  activities: HudActivity[];
  showDetails: boolean;
  showHelp: boolean;
}

export interface HudUiActions {
  workspace: string;
  run(signal: AbortSignal, onEvent: (event: ManagedSessionEvent) => void): Promise<void>;
}

export function initialHudState(workspace: string): HudState {
  return {
    workspace,
    connection: "starting",
    message: undefined,
    activities: [],
    showDetails: false,
    showHelp: false,
  };
}

function activityLabel(event: Extract<ManagedSessionEvent, { type: "activity" }>): string {
  const noun = event.jobType === "write_file" ? "File write" : event.jobType === "run_command" ? "Command" : "Cancellation";
  if (event.phase === "requested") return `${noun} requested`;
  if (event.jobType === "run_command") return `Command ${event.ok ? "started" : "rejected"}`;
  return `${noun} ${event.ok ? "completed" : "rejected"}`;
}

export function applyHudEvent(state: HudState, event: ManagedSessionEvent): HudState {
  if (event.type === "session") {
    return { ...state, workspace: event.root, deviceName: event.deviceName };
  }
  if (event.type === "status") {
    if (event.status.state === "retrying") {
      return { ...state, connection: "retrying", message: event.status.error.message };
    }
    return { ...state, connection: event.status.state, message: undefined };
  }
  if (event.type === "notice") return { ...state, message: event.message };
  const activity: HudActivity = event.phase === "finished"
    ? { label: activityLabel(event), requestId: event.requestId, ok: event.ok }
    : { label: activityLabel(event), requestId: event.requestId };
  return { ...state, activities: [...state.activities.slice(-7), activity] };
}

function style(enabled: boolean, code: string, value: string): string {
  return enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
}

function renderBrand(color: boolean, showName: boolean): string[] {
  const purple = (value: string): string => style(color, "38;2;120;77;250;1", value);
  const coral = (value: string): string => style(color, "38;2;255;102;95;1", value);
  return [
    purple("  ▄█████████"),
    purple(" ███▀"),
    `${purple(" ██")}      ${coral("▄███")}${showName ? `   ${style(color, "1", "GLOSSA")}` : ""}`,
    coral(" ▀██▄       ██"),
    coral("   ▀██████████"),
  ];
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  if (width <= 1) return "…";
  return `${value.slice(0, width - 1)}…`;
}

function wrapText(value: string, width: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function connectionCopy(state: HudState): { glyph: string; label: string; detail: string } {
  if (state.connection === "connected") {
    return { glyph: "●", label: "Connected", detail: "ChatGPT can use this workspace." };
  }
  if (state.connection === "connecting" || state.connection === "starting") {
    return { glyph: "◌", label: "Connecting", detail: "Establishing the managed relay session…" };
  }
  if (state.connection === "retrying") {
    return { glyph: "◌", label: "Reconnecting", detail: state.message ?? "Retrying automatically…" };
  }
  if (state.connection === "error") {
    return { glyph: "×", label: "Error", detail: state.message ?? "The session stopped unexpectedly." };
  }
  return { glyph: "○", label: "Disconnected", detail: "The workspace is no longer exposed." };
}

export function renderHud(
  state: HudState,
  width = 80,
  color = !process.env.NO_COLOR,
): string {
  const copy = connectionCopy(state);
  const usable = Math.max(24, width - 4);
  const lines = [
    ...renderBrand(color, width >= 32),
    "",
    `${style(color, state.connection === "connected" ? "32;1" : "36;1", copy.glyph)} ${style(color, "1", copy.label)}`,
    `  ${truncate(copy.detail, usable)}`,
    "",
    `${style(color, "2", "Workspace")}  ${truncate(state.workspace, Math.max(8, usable - 11))}`,
    "",
    style(color, "1", "Authority"),
    ...wrapText(
      "Files may be modified and commands have the full environment and permissions of this account.",
      usable,
    ).map((line) => `  ${line}`),
  ];
  if (state.deviceName) lines.push(`${style(color, "2", "Device")}     ${truncate(state.deviceName, Math.max(8, usable - 11))}`);

  if (state.showHelp) {
    lines.push("", style(color, "1", "Keys"));
    lines.push("  d  toggle recent activity");
    lines.push("  ?  hide this help");
    lines.push("  q  disconnect and quit");
  } else if (state.showDetails) {
    lines.push("", style(color, "1", "Recent activity"));
    if (state.activities.length === 0) lines.push(style(color, "2", "  No tool activity yet."));
    for (const activity of state.activities.slice(-5)) {
      const outcome = activity.ok === false ? style(color, "31", "×") : style(color, "2", "·");
      lines.push(`${outcome} ${truncate(activity.label, Math.max(8, usable - 16))}  ${style(color, "2", activity.requestId.slice(0, 8))}`);
    }
  } else {
    const latest = state.activities.at(-1);
    lines.push("", latest ? `${style(color, "2", "Latest")}     ${truncate(latest.label, Math.max(8, usable - 11))}` : style(color, "2", "No tool activity yet."));
  }

  lines.push("", style(color, "2", "d details  ? help  q disconnect"));
  return lines.join("\n");
}

export async function runSessionHud(
  actions: HudUiActions,
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
): Promise<void> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("glossa ui requires an interactive terminal. Use glossa start instead.");
  }

  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  const controller = new AbortController();
  let state = initialHudState(actions.workspace);
  let stopUi: (() => void) | undefined;

  const render = (): void => {
    const view = renderHud(state, output.columns ?? 80);
    output.write(`\u001b[H\u001b[2J${view}`);
  };

  const session = actions.run(controller.signal, (event) => {
    state = applyHudEvent(state, event);
    render();
  }).then(() => {
    if (!controller.signal.aborted) state = { ...state, connection: "disconnected" };
    render();
  }).catch((error: unknown) => {
    state = {
      ...state,
      connection: "error",
      message: error instanceof Error ? error.message : String(error),
    };
    render();
    throw error;
  });

  input.setRawMode(true);
  input.resume();
  output.write("\u001b[?1049h\u001b[?25l");
  render();

  const stop = (): void => {
    controller.abort();
    stopUi?.();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await new Promise<void>((resolve) => {
      stopUi = resolve;
      const onKeypress = (value: string, key: Key): void => {
        if ((key.ctrl && key.name === "c") || key.name === "q") return stop();
        if (key.name === "d") {
          state = { ...state, showDetails: !state.showDetails, showHelp: false };
          render();
        } else if (value === "?" || key.sequence === "?") {
          state = { ...state, showHelp: !state.showHelp };
          render();
        }
      };
      input.on("keypress", onKeypress);
      session.finally(() => {
        if (state.connection === "disconnected" && controller.signal.aborted) resolve();
      }).catch(() => undefined);
      stopUi = () => {
        input.removeListener("keypress", onKeypress);
        resolve();
      };
    });
    await session;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    input.setRawMode(wasRaw);
    if (wasPaused) input.pause();
    output.write("\u001b[?25h\u001b[?1049l");
  }
}

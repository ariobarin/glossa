import { emitKeypressEvents, type Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import type { ManagedSessionEvent } from "./worker/managed-session.js";

export type MvuPhase = "idle" | "starting" | "connecting" | "connected" | "retrying" | "stopping" | "stopped" | "error";

export interface MvuActivity {
  label: string;
  requestId: string;
  failed: boolean;
}

export interface MvuModel {
  workspace: string;
  phase: MvuPhase;
  deviceName: string | undefined;
  message: string | undefined;
  activities: MvuActivity[];
  showHelp: boolean;
}

export type MvuMessage =
  | { type: "key"; name: string; ctrl?: boolean }
  | { type: "session"; event: ManagedSessionEvent }
  | { type: "session-error"; error: string }
  | { type: "session-done" };

export type MvuEffect = "start" | "stop" | "quit";

export interface MvuUpdate {
  model: MvuModel;
  effects: MvuEffect[];
}

export interface MvuUiActions {
  workspace: string;
  run(signal: AbortSignal, onEvent: (event: ManagedSessionEvent) => void): Promise<void>;
}

export function initialMvuModel(workspace: string): MvuModel {
  return {
    workspace,
    phase: "idle",
    deviceName: undefined,
    message: undefined,
    activities: [],
    showHelp: false,
  };
}

function isRunning(phase: MvuPhase): boolean {
  return phase === "starting" || phase === "connecting" || phase === "connected" || phase === "retrying" || phase === "stopping";
}

function reduceSessionEvent(model: MvuModel, event: ManagedSessionEvent): MvuModel {
  if (event.type === "session") {
    return { ...model, workspace: event.root, deviceName: event.deviceName };
  }
  if (event.type === "status") {
    if (event.status.state === "retrying") {
      return { ...model, phase: "retrying", message: event.status.error.message };
    }
    if (event.status.state === "disconnected") {
      return { ...model, phase: "stopped", message: undefined };
    }
    return { ...model, phase: event.status.state, message: undefined };
  }
  if (event.type === "notice") return { ...model, message: event.message };
  const noun = event.jobType === "write_file" ? "File write" : event.jobType === "run_command" ? "Command" : "Cancellation";
  const activity: MvuActivity = {
    label: event.phase === "requested"
      ? `${noun} requested`
      : event.jobType === "run_command"
        ? `Command ${event.ok ? "started" : "rejected"}`
        : `${noun} ${event.ok ? "completed" : "rejected"}`,
    requestId: event.requestId,
    failed: event.phase === "finished" && !event.ok,
  };
  return { ...model, activities: [...model.activities.slice(-9), activity] };
}

export function updateMvu(model: MvuModel, message: MvuMessage): MvuUpdate {
  if (message.type === "session") return { model: reduceSessionEvent(model, message.event), effects: [] };
  if (message.type === "session-error") {
    return { model: { ...model, phase: "error", message: message.error }, effects: [] };
  }
  if (message.type === "session-done") {
    return { model: { ...model, phase: model.phase === "stopping" ? "stopped" : model.phase === "error" ? "error" : "stopped" }, effects: [] };
  }

  if ((message.ctrl && message.name === "c") || message.name === "q") {
    return {
      model: isRunning(model.phase) ? { ...model, phase: "stopping" } : model,
      effects: isRunning(model.phase) ? ["stop", "quit"] : ["quit"],
    };
  }
  if (message.name === "?") return { model: { ...model, showHelp: !model.showHelp }, effects: [] };
  if (message.name === "c") return { model: { ...model, activities: [] }, effects: [] };
  if (message.name === "return" || message.name === "enter" || message.name === "space") {
    if (isRunning(model.phase)) {
      return { model: { ...model, phase: "stopping" }, effects: ["stop"] };
    }
    return {
      model: { ...model, phase: "starting", message: undefined },
      effects: ["start"],
    };
  }
  return { model, effects: [] };
}

function style(enabled: boolean, code: string, value: string): string {
  return enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
}

function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  return width <= 1 ? "…" : `${value.slice(0, width - 1)}…`;
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

function phaseCopy(phase: MvuPhase): { glyph: string; label: string; detail: string } {
  if (phase === "idle") return { glyph: "○", label: "Ready", detail: "Press Enter to expose this workspace." };
  if (phase === "starting" || phase === "connecting") return { glyph: "◌", label: "Connecting", detail: "Establishing the managed relay session…" };
  if (phase === "connected") return { glyph: "●", label: "Connected", detail: "ChatGPT can use this workspace." };
  if (phase === "retrying") return { glyph: "◌", label: "Reconnecting", detail: "The relay will retry automatically." };
  if (phase === "stopping") return { glyph: "◌", label: "Disconnecting", detail: "Closing the workspace session…" };
  if (phase === "error") return { glyph: "×", label: "Error", detail: "The session could not continue." };
  return { glyph: "○", label: "Stopped", detail: "Press Enter to expose the workspace again." };
}

export function renderMvu(
  model: MvuModel,
  width = 80,
  height = 24,
  color = !process.env.NO_COLOR,
): string {
  const usable = Math.max(26, width - 4);
  const copy = phaseCopy(model.phase);
  const activeCode = model.phase === "connected" ? "32;1" : model.phase === "error" ? "31;1" : "36;1";
  const lines = [
    style(color, "1", "Glossa"),
    style(color, "2", truncate(model.workspace, usable)),
    "",
    `${style(color, activeCode, copy.glyph)} ${style(color, "1", copy.label)}`,
    `  ${truncate(model.message ?? copy.detail, usable)}`,
    "",
    style(color, "1", "Authority"),
    ...wrapText(
      "Files may be modified and commands have the full environment and permissions of this account.",
      usable,
    ).map((line) => `  ${line}`),
  ];
  if (model.deviceName) lines.push("", `${style(color, "2", "Device")}  ${truncate(model.deviceName, Math.max(8, usable - 8))}`);

  if (model.showHelp) {
    lines.push("", style(color, "1", "Help"));
    lines.push("  Enter  connect or disconnect");
    lines.push("  c      clear recent activity");
    lines.push("  ?      close help");
    lines.push("  q      disconnect and quit");
  } else if (height >= 16) {
    lines.push("", style(color, "1", "Activity"));
    if (model.activities.length === 0) lines.push(style(color, "2", "  Nothing yet."));
    const available = Math.max(1, Math.min(5, height - lines.length - 4));
    for (const activity of model.activities.slice(-available)) {
      const glyph = activity.failed ? style(color, "31", "×") : style(color, "2", "·");
      lines.push(`${glyph} ${truncate(activity.label, Math.max(8, usable - 13))}  ${style(color, "2", activity.requestId.slice(0, 8))}`);
    }
  }

  const primary = isRunning(model.phase) ? "enter disconnect" : "enter connect";
  lines.push("", style(color, "2", `${primary}  c clear  ? help  q quit`));
  return lines.join("\n");
}

export async function runMvuUi(
  actions: MvuUiActions,
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
): Promise<void> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("glossa ui requires an interactive terminal. Use glossa start instead.");
  }

  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  let model = initialMvuModel(actions.workspace);
  let controller: AbortController | undefined;
  let session: Promise<void> | undefined;
  let quitting = false;
  let terminalError: unknown;
  let finish: (() => void) | undefined;

  const render = (): void => {
    output.write(`\u001b[H\u001b[2J${renderMvu(model, output.columns ?? 80, output.rows ?? 24)}`);
  };

  const completeIfQuitting = (): void => {
    if (quitting && !session) finish?.();
  };

  const startSession = (): void => {
    if (session) return;
    const nextController = new AbortController();
    controller = nextController;
    terminalError = undefined;
    session = actions.run(nextController.signal, (event) => dispatch({ type: "session", event }))
      .then(() => dispatch({ type: "session-done" }))
      .catch((error: unknown) => {
        terminalError = error;
        dispatch({ type: "session-error", error: error instanceof Error ? error.message : String(error) });
      })
      .finally(() => {
        if (controller === nextController) controller = undefined;
        session = undefined;
        completeIfQuitting();
      });
  };

  const runEffect = (effect: MvuEffect): void => {
    if (effect === "start") startSession();
    else if (effect === "stop") controller?.abort();
    else {
      quitting = true;
      controller?.abort();
      completeIfQuitting();
    }
  };

  function dispatch(message: MvuMessage): void {
    const update = updateMvu(model, message);
    model = update.model;
    render();
    for (const effect of update.effects) runEffect(effect);
  }

  input.setRawMode(true);
  input.resume();
  output.write("\u001b[?1049h\u001b[?25l");
  render();

  const onKeypress = (value: string, key: Key): void => {
    dispatch({ type: "key", name: key.name ?? value, ...(key.ctrl ? { ctrl: true } : {}) });
  };
  const stop = (): void => dispatch({ type: "key", name: "c", ctrl: true });
  input.on("keypress", onKeypress);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    if (session) await session;
    if (terminalError) throw terminalError;
  } finally {
    input.removeListener("keypress", onKeypress);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    input.setRawMode(wasRaw);
    if (wasPaused) input.pause();
    output.write("\u001b[?25h\u001b[?1049l");
  }
}

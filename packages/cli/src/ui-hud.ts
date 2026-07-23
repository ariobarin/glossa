import { emitKeypressEvents, type Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";
import type { ManagedSessionEvent } from "./worker/managed-session.js";

export interface HudActivity {
  label: string;
  requestId: string;
  ok?: boolean;
}

export interface HudDevice {
  id: string;
  label: string;
}

export interface HudStatus {
  account: string;
  relay: string;
  activeWorkers: number | null;
  devices: HudDevice[];
}

type HudView = "session" | "activity" | "status" | "help";
type HudPrompt =
  | { type: "logout" }
  | { type: "update" }
  | { type: "revoke-select" }
  | { type: "revoke-confirm"; deviceIndex: number };

export type HudExitAction = "quit" | "logout" | "update";

export interface HudState {
  workspace: string;
  deviceName?: string;
  connection: "starting" | "connecting" | "connected" | "retrying" | "disconnected" | "error";
  message: string | undefined;
  activities: HudActivity[];
  view: HudView;
  status: HudStatus | undefined;
  statusLoading: boolean;
  prompt: HudPrompt | undefined;
  busy: boolean;
  notice: string | undefined;
}

export interface HudUiActions {
  workspace: string;
  run(signal: AbortSignal, onEvent: (event: ManagedSessionEvent) => void): Promise<void>;
  loadStatus(signal: AbortSignal): Promise<HudStatus>;
  revokeDevice(deviceId: string): Promise<void>;
}

export function initialHudState(workspace: string): HudState {
  return {
    workspace,
    connection: "starting",
    message: undefined,
    activities: [],
    view: "session",
    status: undefined,
    statusLoading: false,
    prompt: undefined,
    busy: false,
    notice: undefined,
  };
}

function activityLabel(event: Extract<ManagedSessionEvent, { type: "activity" }>): string {
  const noun =
    event.jobType === "write_file"
      ? "File write"
      : event.jobType === "edit_file"
        ? "File edit"
        : event.jobType === "run_command"
          ? "Command"
          : "Cancellation";
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

function renderTitle(width: number, color: boolean): string {
  const title = "Glossa";
  const padding = " ".repeat(Math.max(0, Math.floor((width - title.length) / 2)));
  return `${padding}${style(color, "38;2;120;77;250;1", title)}`;
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
    return {
      glyph: "●",
      label: "Connected",
      detail: state.message ?? "ChatGPT can use this workspace.",
    };
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

function renderSession(state: HudState, usable: number, color: boolean): string[] {
  const copy = connectionCopy(state);
  const lines = [
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
  if (state.deviceName) {
    lines.push(`${style(color, "2", "Device")}     ${truncate(state.deviceName, Math.max(8, usable - 11))}`);
  }
  const latest = state.activities.at(-1);
  lines.push(
    "",
    latest
      ? `${style(color, "2", "Latest")}     ${truncate(latest.label, Math.max(8, usable - 11))}`
      : style(color, "2", "No tool activity yet."),
  );
  return lines;
}

function renderActivity(state: HudState, usable: number, color: boolean): string[] {
  const lines = [style(color, "1", "Recent activity")];
  if (state.activities.length === 0) {
    lines.push("", style(color, "2", "No tool activity yet."));
  }
  for (const activity of state.activities.slice(-8)) {
    const outcome = activity.ok === false ? style(color, "31", "×") : style(color, "2", "·");
    lines.push(
      `${outcome} ${truncate(activity.label, Math.max(8, usable - 16))}  ${style(color, "2", activity.requestId.slice(0, 8))}`,
    );
  }
  return lines;
}

function renderStatus(state: HudState, usable: number, color: boolean): string[] {
  const lines = [style(color, "1", "Status"), ""];
  if (state.statusLoading) {
    lines.push("Loading account and devices…");
    return lines;
  }
  if (!state.status) {
    lines.push(style(color, "2", "Status is not loaded."));
    return lines;
  }
  lines.push(
    `${style(color, "2", "Account")}    ${truncate(state.status.account, Math.max(8, usable - 11))}`,
    `${style(color, "2", "Relay")}      ${truncate(state.status.relay, Math.max(8, usable - 11))}`,
    `${style(color, "2", "Workers")}    ${state.status.activeWorkers ?? "unavailable"}`,
    "",
    style(color, "1", "Devices"),
  );
  if (state.status.devices.length === 0) {
    lines.push(style(color, "2", "  No devices enrolled."));
  }
  state.status.devices.slice(0, 9).forEach((device, index) => {
    lines.push(`  ${index + 1}. ${truncate(device.label, Math.max(8, usable - 5))}`);
  });
  return lines;
}

function renderHelp(color: boolean): string[] {
  return [
    style(color, "1", "Keys"),
    "",
    "  d  recent activity",
    "  s  account and devices",
    "  r  revoke a device",
    "  l  sign out",
    "  u  update Glossa",
    "  ?  close help",
    "  q  disconnect and quit",
  ];
}

function promptText(state: HudState): string | undefined {
  if (state.busy) return "Working…";
  if (!state.prompt) return undefined;
  if (state.prompt.type === "logout") return "Sign out and disconnect?  y yes  n cancel";
  if (state.prompt.type === "update") return "Disconnect and update Glossa?  y yes  n cancel";
  if (state.prompt.type === "revoke-select") return "Press a device number to revoke, or Esc to cancel.";
  const device = state.status?.devices[state.prompt.deviceIndex];
  return `Revoke ${device?.label ?? "this device"}?  y yes  n cancel`;
}

function footer(state: HudState): string {
  if (state.view === "status") return "r revoke  l sign out  u update  Esc back  q disconnect";
  if (state.view === "activity") return "d back  s status  ? help  q disconnect";
  if (state.view === "help") return "? back  q disconnect";
  return "d activity  s status  ? help  q disconnect";
}

export function renderHud(
  state: HudState,
  width = 80,
  color = !process.env.NO_COLOR,
): string {
  const usable = Math.max(24, width - 4);
  const lines = [renderTitle(width, color), ""];
  if (state.view === "activity") lines.push(...renderActivity(state, usable, color));
  else if (state.view === "status") lines.push(...renderStatus(state, usable, color));
  else if (state.view === "help") lines.push(...renderHelp(color));
  else lines.push(...renderSession(state, usable, color));

  if (state.notice) lines.push("", style(color, "33", truncate(state.notice, usable)));
  const prompt = promptText(state);
  if (prompt) lines.push("", style(color, "1", truncate(prompt, usable)));
  lines.push("", style(color, "2", footer(state)));
  return lines.join("\n");
}

export async function runSessionHud(
  actions: HudUiActions,
  input: ReadStream = process.stdin,
  output: WriteStream = process.stdout,
): Promise<HudExitAction> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("Glossa requires an interactive terminal.");
  }

  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const controller = new AbortController();
  let state = initialHudState(actions.workspace);
  let exitAction: HudExitAction = "quit";
  let stopUi: (() => void) | undefined;

  const render = (): void => {
    const view = renderHud(state, output.columns ?? 80);
    output.write(`\u001b[H\u001b[2J${view}`);
  };

  const loadStatus = async (): Promise<void> => {
    if (state.connection !== "connected" && state.connection !== "retrying") {
      state = { ...state, notice: "Status is available after Glossa connects." };
      render();
      return;
    }
    state = {
      ...state,
      view: "status",
      statusLoading: true,
      prompt: undefined,
      notice: undefined,
    };
    render();
    try {
      const status = await actions.loadStatus(controller.signal);
      if (controller.signal.aborted) return;
      state = { ...state, status, statusLoading: false };
    } catch (error) {
      if (controller.signal.aborted) return;
      state = {
        ...state,
        statusLoading: false,
        notice: error instanceof Error ? error.message : String(error),
      };
    }
    render();
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

  const stop = (action: HudExitAction = "quit"): void => {
    exitAction = action;
    controller.abort();
    stopUi?.();
  };
  const stopFromSignal = (): void => stop();
  process.once("SIGINT", stopFromSignal);
  process.once("SIGTERM", stopFromSignal);

  try {
    await new Promise<void>((resolve) => {
      stopUi = resolve;
      const onKeypress = (value: string, key: Key): void => {
        if ((key.ctrl && key.name === "c") || key.name === "q") return stop();
        if (state.busy) return;

        if (state.prompt) {
          if (key.name === "escape" || key.name === "n") {
            state = { ...state, prompt: undefined, notice: undefined };
            render();
            return;
          }
          if (state.prompt.type === "revoke-select") {
            const deviceIndex = Number(value) - 1;
            if (
              Number.isInteger(deviceIndex) &&
              deviceIndex >= 0 &&
              deviceIndex < (state.status?.devices.length ?? 0)
            ) {
              state = { ...state, prompt: { type: "revoke-confirm", deviceIndex } };
              render();
            }
            return;
          }
          if (key.name !== "y") return;
          if (state.prompt.type === "logout") return stop("logout");
          if (state.prompt.type === "update") return stop("update");
          const device = state.status?.devices[state.prompt.deviceIndex];
          if (!device) return;
          state = { ...state, busy: true, prompt: undefined, notice: undefined };
          render();
          void actions.revokeDevice(device.id).then(async () => {
            if (controller.signal.aborted) return;
            state = { ...state, busy: false, notice: `Revoked ${device.label}.` };
            render();
            await loadStatus();
          }).catch((error: unknown) => {
            if (controller.signal.aborted) return;
            state = {
              ...state,
              busy: false,
              notice: error instanceof Error ? error.message : String(error),
            };
            render();
          });
          return;
        }

        if (key.name === "escape") {
          state = { ...state, view: "session", notice: undefined };
          render();
        } else if (key.name === "d") {
          state = {
            ...state,
            view: state.view === "activity" ? "session" : "activity",
            notice: undefined,
          };
          render();
        } else if (key.name === "s") {
          void loadStatus();
        } else if (key.name === "r" && state.view === "status") {
          if ((state.status?.devices.length ?? 0) === 0) {
            state = { ...state, notice: "There are no devices to revoke." };
          } else {
            state = { ...state, prompt: { type: "revoke-select" }, notice: undefined };
          }
          render();
        } else if (key.name === "l") {
          state = { ...state, prompt: { type: "logout" }, notice: undefined };
          render();
        } else if (key.name === "u") {
          state = { ...state, prompt: { type: "update" }, notice: undefined };
          render();
        } else if (value === "?" || key.sequence === "?") {
          state = {
            ...state,
            view: state.view === "help" ? "session" : "help",
            notice: undefined,
          };
          render();
        }
      };
      input.on("keypress", onKeypress);
      void session.catch(() => stopUi?.());
      stopUi = () => {
        input.removeListener("keypress", onKeypress);
        resolve();
      };
    });
    await session;
    return exitAction;
  } finally {
    process.removeListener("SIGINT", stopFromSignal);
    process.removeListener("SIGTERM", stopFromSignal);
    input.setRawMode(wasRaw);
    input.pause();
    output.write("\u001b[?25h\u001b[?1049l");
  }
}

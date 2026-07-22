import { emitKeypressEvents, type Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";

export type GuidedAction = "start" | "status" | "devices" | "quit";

export interface GuidedUiActions {
  workspace: string;
  start(): Promise<void>;
  status(): Promise<void>;
  devices(): Promise<void>;
}

interface MenuItem {
  action: GuidedAction;
  label: string;
  detail: string;
}

const menuItems: readonly MenuItem[] = [
  { action: "start", label: "Expose workspace", detail: "Connect this directory to ChatGPT" },
  { action: "status", label: "Status", detail: "Check the relay and active workers" },
  { action: "devices", label: "Devices", detail: "See enrolled computers" },
  { action: "quit", label: "Quit", detail: "Return to the shell" },
];

function style(enabled: boolean, code: string, value: string): string {
  return enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export function moveGuidedSelection(
  current: number,
  direction: -1 | 1,
  count = menuItems.length,
): number {
  return (current + direction + count) % count;
}

export function renderGuidedMenu(
  workspace: string,
  selected: number,
  color = !process.env.NO_COLOR,
): string {
  const lines = [
    `${style(color, "1", "Glossa")}  ${style(color, "2", workspace)}`,
    "",
  ];
  for (const [index, item] of menuItems.entries()) {
    const active = index === selected;
    const marker = active ? style(color, "36;1", "›") : " ";
    const label = active ? style(color, "1", item.label) : item.label;
    lines.push(`${marker} ${label}`);
    lines.push(`  ${style(color, "2", item.detail)}`);
  }
  lines.push("");
  lines.push(style(color, "2", "↑↓ move  enter select  q quit"));
  return lines.join("\n");
}

async function selectGuidedAction(
  workspace: string,
  input: ReadStream,
  output: WriteStream,
): Promise<GuidedAction> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("glossa ui requires an interactive terminal. Use glossa start instead.");
  }

  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  let selected = 0;
  let renderedLines = 0;
  input.setRawMode(true);
  input.resume();
  output.write("\u001b[?25l");

  const render = (): void => {
    if (renderedLines > 0) output.write(`\u001b[${renderedLines}A\r\u001b[0J`);
    const view = renderGuidedMenu(workspace, selected);
    output.write(`${view}\n`);
    renderedLines = view.split("\n").length + 1;
  };

  try {
    render();
    return await new Promise<GuidedAction>((resolve) => {
      const finish = (action: GuidedAction): void => {
        input.removeListener("keypress", onKeypress);
        resolve(action);
      };
      const onKeypress = (value: string, key: Key): void => {
        if (key.ctrl && key.name === "c") return finish("quit");
        if (key.name === "q") return finish("quit");
        if (key.name === "up" || key.name === "k") {
          selected = moveGuidedSelection(selected, -1);
          render();
        } else if (key.name === "down" || key.name === "j") {
          selected = moveGuidedSelection(selected, 1);
          render();
        } else if (key.name === "return" || key.name === "enter" || value === " ") {
          finish(menuItems[selected]!.action);
        }
      };
      input.on("keypress", onKeypress);
    });
  } finally {
    input.setRawMode(wasRaw);
    if (wasPaused) input.pause();
    output.write("\u001b[?25h");
  }
}

export async function runGuidedUi(
  actions: GuidedUiActions,
  input = process.stdin,
  output = process.stdout,
): Promise<void> {
  for (;;) {
    const action = await selectGuidedAction(actions.workspace, input, output);
    output.write("\n");
    if (action === "quit") return;
    try {
      if (action === "start") await actions.start();
      else if (action === "status") await actions.status();
      else await actions.devices();
    } catch (error) {
      output.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
    output.write("\n");
  }
}

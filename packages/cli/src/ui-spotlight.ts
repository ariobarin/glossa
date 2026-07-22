import { emitKeypressEvents, type Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";

export type SpotlightAction = "start" | "status" | "devices" | "login" | "quit";

export interface SpotlightUiActions {
  workspace: string;
  start(): Promise<void>;
  status(): Promise<void>;
  devices(): Promise<void>;
  login(): Promise<void>;
}

export interface SpotlightItem {
  action: SpotlightAction;
  label: string;
  detail: string;
  keywords: readonly string[];
}

export const spotlightItems: readonly SpotlightItem[] = [
  {
    action: "start",
    label: "Expose this workspace",
    detail: "Connect it to ChatGPT until you disconnect",
    keywords: ["start", "connect", "worker", "workspace"],
  },
  {
    action: "status",
    label: "Check status",
    detail: "Account, relay, devices, and active workers",
    keywords: ["status", "health", "relay", "account"],
  },
  {
    action: "devices",
    label: "List devices",
    detail: "See computers enrolled with this account",
    keywords: ["devices", "computers", "workers"],
  },
  {
    action: "login",
    label: "Sign in",
    detail: "Refresh or establish the Google session",
    keywords: ["login", "account", "google", "auth"],
  },
  {
    action: "quit",
    label: "Quit",
    detail: "Return to the shell",
    keywords: ["quit", "exit", "close"],
  },
];

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function subsequence(haystack: string, needle: string): boolean {
  let cursor = 0;
  for (const character of haystack) {
    if (character === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return needle.length === 0;
}

export function scoreSpotlightItem(item: SpotlightItem, query: string): number {
  const needle = normalize(query);
  if (!needle) return 1;
  const label = normalize(item.label);
  if (label === needle) return 120;
  if (label.startsWith(needle)) return 100;
  if (label.includes(needle)) return 80;
  if (item.keywords.some((keyword) => normalize(keyword).startsWith(needle))) return 60;
  if (item.keywords.some((keyword) => normalize(keyword).includes(needle))) return 40;
  if (subsequence(label, needle)) return 20;
  return 0;
}

export function filterSpotlightItems(query: string): SpotlightItem[] {
  return spotlightItems
    .map((item, index) => ({ item, index, score: scoreSpotlightItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

function style(enabled: boolean, code: string, value: string): string {
  return enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export function renderSpotlight(
  workspace: string,
  query: string,
  selected: number,
  color = !process.env.NO_COLOR,
): string {
  const matches = filterSpotlightItems(query);
  const lines = [
    `${style(color, "1", "Glossa")}  ${style(color, "2", workspace)}`,
    "",
    `${style(color, "36;1", "›")} ${query}${style(color, "2", "▌")}`,
    "",
  ];
  if (matches.length === 0) {
    lines.push(style(color, "2", "  No matching action"));
  } else {
    for (const [index, item] of matches.entries()) {
      const active = index === selected;
      lines.push(`${active ? style(color, "36;1", "›") : " "} ${active ? style(color, "1", item.label) : item.label}`);
      lines.push(`  ${style(color, "2", item.detail)}`);
    }
  }
  lines.push("");
  lines.push(style(color, "2", "type to filter  ↑↓ move  enter run  esc clear/quit"));
  return lines.join("\n");
}

async function chooseSpotlightAction(
  workspace: string,
  input: ReadStream,
  output: WriteStream,
): Promise<SpotlightAction> {
  if (!input.isTTY || !output.isTTY) {
    throw new Error("glossa ui requires an interactive terminal. Use glossa start instead.");
  }
  emitKeypressEvents(input);
  const wasRaw = input.isRaw;
  const wasPaused = input.isPaused();
  let query = "";
  let selected = 0;
  let renderedLines = 0;
  input.setRawMode(true);
  input.resume();
  output.write("\u001b[?25l");

  const render = (): void => {
    const matches = filterSpotlightItems(query);
    selected = Math.min(selected, Math.max(0, matches.length - 1));
    if (renderedLines > 0) output.write(`\u001b[${renderedLines}A\r\u001b[0J`);
    const view = renderSpotlight(workspace, query, selected);
    output.write(`${view}\n`);
    renderedLines = view.split("\n").length;
  };

  try {
    render();
    return await new Promise<SpotlightAction>((resolve) => {
      const finish = (action: SpotlightAction): void => {
        input.removeListener("keypress", onKeypress);
        resolve(action);
      };
      const onKeypress = (value: string, key: Key): void => {
        const matches = filterSpotlightItems(query);
        if (key.ctrl && key.name === "c") return finish("quit");
        if (key.name === "escape") {
          if (query) {
            query = "";
            selected = 0;
            render();
          } else {
            finish("quit");
          }
        } else if (key.name === "backspace") {
          query = query.slice(0, -1);
          selected = 0;
          render();
        } else if (key.name === "up") {
          if (matches.length > 0) selected = (selected - 1 + matches.length) % matches.length;
          render();
        } else if (key.name === "down") {
          if (matches.length > 0) selected = (selected + 1) % matches.length;
          render();
        } else if (key.name === "return" || key.name === "enter") {
          const item = matches[selected];
          if (item) finish(item.action);
        } else if (!key.ctrl && !key.meta && value && value >= " ") {
          query += value;
          selected = 0;
          render();
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

export async function runSpotlightUi(
  actions: SpotlightUiActions,
  input = process.stdin,
  output = process.stdout,
): Promise<void> {
  for (;;) {
    const action = await chooseSpotlightAction(actions.workspace, input, output);
    output.write("\n");
    if (action === "quit") return;
    try {
      if (action === "start") await actions.start();
      else if (action === "status") await actions.status();
      else if (action === "devices") await actions.devices();
      else await actions.login();
    } catch (error) {
      output.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
    output.write("\n");
  }
}

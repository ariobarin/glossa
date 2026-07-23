import { spawnSync } from "node:child_process";

const NPM_PACKAGE = "@ariobarin/glossa@beta";

export interface UpdateInvocation {
  command: string;
  args: string[];
}

export interface UpdateDependencies {
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  run?: (
    command: string,
    args: string[],
    options: { stdio: "inherit" },
  ) => { status: number | null; error?: Error };
  log?: (message: string) => void;
}

export function npmUpdateInvocation(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): UpdateInvocation {
  if (platform === "win32") {
    return {
      command: environment.ComSpec ?? environment.COMSPEC ?? "cmd.exe",
      args: ["/d", "/s", "/c", `npm install --global ${NPM_PACKAGE}`],
    };
  }
  return {
    command: "npm",
    args: ["install", "--global", NPM_PACKAGE],
  };
}

export function updateGlossa(dependencies: UpdateDependencies = {}): void {
  const run = dependencies.run ?? spawnSync;
  const log = dependencies.log ?? console.log;
  const invocation = npmUpdateInvocation(
    dependencies.platform,
    dependencies.environment,
  );

  log("Updating Glossa from the npm beta channel...");
  const result = run(invocation.command, invocation.args, { stdio: "inherit" });
  if (result.error) {
    throw new Error(`Glossa could not start npm: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `npm could not update Glossa (exit ${result.status ?? "unknown"}).`,
    );
  }
  log("Glossa updated.");
  log("Next: run glossa to reopen this workspace.");
  log("Inside Glossa, press ? for controls.");
}

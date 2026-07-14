import { z } from "zod";
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_WORKER_POLL_MS,
  MAX_COMMAND_TIMEOUT_MS,
  MAX_WORKER_POLL_MS,
} from "@glossa/protocol";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(39100),
  DATABASE_URL: z.string().min(1),
  GLOSSA_PUBLIC_ORIGIN: z.string().url(),
  GLOSSA_AUTH0_ISSUER: z.string().url(),
  GLOSSA_AUTH0_AUDIENCE: z.string().url(),
  GLOSSA_MCP_REQUIRED_SCOPE: z.string().default("glossa:access"),
  GLOSSA_DEVICE_ENROLL_SCOPE: z.string().default("glossa:device"),
  GLOSSA_WORKER_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_WORKER_POLL_MS)
    .default(DEFAULT_WORKER_POLL_MS),
  GLOSSA_COMMAND_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_COMMAND_TIMEOUT_MS)
    .default(DEFAULT_COMMAND_TIMEOUT_MS),
});

export type RelayConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): RelayConfig {
  return environmentSchema.parse(environment);
}

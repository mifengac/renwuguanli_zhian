const { spawnSync } = require("node:child_process");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://placeholder/placeholder";
}

const command =
  process.platform === "win32"
    ? { file: "cmd.exe", args: ["/c", "npx", "prisma", "generate"] }
    : { file: "npx", args: ["prisma", "generate"] };

const result = spawnSync(command.file, command.args, {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  // eslint-disable-next-line no-console
  console.error(result.error);
}

process.exit(result.status ?? 1);

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("Windows link helper passes its bidirectional movement self-test", (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows-only native window bridge");
    return;
  }

  const powershell = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const script = path.resolve(__dirname, "..", "scripts", "window-link.ps1");
  const result = spawnSync(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-SelfTest"],
    { encoding: "utf8", windowsHide: true },
  );

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.ok, true);
  assert.deepEqual(
    report.actions.map(({ target, x, y }) => ({ target, x, y })),
    [
      { target: "plugin", x: 150, y: 150 },
      { target: "host", x: 140, y: 130 },
      { target: "none", x: null, y: null },
    ],
  );
});

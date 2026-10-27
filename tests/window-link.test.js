const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const readline = require("node:readline");

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
  assert.deepEqual(report.dockActions, [
    { target: "plugin", x: 140, y: 184 },
    { target: "host", x: 140, y: 240 },
  ]);
  assert.deepEqual(report.layouts, [
    { hostX: 100, hostY: 200, hostWidth: 1200, hostHeight: 700, x: 100, y: 144, width: 1200 },
    { hostX: -1920, hostY: 85, hostWidth: 1920, hostHeight: 955, x: -1920, y: 0, width: 1920 },
    { hostX: 0, hostY: 56, hostWidth: 1280, hostHeight: 984, x: 0, y: 0, width: 1280 },
    { hostX: 100, hostY: -900, hostWidth: 1040, hostHeight: 700, x: 100, y: -956, width: 1040 },
  ]);
  assert.deepEqual(report.lifecycle, ["hide", "hide", "show", "close", "none"]);
});

test("native dock follows repeated host width changes without a move", { timeout: 15000 }, async (context) => {
  if (process.platform !== "win32") {
    context.skip("Windows-only native window bridge");
    return;
  }

  // Owned test windows stay offscreen and never activate; Eagle is not touched.
  const fixtureSource = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
public class QuickRailOffscreenForm : Form {
    protected override bool ShowWithoutActivation { get { return true; } }
}
public static class QuickRailWidthFixture {
    static Form host, rail;
    static Thread thread;
    static Exception error;
    static readonly ManualResetEvent ready = new ManualResetEvent(false);
    public static void Start() {
        thread = new Thread(() => {
            try {
                host = new QuickRailOffscreenForm { FormBorderStyle = FormBorderStyle.None,
                    StartPosition = FormStartPosition.Manual, ShowInTaskbar = false,
                    Bounds = new Rectangle(-20000, 200, 1200, 500) };
                rail = new QuickRailOffscreenForm { FormBorderStyle = FormBorderStyle.None,
                    StartPosition = FormStartPosition.Manual, ShowInTaskbar = false,
                    Bounds = new Rectangle(-20000, 144, 760, 58) };
                host.Show();
                rail.Show(host);
                ready.Set();
                Application.Run();
            } catch (Exception ex) { error = ex; ready.Set(); }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.IsBackground = true;
        thread.Start();
        if (!ready.WaitOne(5000)) throw new Exception("Test windows did not start");
        if (error != null) throw error;
    }
    public static long RailHandle { get { return rail.Handle.ToInt64(); } }
    public static int[] Snapshot(int width) {
        return (int[])host.Invoke(new Func<int[]>(() => {
            if (width > 0) host.Width = width;
            return new int[] { host.Width, rail.Width, host.Left, rail.Left, host.Top, rail.Top, rail.Height };
        }));
    }
    public static void Stop() {
        host.Invoke(new Action(() => { rail.Dispose(); host.Dispose(); Application.ExitThread(); }));
        thread.Join(1000);
    }
}
'@
[QuickRailWidthFixture]::Start()
try {
    [pscustomobject]@{ handle = [QuickRailWidthFixture]::RailHandle.ToString() } | ConvertTo-Json -Compress
    while ($null -ne ($line = [Console]::ReadLine())) {
        $command = $line | ConvertFrom-Json
        $snapshot = [QuickRailWidthFixture]::Snapshot([int]$command.width)
        ConvertTo-Json -InputObject $snapshot -Compress
    }
} finally { [QuickRailWidthFixture]::Stop() }
`;
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const fixture = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(fixtureSource, "utf16le").toString("base64")], { windowsHide: true });
  const messages = [];
  let errors = "";
  fixture.stderr.on("data", (chunk) => { errors += chunk; });
  readline.createInterface({ input: fixture.stdout }).on("line", (line) => messages.push(JSON.parse(line)));
  let helper;
  context.after(() => {
    if (helper) helper.kill();
    fixture.stdin.end();
    fixture.kill();
  });
  async function waitFor(check, label) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const value = check();
      if (value) return value;
      assert.equal(fixture.exitCode, null, errors || "Test window process exited");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`${label}: ${errors}`);
  }

  const { handle } = await waitFor(() => messages.shift(), "test windows ready");
  const script = path.resolve(__dirname, "..", "scripts", "window-link.ps1");
  helper = spawn(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script, "-PluginHandle", handle], { windowsHide: true });
  const reports = [];
  helper.stderr.on("data", (chunk) => { errors += chunk; });
  readline.createInterface({ input: helper.stdout }).on("line", (line) => reports.push(JSON.parse(line)));
  assert.equal((await waitFor(() => reports.shift(), "dock helper ready")).ok, true);
  // Exercise the live settings pipe as the renderer does after startup and resize.
  helper.stdin.write(`${JSON.stringify({ railHeight: 58 })}\n`);
  for (const width of [1200, 1000, 1450, 850]) {
    fixture.stdin.write(`${JSON.stringify({ width })}\n`);
    await waitFor(() => messages.shift(), "host width set");
    let snapshot;
    const deadline = Date.now() + 1500;
    do {
      assert.equal(helper.exitCode, null, errors || "Dock helper exited while following width");
      fixture.stdin.write('{"width":0}\n');
      snapshot = await waitFor(() => messages.shift(), "window bounds read");
      if (snapshot[0] === width && snapshot[1] === width) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    } while (Date.now() < deadline);
    assert.equal(snapshot[1], width, `Rail width must follow host: ${snapshot}; ${errors}`);
    assert.equal(snapshot[2], snapshot[3], "left edges stay aligned");
    assert.equal(snapshot[4] - snapshot[5], snapshot[6] - 2, "2px seam overlap stays intact");
  }
});

param(
    [string]$PluginHandle,
    [int]$RailHeight = 58,
    [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
# Physical pixels: cover the Windows/Eagle edge instead of leaving a hairline seam.
$DockOverlap = 2

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Concurrent;
using System.Threading;

public static class QuickRailNativeWindow
{
    private static readonly ConcurrentQueue<string> input = new ConcurrentQueue<string>();
    public static volatile bool InputClosed;

    public static void StartInput()
    {
        var thread = new Thread(() => {
            string line;
            while ((line = Console.ReadLine()) != null) input.Enqueue(line);
            InputClosed = true;
        });
        thread.IsBackground = true;
        thread.Start();
    }

    public static string ReadSettings()
    {
        string line;
        return input.TryDequeue(out line) ? line : null;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    {
        public int Size;
        public RECT Monitor;
        public RECT Work;
        public uint Flags;
    }

    [DllImport("user32.dll")]
    public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

    [DllImport("user32.dll")]
    public static extern uint GetDpiForWindow(IntPtr hWnd);

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out RECT rect, int size);

    [DllImport("user32.dll")]
    public static extern IntPtr MonitorFromRect(ref RECT rect, uint flags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ShowWindowAsync(IntPtr hWnd, int command);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetParent(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int x,
        int y,
        int cx,
        int cy,
        uint flags
    );

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsZoomed(IntPtr hWnd);
}
"@

function New-Position {
    param(
        [int]$X,
        [int]$Y
    )

    return [pscustomobject]@{
        X = $X
        Y = $Y
    }
}

function Get-LinkAction {
    param(
        $LastHost,
        $LastPlugin,
        $HostPosition,
        $PluginPosition,
        [int]$OffsetX,
        [int]$OffsetY,
        [bool]$HostMaximized = $false
    )

    $relationMatches =
        $PluginPosition.X -eq $HostPosition.X + $OffsetX -and
        $PluginPosition.Y -eq $HostPosition.Y + $OffsetY

    if ($relationMatches) {
        return [pscustomobject]@{
            target = "none"
            x = $null
            y = $null
        }
    }

    $hostMoved =
        $HostPosition.X -ne $LastHost.X -or
        $HostPosition.Y -ne $LastHost.Y
    $pluginMoved =
        $PluginPosition.X -ne $LastPlugin.X -or
        $PluginPosition.Y -ne $LastPlugin.Y

    if ($pluginMoved -and -not $hostMoved -and -not $HostMaximized) {
        return [pscustomobject]@{
            target = "host"
            x = $PluginPosition.X - $OffsetX
            y = $PluginPosition.Y - $OffsetY
        }
    }

    return [pscustomobject]@{
        target = "plugin"
        x = $HostPosition.X + $OffsetX
        y = $HostPosition.Y + $OffsetY
    }
}

function Get-DockLayout {
    param($HostFrame, $WorkArea, [int]$Height, [bool]$Maximized = $false)

    $Height = [Math]::Max(1, $Height - $DockOverlap)
    $x = $HostFrame.X
    $y = [Math]::Max($HostFrame.Y, $WorkArea.Top + $Height)
    $width = $HostFrame.Width
    $hostHeight = $HostFrame.Height
    if ($Maximized) {
        $x = $WorkArea.Left
        $y = $WorkArea.Top + $Height
        $width = $WorkArea.Right - $WorkArea.Left
        $hostHeight = $WorkArea.Bottom - $y
    }
    elseif ($y -ne $HostFrame.Y) {
        $hostHeight = [Math]::Min($hostHeight, $WorkArea.Bottom - $y)
    }

    return [pscustomobject]@{
        hostX = $x
        hostY = $y
        hostWidth = $width
        hostHeight = [Math]::Max(1, $hostHeight)
        x = $x
        y = $y - $Height
        width = $width
    }
}

function Get-HostLifecycleAction {
    param([bool]$Exists, [bool]$Visible, [bool]$Minimized, [bool]$HiddenByHost)

    if (-not $Exists) { return "close" }
    if (-not $Visible -or $Minimized) { return "hide" }
    if ($HiddenByHost) { return "show" }
    return "none"
}

if ($SelfTest) {
    $initialHost = New-Position -X 100 -Y 100
    $initialPlugin = New-Position -X 120 -Y 110
    $hostMovedParams = @{
        LastHost = $initialHost
        LastPlugin = $initialPlugin
        HostPosition = New-Position -X 130 -Y 140
        PluginPosition = $initialPlugin
        OffsetX = 20
        OffsetY = 10
    }
    $pluginMovedParams = @{
        LastHost = $initialHost
        LastPlugin = $initialPlugin
        HostPosition = $initialHost
        PluginPosition = New-Position -X 160 -Y 140
        OffsetX = 20
        OffsetY = 10
    }
    $togetherParams = @{
        LastHost = $initialHost
        LastPlugin = $initialPlugin
        HostPosition = New-Position -X 130 -Y 140
        PluginPosition = New-Position -X 150 -Y 150
        OffsetX = 20
        OffsetY = 10
    }
    $actions = @(
        Get-LinkAction @hostMovedParams
        Get-LinkAction @pluginMovedParams
        Get-LinkAction @togetherParams
    )

    [pscustomobject]@{
        ok = $true
        actions = $actions
        layouts = @(
            Get-DockLayout -HostFrame ([pscustomobject]@{ X = 100; Y = 200; Width = 1200; Height = 700 }) -WorkArea ([pscustomobject]@{ Left = 0; Top = 0; Right = 1920; Bottom = 1040 }) -Height 58
            Get-DockLayout -HostFrame ([pscustomobject]@{ X = -1920; Y = 0; Width = 1920; Height = 1040 }) -WorkArea ([pscustomobject]@{ Left = -1920; Top = 0; Right = 0; Bottom = 1040 }) -Height 87 -Maximized $true
            Get-DockLayout -HostFrame ([pscustomobject]@{ X = 0; Y = 0; Width = 1280; Height = 1040 }) -WorkArea ([pscustomobject]@{ Left = 0; Top = 0; Right = 1920; Bottom = 1040 }) -Height 58
            Get-DockLayout -HostFrame ([pscustomobject]@{ X = 100; Y = -900; Width = 1040; Height = 700 }) -WorkArea ([pscustomobject]@{ Left = 0; Top = -1080; Right = 1920; Bottom = 0 }) -Height 58
        )
        dockActions = @(
            Get-LinkAction -LastHost (New-Position 100 200) -LastPlugin (New-Position 100 144) -HostPosition (New-Position 140 240) -PluginPosition (New-Position 100 144) -OffsetX 0 -OffsetY -56
            Get-LinkAction -LastHost (New-Position 100 200) -LastPlugin (New-Position 100 144) -HostPosition (New-Position 100 200) -PluginPosition (New-Position 140 184) -OffsetX 0 -OffsetY -56
        )
        lifecycle = @(
            Get-HostLifecycleAction -Exists $true -Visible $true -Minimized $true -HiddenByHost $false
            Get-HostLifecycleAction -Exists $true -Visible $false -Minimized $false -HiddenByHost $false
            Get-HostLifecycleAction -Exists $true -Visible $true -Minimized $false -HiddenByHost $true
            Get-HostLifecycleAction -Exists $false -Visible $false -Minimized $false -HiddenByHost $false
            Get-HostLifecycleAction -Exists $true -Visible $true -Minimized $false -HiddenByHost $false
        )
    } | ConvertTo-Json -Depth 5 -Compress
    exit 0
}

if (-not $PluginHandle) {
    throw "Missing plugin native window handle."
}

$pluginValue = [UInt64]::Parse($PluginHandle, [Globalization.CultureInfo]::InvariantCulture)
$pluginWindow = [IntPtr]::new([Int64]$pluginValue)
$GW_OWNER = 4
$hostWindow = [QuickRailNativeWindow]::GetWindow($pluginWindow, $GW_OWNER)
if ($hostWindow -eq [IntPtr]::Zero) {
    $hostWindow = [QuickRailNativeWindow]::GetParent($pluginWindow)
}

if (
    $hostWindow -eq [IntPtr]::Zero -or
    -not [QuickRailNativeWindow]::IsWindow($pluginWindow) -or
    -not [QuickRailNativeWindow]::IsWindow($hostWindow)
) {
    throw "Unable to locate the Eagle owner window."
}

[void][QuickRailNativeWindow]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))

function Get-WindowPosition {
    param([IntPtr]$Handle)

    $rect = [QuickRailNativeWindow+RECT]::new()
    if (-not [QuickRailNativeWindow]::GetWindowRect($Handle, [ref]$rect)) {
        throw "Unable to read a linked window position."
    }

    $frame = [QuickRailNativeWindow+RECT]::new()
    if ([QuickRailNativeWindow]::DwmGetWindowAttribute($Handle, 9, [ref]$frame, 16) -ne 0) {
        $frame = $rect
    }
    return [pscustomobject]@{
        X = $frame.Left
        Y = $frame.Top
        Width = $frame.Right - $frame.Left
        Height = $frame.Bottom - $frame.Top
        InsetX = $frame.Left - $rect.Left
        InsetY = $frame.Top - $rect.Top
        ExtraWidth = ($rect.Right - $rect.Left) - ($frame.Right - $frame.Left)
        ExtraHeight = ($rect.Bottom - $rect.Top) - ($frame.Bottom - $frame.Top)
    }
}

function Set-WindowPosition {
    param(
        [IntPtr]$Handle,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [int]$Height
    )

    $SWP_NOZORDER = 0x0004
    $SWP_NOACTIVATE = 0x0010
    $flags = $SWP_NOZORDER -bor $SWP_NOACTIVATE
    $frame = Get-WindowPosition -Handle $Handle
    [void][QuickRailNativeWindow]::SetWindowPos(
        $Handle,
        [IntPtr]::Zero,
        ($X - $frame.InsetX),
        ($Y - $frame.InsetY),
        ($Width + $frame.ExtraWidth),
        ($Height + $frame.ExtraHeight),
        $flags
    )
}

$lastHost = Get-WindowPosition -Handle $hostWindow
$lastPlugin = Get-WindowPosition -Handle $pluginWindow
$hiddenByHost = $false
$hostWasUnavailable = $false
$initialized = $false
[QuickRailNativeWindow]::StartInput()

[pscustomobject]@{
    ok = $true
    hostHandle = $hostWindow.ToInt64().ToString([Globalization.CultureInfo]::InvariantCulture)
    mode = "top-edge"
} | ConvertTo-Json -Compress

while ([QuickRailNativeWindow]::IsWindow($pluginWindow)) {
    if ([QuickRailNativeWindow]::InputClosed) { break }
    $line = [QuickRailNativeWindow]::ReadSettings()
    if ($null -ne $line) {
        $settings = $line | ConvertFrom-Json
        if ($settings.railHeight -ge 1 -and $settings.railHeight -le 10000) {
            $RailHeight = [int]$settings.railHeight
        }
    }

    $lifecycle = Get-HostLifecycleAction `
        -Exists ([QuickRailNativeWindow]::IsWindow($hostWindow)) `
        -Visible ([QuickRailNativeWindow]::IsWindowVisible($hostWindow)) `
        -Minimized ([QuickRailNativeWindow]::IsIconic($hostWindow)) `
        -HiddenByHost $hiddenByHost
    if ($lifecycle -eq "close") {
        [pscustomobject]@{ event = "host-closed" } | ConvertTo-Json -Compress
        [void][QuickRailNativeWindow]::PostMessage($pluginWindow, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
        break
    }
    if ($lifecycle -eq "hide") {
        if ([QuickRailNativeWindow]::IsWindowVisible($pluginWindow)) {
            [void][QuickRailNativeWindow]::ShowWindowAsync($pluginWindow, 0)
            $hiddenByHost = $true
        }
        $hostWasUnavailable = $true
        Start-Sleep -Milliseconds 30
        continue
    }

    $hostPosition = Get-WindowPosition -Handle $hostWindow
    $pluginPosition = Get-WindowPosition -Handle $pluginWindow
    $dpi = [Math]::Max(96, [QuickRailNativeWindow]::GetDpiForWindow($hostWindow))
    $height = [int][Math]::Round($RailHeight * $dpi / 96)
    $dockHeight = [Math]::Max(1, $height - $DockOverlap)
    $maximized = [QuickRailNativeWindow]::IsZoomed($hostWindow)
    $linkParams = @{
        LastHost = $lastHost
        LastPlugin = $lastPlugin
        HostPosition = $hostPosition
        PluginPosition = $pluginPosition
        OffsetX = 0
        OffsetY = -$dockHeight
        HostMaximized = $false
    }
    $action = Get-LinkAction @linkParams

    # Never interpret initial docking, restoring, or a height change as a rail drag.
    $moveHost = $initialized -and -not $hostWasUnavailable -and $lastHeight -eq $height -and $action.target -eq "host"
    if ($moveHost) {
        if ($maximized) {
            [void][QuickRailNativeWindow]::ShowWindowAsync($hostWindow, 9)
            Start-Sleep -Milliseconds 30
            $hostPosition = Get-WindowPosition -Handle $hostWindow
            $maximized = $false
        }
        $hostPosition.X = $action.x
        $hostPosition.Y = $action.y
    }

    $targetRect = [QuickRailNativeWindow+RECT]::new()
    $targetRect.Left = $hostPosition.X
    $targetRect.Top = $hostPosition.Y
    $targetRect.Right = $hostPosition.X + $hostPosition.Width
    $targetRect.Bottom = $hostPosition.Y + $hostPosition.Height
    $monitor = [QuickRailNativeWindow]::MonitorFromRect([ref]$targetRect, 2)
    $monitorInfo = [QuickRailNativeWindow+MONITORINFO]::new()
    $monitorInfo.Size = [Runtime.InteropServices.Marshal]::SizeOf($monitorInfo)
    if (-not [QuickRailNativeWindow]::GetMonitorInfo($monitor, [ref]$monitorInfo)) {
        throw "Unable to read the Eagle monitor work area."
    }
    $layout = Get-DockLayout -HostFrame $hostPosition -WorkArea $monitorInfo.Work -Height $height -Maximized $maximized

    # Compare with the sample used to calculate the layout, not a newer host frame.
    # A user's resize between samples must never be overwritten by stale bounds.
    if ($moveHost -or $hostPosition.X -ne $layout.hostX -or $hostPosition.Y -ne $layout.hostY -or
        $hostPosition.Width -ne $layout.hostWidth -or $hostPosition.Height -ne $layout.hostHeight) {
        Set-WindowPosition -Handle $hostWindow -X $layout.hostX -Y $layout.hostY -Width $layout.hostWidth -Height $layout.hostHeight
    }

    # Re-read the actual host frame: Windows can enforce a minimum window size.
    $lastHost = Get-WindowPosition -Handle $hostWindow
    $pluginY = $lastHost.Y - $dockHeight
    if ($pluginPosition.X -ne $lastHost.X -or $pluginPosition.Y -ne $pluginY -or $pluginPosition.Width -ne $lastHost.Width) {
        Set-WindowPosition -Handle $pluginWindow -X $lastHost.X -Y $pluginY -Width $lastHost.Width -Height $pluginPosition.Height
    }
    if ($lifecycle -eq "show") {
        [void][QuickRailNativeWindow]::ShowWindowAsync($pluginWindow, 4)
        $hiddenByHost = $false
    }
    $lastPlugin = Get-WindowPosition -Handle $pluginWindow
    $lastHeight = $height
    $hostWasUnavailable = $false
    $initialized = $true
    Start-Sleep -Milliseconds 20
}

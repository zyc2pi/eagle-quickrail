param(
    [string]$PluginHandle,
    [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class QuickRailNativeWindow
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

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

function Get-WindowPosition {
    param([IntPtr]$Handle)

    $rect = [QuickRailNativeWindow+RECT]::new()
    if (-not [QuickRailNativeWindow]::GetWindowRect($Handle, [ref]$rect)) {
        throw "Unable to read a linked window position."
    }

    return New-Position -X $rect.Left -Y $rect.Top
}

function Set-WindowPosition {
    param(
        [IntPtr]$Handle,
        [int]$X,
        [int]$Y
    )

    $SWP_NOSIZE = 0x0001
    $SWP_NOZORDER = 0x0004
    $SWP_NOACTIVATE = 0x0010
    $flags = $SWP_NOSIZE -bor $SWP_NOZORDER -bor $SWP_NOACTIVATE
    [void][QuickRailNativeWindow]::SetWindowPos(
        $Handle,
        [IntPtr]::Zero,
        $X,
        $Y,
        0,
        0,
        $flags
    )
}

$lastHost = Get-WindowPosition -Handle $hostWindow
$lastPlugin = Get-WindowPosition -Handle $pluginWindow
$offsetX = $lastPlugin.X - $lastHost.X
$offsetY = $lastPlugin.Y - $lastHost.Y

[pscustomobject]@{
    ok = $true
    hostHandle = $hostWindow.ToInt64().ToString([Globalization.CultureInfo]::InvariantCulture)
    offsetX = $offsetX
    offsetY = $offsetY
} | ConvertTo-Json -Compress

while (
    [QuickRailNativeWindow]::IsWindow($pluginWindow) -and
    [QuickRailNativeWindow]::IsWindow($hostWindow)
) {
    if (
        [QuickRailNativeWindow]::IsIconic($pluginWindow) -or
        [QuickRailNativeWindow]::IsIconic($hostWindow)
    ) {
        Start-Sleep -Milliseconds 30
        continue
    }

    $hostPosition = Get-WindowPosition -Handle $hostWindow
    $pluginPosition = Get-WindowPosition -Handle $pluginWindow
    $linkParams = @{
        LastHost = $lastHost
        LastPlugin = $lastPlugin
        HostPosition = $hostPosition
        PluginPosition = $pluginPosition
        OffsetX = $offsetX
        OffsetY = $offsetY
        HostMaximized = [QuickRailNativeWindow]::IsZoomed($hostWindow)
    }
    $action = Get-LinkAction @linkParams

    if ($action.target -eq "host") {
        Set-WindowPosition -Handle $hostWindow -X $action.x -Y $action.y
    }
    elseif ($action.target -eq "plugin") {
        Set-WindowPosition -Handle $pluginWindow -X $action.x -Y $action.y
    }

    if ($action.target -ne "none") {
        $hostPosition = Get-WindowPosition -Handle $hostWindow
        $pluginPosition = Get-WindowPosition -Handle $pluginWindow
    }

    $lastHost = $hostPosition
    $lastPlugin = $pluginPosition
    Start-Sleep -Milliseconds 20
}

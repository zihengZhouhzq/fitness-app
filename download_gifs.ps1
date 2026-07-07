<#
.SYNOPSIS
  Fitness App - GIF Downloader
  Downloads exercise GIFs from ExerciseDB CDN, organized by body part.
.DESCRIPTION
  CDN: https://static.exercisedb.dev/media/{media_id}.gif
  GIFs saved as gifs/{category}/{media_id}.gif
.PARAMETER DryRun
  Preview mode, only count and show stats
.PARAMETER Category
  Only download a specific category (e.g. chest, back, upper_arms)
.PARAMETER Limit
  Limit the number of downloads
.PARAMETER MaxWorkers
  Concurrent download threads (default 8)
.EXAMPLE
  .\download_gifs.ps1 -DryRun
  .\download_gifs.ps1
  .\download_gifs.ps1 -Category chest
  .\download_gifs.ps1 -Limit 10
#>

param(
    [switch]$DryRun,
    [string]$Category,
    [int]$Limit = 0,
    [int]$MaxWorkers = 8
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataFile = Join-Path $ScriptDir "data\exercises.json"
$GifsDir = Join-Path $ScriptDir "gifs"
$CDNBase = "https://static.exercisedb.dev/media"

Write-Host "Loading data: $DataFile" -ForegroundColor Cyan
try {
    $exercises = Get-Content $DataFile -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Host "ERROR: Cannot load exercises.json" -ForegroundColor Red
    exit 1
}
Write-Host "Total exercises: $($exercises.Count)"

# Build unique media_id -> category mapping
$unique = @{}
foreach ($ex in $exercises) {
    $mid = $ex.media_id
    if (-not $mid) { continue }
    $cat = ($ex.category -replace '\s+', '_').ToLower()
    if ($Category -and $cat -ne $Category.ToLower()) { continue }
    if (-not $unique.ContainsKey($mid)) {
        $unique[$mid] = $cat
    }
}

$entries = $unique.GetEnumerator() | ForEach-Object { $_ }
if ($Limit -gt 0 -and $entries.Count -gt $Limit) {
    $entries = $entries | Select-Object -First $Limit
}

$total = $entries.Count
Write-Host "GIFs to download: $total (deduplicated)" -ForegroundColor Yellow

# Stats per category
$catCounts = @{}
foreach ($entry in $entries) {
    $catCounts[$entry.Value] = ($catCounts[$entry.Value] + 1)
}

Write-Host ""
Write-Host "--- Category breakdown ---"
foreach ($cat in ($catCounts.Keys | Sort-Object)) {
    Write-Host "  $cat : $($catCounts[$cat])"
}

if ($DryRun) {
    Write-Host ""
    Write-Host "Total: $total GIFs (DRY RUN)" -ForegroundColor Cyan
    Write-Host "CDN: $CDNBase/{media_id}.gif"
    exit 0
}

# Download function
function Download-OneGif {
    param($MediaId, $CatDir)
    $catPath = Join-Path $GifsDir $CatDir
    $gifPath = Join-Path $catPath "$MediaId.gif"

    if (Test-Path $gifPath) {
        $size = (Get-Item $gifPath).Length
        if ($size -gt 0) {
            return @{ MediaId = $MediaId; Status = "skip"; Size = $size }
        }
    }

    if (-not (Test-Path $catPath)) {
        New-Item -ItemType Directory -Path $catPath -Force | Out-Null
    }

    $url = "$CDNBase/$MediaId.gif"
    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        try {
            $tmpPath = "$gifPath.tmp"
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            $wc.DownloadFile($url, $tmpPath)
            $wc.Dispose()
            Move-Item $tmpPath $gifPath -Force -ErrorAction Stop
            $size = (Get-Item $gifPath).Length
            return @{ MediaId = $MediaId; Status = "ok"; Size = $size }
        }
        catch {
            try { if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force } } catch {}
            if ($_.Exception.Message -match "404") {
                return @{ MediaId = $MediaId; Status = "not_found"; Size = 0 }
            }
            if ($attempt -lt 2) { Start-Sleep -Seconds 2 }
        }
    }
    return @{ MediaId = $MediaId; Status = "fail"; Size = 0 }
}

# Download with runspace pool
Write-Host ""
Write-Host "Starting download (concurrency: $MaxWorkers)..." -ForegroundColor Green

$stats = @{ ok = 0; skip = 0; fail = 0; not_found = 0 }
$totalSize = 0
$completed = 0
$startTime = Get-Date
$lock = [System.Threading.Mutex]::new()
$syncHash = [hashtable]::Synchronized(@{})
$syncHash.Stats = $stats
$syncHash.TotalSize = 0
$syncHash.Completed = 0

$runspacePool = [runspacefactory]::CreateRunspacePool(1, $MaxWorkers)
$runspacePool.Open()
$jobs = @()

foreach ($entry in $entries) {
    $mid = $entry.Key
    $cat = $entry.Value
    $ps = [powershell]::Create()
    $ps.RunspacePool = $runspacePool
    [void]$ps.AddScript({
        param($m, $c, $gd, $cd, $sh)
        $catPath = Join-Path $gd $c
        $gifPath = Join-Path $catPath "$m.gif"
        if (Test-Path $gifPath) {
            $s = (Get-Item $gifPath).Length
            if ($s -gt 0) {
                $sh.Completed++
                return @{ MediaId = $m; Status = "skip"; Size = $s }
            }
        }
        if (-not (Test-Path $catPath)) {
            New-Item -ItemType Directory -Path $catPath -Force | Out-Null
        }
        $url = "$cd/$m.gif"
        for ($a = 0; $a -lt 3; $a++) {
            try {
                $tp = "$gifPath.tmp"
                $wc = New-Object System.Net.WebClient
                $wc.Headers.Add("User-Agent", "Mozilla/5.0")
                $wc.DownloadFile($url, $tp)
                $wc.Dispose()
                Move-Item $tp $gifPath -Force -ErrorAction Stop
                $s = (Get-Item $gifPath).Length
                $sh.Completed++
                return @{ MediaId = $m; Status = "ok"; Size = $s }
            }
            catch {
                try { if (Test-Path $tp) { Remove-Item $tp -Force } } catch {}
                if ($_.Exception.Message -match "404") {
                    $sh.Completed++
                    return @{ MediaId = $m; Status = "not_found"; Size = 0 }
                }
                if ($a -lt 2) { Start-Sleep -Seconds 2 }
            }
        }
        $sh.Completed++
        return @{ MediaId = $m; Status = "fail"; Size = 0 }
    }).AddArgument($mid).AddArgument($cat).AddArgument($GifsDir).AddArgument($CDNBase).AddArgument($syncHash)
    $jobs += @{ PS = $ps; Handle = $ps.BeginInvoke() }
}

# Collect results
foreach ($job in $jobs) {
    try {
        $result = $job.PS.EndInvoke($job.Handle)
        $stats[$result.Status]++
        $totalSize += $result.Size
        $completed++
        $pct = if ($total -gt 0) { [math]::Round($completed / $total * 100, 1) } else { 0 }
        $elapsed = ((Get-Date) - $startTime).TotalSeconds
        $speed = if ($elapsed -gt 0) { [math]::Round($completed / $elapsed, 1) } else { 0 }
        $sizeMB = [math]::Round($totalSize / 1MB, 1)
        Write-Host "$pct% $completed/$total ok=$($stats.ok) skip=$($stats.skip) fail=$($stats.fail) 404=$($stats.not_found) ${sizeMB}MB ${speed}/s"
    }
    catch {
        $stats["fail"]++
        $completed++
    }
    $job.PS.Dispose()
}

$runspacePool.Close()
$runspacePool.Dispose()

# Summary
$elapsed = ((Get-Date) - $startTime).TotalSeconds
$totalSizeMB = [math]::Round($totalSize / 1MB, 1)
$elapsedStr = [math]::Round($elapsed, 1)

Write-Host ""
Write-Host "=== Download Complete ===" -ForegroundColor Green
Write-Host "  Success:  $($stats.ok)"
Write-Host "  Skipped:  $($stats.skip)"
Write-Host "  Failed:   $($stats.fail)"
Write-Host "  404:      $($stats.not_found)"
Write-Host "  Size:     ${totalSizeMB} MB"
Write-Host "  Time:     ${elapsedStr}s"

# Per-category sizes
Write-Host ""
Write-Host "--- Category sizes ---"
Get-ChildItem $GifsDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $gifs = Get-ChildItem $_.FullName -Filter "*.gif" -ErrorAction SilentlyContinue
    $size = ($gifs | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($size / 1MB, 1)
    Write-Host "  $($_.Name): $($gifs.Count) files, ${sizeMB} MB"
}

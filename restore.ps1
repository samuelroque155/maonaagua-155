
$logsPath = "C:\Users\samue\.gemini\antigravity\brain\*\.system_generated\logs\overview.txt"
$logFiles = Get-ChildItem -Path $logsPath

$filesToRestore = @{}

foreach ($log in $logFiles) {
    $content = Get-Content $log.FullName -Raw
    $lines = $content -split "`r`n|`n"
    foreach ($line in $lines) {
        if ($line -match "write_to_file") {
            try {
                $json = $line | ConvertFrom-Json
                if ($json.tool_calls) {
                    foreach ($call in $json.tool_calls) {
                        if ($call.name -eq "write_to_file") {
                            $target = $call.args.TargetFile
                            $code = $call.args.CodeContent
                            
                            if ($target -match "src[/\\](pages|context|services)[/\\]") {
                                $time = [DateTime]$json.created_at
                                if (-not $filesToRestore.ContainsKey($target) -or $time -gt $filesToRestore[$target].Time) {
                                    $filesToRestore[$target] = @{
                                        Code = $code
                                        Time = $time
                                    }
                                }
                            }
                        }
                    }
                }
            } catch {}
        }
    }
}

foreach ($key in $filesToRestore.Keys) {
    $targetPath = $key.Replace("`"", "").Replace("\\", "\")
    $dir = Split-Path $targetPath
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -Path $targetPath -Value $filesToRestore[$key].Code -Encoding UTF8
    Write-Host "Restored $targetPath"
}


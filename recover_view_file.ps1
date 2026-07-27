$logPath = "C:\Users\samue\.gemini\antigravity\brain\5fb02193-1d15-4b91-9675-5c38fc7a0646\.system_generated\logs\overview.txt"
$content = Get-Content -Path $logPath -Raw
$lines = $content -split "
|
"

$files = @{}

foreach ($line in $lines) {
    if ($line -match '"type":"TOOL_RESPONSE"' -and $line -match 'view_file') {
        try {
            $json = $line | ConvertFrom-Json
            $output = $json.content
            if ($output -match "File Path: (`file:///.*?`)") {
                $path = $matches[1] -replace 'ile:///(.*?)', '$1' -replace '%20', ' ' -replace '/', '\'
                # Extract content
                $startToken = "The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
"
                $endToken = "The above content "
                $startIndex = $output.IndexOf($startToken) + $startToken.Length
                $endIndex = $output.IndexOf($endToken)
                if ($startIndex -gt $startToken.Length -1 -and $endIndex -gt $startIndex) {
                    $codeLines = $output.Substring($startIndex, $endIndex - $startIndex) -split "
"
                    $cleanCode = @()
                    foreach ($cLine in $codeLines) {
                        if ($cLine -match '^\d+:\s?(.*)') {
                            $cleanCode += $matches[1]
                        }
                    }
                    $files[$path] = $cleanCode -join "
"
                }
            }
        } catch {}
    }
}

foreach ($key in $files.Keys) {
    $dir = Split-Path $key
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -Path $key -Value $files[$key] -Encoding UTF8
    Write-Host "Restored $key"
}

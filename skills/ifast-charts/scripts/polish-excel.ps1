param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'chart-layout.ps1')
$output=(Resolve-Path -LiteralPath $OutputDirectory).Path
$spec=Get-Content -LiteralPath (Join-Path $output 'normalized.json') -Raw -Encoding utf8 | ConvertFrom-Json
$bookPath=Join-Path $output 'charts.xlsx'
$app=$null;$book=$null
try {
    $app=New-Object -ComObject Excel.Application
    $app.Visible=$false;$app.DisplayAlerts=$false
    $book=$app.Workbooks.Open($bookPath)
    $report=@()
    foreach($cfg in $spec.charts) {
        $sheet=$book.Worksheets.Item($cfg.sheet);$sheet.Activate()
        $app.ActiveWindow.DisplayGridlines=$false
        $obj=$sheet.ChartObjects(1)
        $obj.Left=$sheet.Range('B2').Left;$obj.Top=$sheet.Range('B2').Top
        $layout=Set-ChartLayout $obj $cfg $spec.theme
        $obj.Activate()
        $preview=Join-Path $output ($cfg.id+'-excel.png')
        if(-not $obj.Chart.Export($preview,'PNG')){throw "Preview failed: $($cfg.id)"}
        $axes=@()
        for($a=0;$a -lt $cfg.scales.Count;$a++) {
            $axis=$obj.Chart.Axes(2,$a+1)
            $count=[Math]::Round(($axis.MaximumScale-$axis.MinimumScale)/$axis.MajorUnit)+1
            if($count -lt 4 -or $count -gt 7){throw 'Axis label count is outside 4-7.'}
            $axes+=@{min=$axis.MinimumScale;max=$axis.MaximumScale;step=$axis.MajorUnit;count=$count}
        }
        $report+=@{id=$cfg.id;layout=$layout;axes=$axes;titleFont=$obj.Chart.ChartTitle.Format.TextFrame2.TextRange.Font.Name;titleSize=$obj.Chart.ChartTitle.Format.TextFrame2.TextRange.Font.Size}
    }
    $book.Worksheets.Item(1).Activate();$book.Save()
    $book.Close($false);[Runtime.InteropServices.Marshal]::ReleaseComObject($book) | Out-Null;$book=$null
    $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $output 'excel-verification.json') -Encoding utf8
    $manifestPath=Join-Path $output 'manifest.json'
    $manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
    $manifest.artifacts.'charts.xlsx'=(Get-FileHash -LiteralPath $bookPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $manifest.verification.nativeApplication='Windows Excel rendered; inspect previews for visual acceptance'
    $manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding utf8
    Write-Output 'Excel layout applied and previews exported. Inspect previews before final acceptance.'
} finally {
    if($null -ne $book){$book.Close($false);[Runtime.InteropServices.Marshal]::ReleaseComObject($book) | Out-Null}
    if($null -ne $app){$app.Quit();[Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null}
}

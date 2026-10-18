function Set-ChartLayout($obj,$cfg,$theme) {
    $c=$obj.Chart
    $obj.Width=[double]$cfg.size.widthPt
    $obj.Height=[double]$cfg.size.heightPt
    $c.ChartArea.AutoScaleFont=$false
    $c.HasLegend=$true;$c.Legend.Position=-4107;$c.Legend.IncludeInLayout=$true
    $c.Legend.Font.Name='HarmonyOS Sans SC';$c.Legend.Font.Size=9
    $c.Legend.Font.Color=ColorValue $theme.colors.text
    $c.ChartTitle.AutoScaleFont=$false
    $font=$c.ChartTitle.Format.TextFrame2.TextRange.Font
    $font.Name='HarmonyOS Sans SC';$font.NameFarEast='HarmonyOS Sans SC';$font.Size=12;$font.Bold=-1
    $font.Fill.ForeColor.RGB=ColorValue $theme.colors.text
    $c.ChartTitle.Top=6
    $cat=$c.Axes(1,1)
    $cat.TickLabels.Font.Name='HarmonyOS Sans SC';$cat.TickLabels.Font.Size=9
    $cat.TickLabels.Font.Color=ColorValue $theme.colors.mutedText
    if($null -ne $cfg.dates) {
        $first=[datetime]::ParseExact($cfg.dates[0],'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
        $last=[datetime]::ParseExact($cfg.dates[-1],'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
        $start=[datetime]::new($first.Year,1,1)
        $cat.CategoryType=3
        $cat.BaseUnit=0
        $cat.MajorUnitScale=2
        $cat.MajorUnit=1.0
        $cat.MinimumScale=$start.ToOADate()
        $cat.MaximumScale=$last.ToOADate()
        $cat.TickLabelSpacing=1
        $cat.TickLabels.NumberFormat=$(if($cfg.size.name -eq 'small'){'yy'}else{'yyyy'})
        $cat.MajorTickMark=3
    } else {
        $cat.CategoryType=2
        $cat.TickLabels.NumberFormat='General'
        $cat.MajorTickMark=3
    }
    $cat.Format.Line.Visible=-1
    $cat.Format.Line.ForeColor.RGB=ColorValue $theme.colors.mutedText
    $cat.Format.Line.Weight=0.5
    for($a=0;$a -lt $cfg.scales.Count;$a++) {
        $ax=$c.Axes(2,$a+1)
        $ax.HasTitle=$false
        $ax.TickLabels.Font.Name='HarmonyOS Sans SC';$ax.TickLabels.Font.Size=9
        $ax.TickLabels.Font.Color=ColorValue $theme.colors.mutedText
        $display=$cfg.axisDisplays[$a]
        if($display.factor -gt 1) {
            $ax.DisplayUnitCustom=[double]$display.factor
            $ax.HasDisplayUnitLabel=$false
        } else {$ax.DisplayUnit=-4142}
        $ax.TickLabels.NumberFormat=$display.numberFormat
    }
    $c.Refresh()
    $rightPad=$(if($cfg.scales.Count -gt 1){34}else{12})
    $c.PlotArea.InsideLeft=36
    $c.PlotArea.InsideWidth=[double]$cfg.size.widthPt-36-$rightPad
    $c.PlotArea.InsideTop=44
    $c.PlotArea.InsideHeight=[double]$cfg.size.heightPt-44-48
    $labels=@()
    for($a=0;$a -lt $cfg.scales.Count;$a++) {
        $name="iFAST_Unit_$a"
        for($j=$c.Shapes.Count;$j -ge 1;$j--){if($c.Shapes.Item($j).Name -eq $name){$c.Shapes.Item($j).Delete()}}
        $width=100.0
        $left=$(if($a -eq 0){$c.PlotArea.InsideLeft}else{$c.PlotArea.InsideLeft+$c.PlotArea.InsideWidth-$width})
        $label=$c.Shapes.AddTextbox(1,[double]$left,[double]($c.PlotArea.InsideTop-17),$width,14.0)
        $label.Name=$name
        $label.TextFrame2.TextRange.Text=$cfg.axisDisplays[$a].unit
        $label.TextFrame2.Orientation=1
        $label.TextFrame2.MarginLeft=0;$label.TextFrame2.MarginRight=0
        $label.TextFrame2.MarginTop=0;$label.TextFrame2.MarginBottom=0
        $label.TextFrame2.WordWrap=0
        $label.TextFrame2.TextRange.Font.Name='HarmonyOS Sans SC'
        $label.TextFrame2.TextRange.Font.NameFarEast='HarmonyOS Sans SC'
        $label.TextFrame2.TextRange.Font.Size=9
        $label.TextFrame2.TextRange.Font.Fill.ForeColor.RGB=ColorValue $theme.colors.mutedText
        $label.TextFrame2.TextRange.ParagraphFormat.Alignment=$(if($a -eq 0){1}else{3})
        $label.Line.Visible=0;$label.Fill.Visible=0
        $labels+=@{text=$label.TextFrame2.TextRange.Text;orientation=$label.TextFrame2.Orientation;color=$label.TextFrame2.TextRange.Font.Fill.ForeColor.RGB;top=$label.Top;left=$label.Left}
    }
    $c.ChartTitle.Left=($obj.Width-$c.ChartTitle.Width)/2
    $c.ChartTitle.Top=6
    return @{widthCm=$obj.Width*2.54/72;heightCm=$obj.Height*2.54/72;units=$labels;dateAxis=($null -ne $cfg.dates);januaryTicks=$(if($null -ne $cfg.dates){@{minimum=$cat.MinimumScale;majorUnit=$cat.MajorUnit;majorUnitScale=$cat.MajorUnitScale;tickMark=$cat.MajorTickMark}}else{$null})}
}
function ColorValue([string]$hex) {
    $h=$hex.TrimStart('#')
    return [Convert]::ToInt32($h.Substring(0,2),16)+256*[Convert]::ToInt32($h.Substring(2,2),16)+65536*[Convert]::ToInt32($h.Substring(4,2),16)
}

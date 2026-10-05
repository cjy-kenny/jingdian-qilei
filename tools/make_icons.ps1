# 生成应用图标：木色圆角底 + 「棋」字 + 三枚红黑白圆点（U+68CB，避免脚本编码问题）
Add-Type -AssemblyName System.Drawing

$sizes = @{ 'mipmap-mdpi'=48; 'mipmap-hdpi'=72; 'mipmap-xhdpi'=96; 'mipmap-xxhdpi'=144; 'mipmap-xxxhdpi'=192 }
$root = Join-Path $PSScriptRoot '..\android\res'
$qi = [char]0x68CB

foreach($dir in $sizes.Keys){
  $size = [int]$sizes[$dir]
  $outDir = Join-Path $root $dir
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null

  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'

  $r = [float]($size * 0.22)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc([float]0, [float]0, [float](2*$r), [float](2*$r), [float]180, [float]90)
  $p.AddArc([float]($size - 2*$r), [float]0, [float](2*$r), [float](2*$r), [float]270, [float]90)
  $p.AddArc([float]($size - 2*$r), [float]($size - 2*$r), [float](2*$r), [float](2*$r), [float]0, [float]90)
  $p.AddArc([float]0, [float]($size - 2*$r), [float](2*$r), [float](2*$r), [float]90, [float]90)
  $p.CloseFigure()

  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
    [System.Drawing.Color]::FromArgb(226,176,118), [System.Drawing.Color]::FromArgb(193,137,60), [float]55)
  $g.FillPath($brush, $p)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110,62,20), [float]([Math]::Max(2, $size * 0.035)))
  $g.DrawPath($pen, $p)

  $font = New-Object System.Drawing.Font('Microsoft YaHei', [float]($size * 0.5), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF([float]0, [float]($size * -0.04), [float]$size, [float]($size * 0.84))
  $g.DrawString($qi, $font, [System.Drawing.Brushes]::White, $textRect, $sf)

  $dotR = [float]($size * 0.055)
  $y = [float]($size * 0.82)
  $xs = @([float]($size*0.38), [float]($size*0.5), [float]($size*0.62))
  $cols = @(
    [System.Drawing.Color]::FromArgb(211,80,63),
    [System.Drawing.Color]::FromArgb(35,30,25),
    [System.Drawing.Color]::White
  )
  for($i = 0; $i -lt 3; $i++){
    $gb = New-Object System.Drawing.SolidBrush($cols[$i])
    $g.FillEllipse($gb, [float]($xs[$i] - $dotR), [float]($y - $dotR), [float](2*$dotR), [float](2*$dotR))
    $gb.Dispose()
  }

  $outPath = Join-Path $outDir 'ic_launcher.png'
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "icon -> $outPath ($size px)"

  $g.Dispose(); $bmp.Dispose(); $pen.Dispose(); $brush.Dispose(); $font.Dispose(); $p.Dispose()
}

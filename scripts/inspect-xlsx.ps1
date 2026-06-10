param(
  [string]$Path = $env:DATASET_XLSX_PATH
)

if ([string]::IsNullOrWhiteSpace($Path)) {
  $fallback = 'C:\Users\Suhama\Downloads\Problem#1_Sample_Datasets (TEKROWE).xlsx'
  if (Test-Path -LiteralPath $fallback) {
    $Path = $fallback
  }
}

if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
  throw "Workbook path not found. Set DATASET_XLSX_PATH or pass -Path."
}

function Get-UInt16LE {
  param([byte[]]$Bytes, [int]$Offset)
  return [int]($Bytes[$Offset] + ($Bytes[$Offset + 1] -shl 8))
}

function Get-UInt32LE {
  param([byte[]]$Bytes, [int]$Offset)
  return [int64](
    $Bytes[$Offset] +
    ($Bytes[$Offset + 1] -shl 8) +
    ($Bytes[$Offset + 2] -shl 16) +
    ($Bytes[$Offset + 3] -shl 24)
  )
}

function Decode-XmlText {
  param([string]$Text)
  if ($null -eq $Text) { return "" }
  return ($Text `
    -replace '&lt;', '<' `
    -replace '&gt;', '>' `
    -replace '&quot;', '"' `
    -replace '&apos;', "'" `
    -replace '&amp;', '&')
}

function Inflate-RawDeflate {
  param([byte[]]$Bytes)
  $input = [System.IO.MemoryStream]::new([byte[]]$Bytes)
  $output = [System.IO.MemoryStream]::new()
  $deflate = [System.IO.Compression.DeflateStream]::new(
    $input,
    [System.IO.Compression.CompressionMode]::Decompress
  )
  try {
    $deflate.CopyTo($output)
    return $output.ToArray()
  } finally {
    $deflate.Dispose()
    $input.Dispose()
    $output.Dispose()
  }
}

function Get-ZipEntries {
  param([byte[]]$Bytes)

  $signature = @(0x50, 0x4b, 0x05, 0x06)
  $eocd = -1
  for ($i = $Bytes.Length - 22; $i -ge 0; $i--) {
    if (
      $Bytes[$i] -eq $signature[0] -and
      $Bytes[$i + 1] -eq $signature[1] -and
      $Bytes[$i + 2] -eq $signature[2] -and
      $Bytes[$i + 3] -eq $signature[3]
    ) {
      $eocd = $i
      break
    }
  }

  if ($eocd -lt 0) {
    throw "Unable to locate ZIP end-of-central-directory record."
  }

  $centralDirectorySize = Get-UInt32LE -Bytes $Bytes -Offset ($eocd + 12)
  $centralDirectoryOffset = Get-UInt32LE -Bytes $Bytes -Offset ($eocd + 16)
  $limit = $centralDirectoryOffset + $centralDirectorySize
  $entries = @{}
  $position = $centralDirectoryOffset

  while ($position -lt $limit) {
    if (Get-UInt32LE -Bytes $Bytes -Offset $position -ne 0x02014b50) {
      throw "Invalid ZIP central directory header at offset $position."
    }

    $compressionMethod = Get-UInt16LE -Bytes $Bytes -Offset ($position + 10)
    $compressedSize = Get-UInt32LE -Bytes $Bytes -Offset ($position + 20)
    $uncompressedSize = Get-UInt32LE -Bytes $Bytes -Offset ($position + 24)
    $fileNameLength = Get-UInt16LE -Bytes $Bytes -Offset ($position + 28)
    $extraLength = Get-UInt16LE -Bytes $Bytes -Offset ($position + 30)
    $commentLength = Get-UInt16LE -Bytes $Bytes -Offset ($position + 32)
    $localHeaderOffset = Get-UInt32LE -Bytes $Bytes -Offset ($position + 42)
    $nameBytes = $Bytes[($position + 46)..($position + 45 + $fileNameLength)]
    $entryName = [System.Text.Encoding]::UTF8.GetString($nameBytes)

    $entries[$entryName] = [pscustomobject]@{
      Name = $entryName
      Method = $compressionMethod
      CompressedSize = $compressedSize
      UncompressedSize = $uncompressedSize
      LocalHeaderOffset = $localHeaderOffset
    }

    $position += 46 + $fileNameLength + $extraLength + $commentLength
  }

  return $entries
}

function Get-ZipEntryText {
  param(
    [byte[]]$Bytes,
    [pscustomobject]$Entry
  )

  $offset = $Entry.LocalHeaderOffset
  if (Get-UInt32LE -Bytes $Bytes -Offset $offset -ne 0x04034b50) {
    throw "Invalid ZIP local header for $($Entry.Name)."
  }

  $fileNameLength = Get-UInt16LE -Bytes $Bytes -Offset ($offset + 26)
  $extraLength = Get-UInt16LE -Bytes $Bytes -Offset ($offset + 28)
  $dataOffset = $offset + 30 + $fileNameLength + $extraLength
  $data = $Bytes[$dataOffset..($dataOffset + $Entry.CompressedSize - 1)]

  if ($Entry.Method -eq 0) {
    return [System.Text.Encoding]::UTF8.GetString([byte[]]$data)
  }

  if ($Entry.Method -eq 8) {
    $decoded = Inflate-RawDeflate -Bytes ([byte[]]$data)
    return [System.Text.Encoding]::UTF8.GetString($decoded)
  }

  throw "Unsupported ZIP compression method $($Entry.Method) for $($Entry.Name)."
}

function Get-SharedStrings {
  param([string]$Xml)

  $shared = @()
  if ([string]::IsNullOrWhiteSpace($Xml)) {
    return $shared
  }

  $siMatches = [regex]::Matches($Xml, '<si\b[^>]*>(.*?)</si>', 'Singleline')
  foreach ($match in $siMatches) {
    $parts = [regex]::Matches($match.Groups[1].Value, '<t[^>]*>(.*?)</t>', 'Singleline')
    $value = ($parts | ForEach-Object { Decode-XmlText $_.Groups[1].Value }) -join ''
    $shared += $value
  }

  return $shared
}

function Get-CellValue {
  param(
    [string]$CellXml,
    [string[]]$SharedStrings
  )

  $typeMatch = [regex]::Match($CellXml, '\bt="([^"]+)"')
  $cellType = if ($typeMatch.Success) { $typeMatch.Groups[1].Value } else { "" }

  $inlineMatch = [regex]::Match($CellXml, '<is>.*?<t[^>]*>(.*?)</t>.*?</is>', 'Singleline')
  if ($inlineMatch.Success) {
    return Decode-XmlText $inlineMatch.Groups[1].Value
  }

  $valueMatch = [regex]::Match($CellXml, '<v>(.*?)</v>', 'Singleline')
  if (-not $valueMatch.Success) {
    return ""
  }

  $raw = Decode-XmlText $valueMatch.Groups[1].Value
  switch ($cellType) {
    's' {
      $index = [int]$raw
      if ($index -ge 0 -and $index -lt $SharedStrings.Length) {
        return $SharedStrings[$index]
      }
      return $raw
    }
    'b' {
      return if ($raw -eq '1') { 'TRUE' } else { 'FALSE' }
    }
    default {
      return $raw
    }
  }
}

function Get-ColumnIndex {
  param([string]$CellRef)
  $letters = [regex]::Match($CellRef, '^[A-Z]+').Value
  $index = 0
  foreach ($ch in $letters.ToCharArray()) {
    $index = ($index * 26) + ([int][char]$ch - 64)
  }
  return $index
}

function Get-WorksheetSummary {
  param(
    [string]$SheetName,
    [string]$SheetXml,
    [string[]]$SharedStrings
  )

  $rows = [regex]::Matches($SheetXml, '<row\b', 'IgnoreCase').Count
  $firstRowMatch = [regex]::Match($SheetXml, '<row\b[^>]*r="1"[^>]*>(.*?)</row>', 'Singleline')
  $headers = @()

  if ($firstRowMatch.Success) {
    $cellMatches = [regex]::Matches($firstRowMatch.Groups[1].Value, '<c\b[^>]*r="([A-Z]+\d+)"[^>]*>(.*?)</c>', 'Singleline')
    $cells = @()
    foreach ($cell in $cellMatches) {
      $ref = $cell.Groups[1].Value
      $xml = $cell.Groups[0].Value
      $cells += [pscustomobject]@{
        Ref = $ref
        Index = Get-ColumnIndex -CellRef $ref
        Value = Get-CellValue -CellXml $xml -SharedStrings $SharedStrings
      }
    }
    $headers = $cells | Sort-Object Index | ForEach-Object { $_.Value }
  }

  [pscustomobject]@{
    sheet = $SheetName
    rows = $rows
    headers = $headers
  }
}

function Get-WorksheetRows {
  param(
    [string]$SheetXml,
    [string[]]$SharedStrings,
    [int]$Take = 8
  )

  $result = @()
  $rowMatches = [regex]::Matches($SheetXml, '<row\b[^>]*>(.*?)</row>', 'Singleline')
  foreach ($row in $rowMatches) {
    $cells = @{}
    $maxIndex = 0
    $cellMatches = [regex]::Matches($row.Groups[1].Value, '<c\b[^>]*r="([A-Z]+\d+)"[^>]*>(.*?)</c>', 'Singleline')
    foreach ($cell in $cellMatches) {
      $ref = $cell.Groups[1].Value
      $index = Get-ColumnIndex -CellRef $ref
      $value = Get-CellValue -CellXml $cell.Groups[0].Value -SharedStrings $SharedStrings
      $cells[$index] = $value
      if ($index -gt $maxIndex) { $maxIndex = $index }
    }
    if ($maxIndex -gt 0) {
      $values = for ($i = 1; $i -le $maxIndex; $i++) {
        if ($cells.ContainsKey($i)) { $cells[$i] } else { "" }
      }
      if (($values -join '').Trim()) {
        $result += ,$values
      }
    }
    if ($result.Count -ge $Take) {
      break
    }
  }
  return $result
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipTextByName {
  param(
    [System.IO.Compression.ZipArchive]$Zip,
    [string]$Name
  )

  $entry = $Zip.GetEntry($Name)
  if ($null -eq $entry) {
    throw "Workbook entry not found: $Name"
  }

  $stream = $entry.Open()
  $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
    $stream.Dispose()
  }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
try {
  $workbookXml = Get-ZipTextByName -Zip $zip -Name 'xl/workbook.xml'
  $relsXml = Get-ZipTextByName -Zip $zip -Name 'xl/_rels/workbook.xml.rels'
  $zipEntryNames = @{}
  foreach ($entry in $zip.Entries) {
    $zipEntryNames[$entry.FullName] = $true
  }

  $sharedStrings = @()
  if ($zipEntryNames.ContainsKey('xl/sharedStrings.xml')) {
    $sharedXml = Get-ZipTextByName -Zip $zip -Name 'xl/sharedStrings.xml'
    $sharedStrings = Get-SharedStrings -Xml $sharedXml
  }
} finally {
}

$relMap = @{}
$relMatches = [regex]::Matches($relsXml, '<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', 'IgnoreCase')
foreach ($rel in $relMatches) {
  $relMap[$rel.Groups[1].Value] = $rel.Groups[2].Value
}

$sheetMatches = [regex]::Matches($workbookXml, '<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', 'IgnoreCase')
$summaries = @()

foreach ($sheet in $sheetMatches) {
  $sheetName = $sheet.Groups[1].Value
  $relId = $sheet.Groups[2].Value
  $target = $relMap[$relId]
  if (-not $target) {
    continue
  }
  $entryName = if ($target.StartsWith('xl/')) { $target } else { "xl/$target" }
  if (-not $zipEntryNames.ContainsKey($entryName)) {
    continue
  }
  $sheetXml = Get-ZipTextByName -Zip $zip -Name $entryName
  $summaries += Get-WorksheetSummary -SheetName $sheetName -SheetXml $sheetXml -SharedStrings $sharedStrings
  Write-Host ""
  Write-Host "First rows for sheet: $sheetName"
  $previewRows = Get-WorksheetRows -SheetXml $sheetXml -SharedStrings $sharedStrings -Take 8
  $rowIndex = 1
  foreach ($previewRow in $previewRows) {
    Write-Host ("{0}: {1}" -f $rowIndex, ($previewRow -join ' | '))
    $rowIndex++
  }
}

$zip.Dispose()

$summaries | ForEach-Object {
  [pscustomobject]@{
    Sheet = $_.sheet
    RowCount = $_.rows
    Headers = ($_.headers -join ' | ')
  }
} | Format-Table -AutoSize

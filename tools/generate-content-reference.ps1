param(
    [string]$ProjectRoot = '',
    [string]$Output = ''
)

$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

if (-not $Output) {
    $Output = Join-Path $ProjectRoot 'design\content-reference.md'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-SharedStrings {
    param([System.IO.Compression.ZipArchive]$Zip)

    $entry = $Zip.GetEntry('xl/sharedStrings.xml')
    if (-not $entry) {
        return @()
    }

    [xml]$xml = New-Object xml
    $reader = New-Object System.IO.StreamReader($entry.Open())
    try {
        $xml.LoadXml($reader.ReadToEnd())
    } finally {
        $reader.Dispose()
    }

    $shared = New-Object System.Collections.Generic.List[string]
    foreach ($si in $xml.sst.si) {
        if ($si.t) {
            $shared.Add([string]$si.t)
            continue
        }
        if ($si.r) {
            $shared.Add((($si.r | ForEach-Object { $_.t }) -join ''))
            continue
        }
        $shared.Add('')
    }
    return $shared
}

function Get-CellText {
    param(
        $Cell,
        [string[]]$SharedStrings
    )

    if (-not $Cell) {
        return ''
    }

    switch ([string]$Cell.t) {
        's' {
            if ($null -eq $Cell.v -or $Cell.v -eq '') { return '' }
            return [string]$SharedStrings[[int]$Cell.v]
        }
        'inlineStr' {
            if ($Cell.is.t) { return [string]$Cell.is.t }
            if ($Cell.is.r) { return (($Cell.is.r | ForEach-Object { $_.t }) -join '') }
            return ''
        }
        default {
            if ($Cell.v) { return [string]$Cell.v }
            if ($Cell.t) { return [string]$Cell.t }
            return ''
        }
    }
}

function New-OrderedMap {
    return [ordered]@{}
}

function Add-NestedValue {
    param(
        [System.Collections.IDictionary]$Target,
        [string[]]$Parts,
        [bool]$IsArray,
        [string]$Value
    )

    $node = $Target
    for ($i = 0; $i -lt $Parts.Length - 1; $i++) {
        $part = $Parts[$i]
        if (-not $node.Contains($part) -or $node[$part] -isnot [System.Collections.IDictionary]) {
            $node[$part] = [ordered]@{}
        }
        $node = $node[$part]
    }

    $leaf = $Parts[-1]
    if ($IsArray) {
        if (-not $node.Contains($leaf) -or $node[$leaf] -isnot [System.Collections.IList]) {
            $node[$leaf] = New-Object System.Collections.ArrayList
        }
        [void]$node[$leaf].Add($Value)
        return
    }

    if ($node.Contains($leaf)) {
        if ($node[$leaf] -is [System.Collections.IList]) {
            [void]$node[$leaf].Add($Value)
        } else {
            $list = New-Object System.Collections.ArrayList
            [void]$list.Add($node[$leaf])
            [void]$list.Add($Value)
            $node[$leaf] = $list
        }
        return
    }

    $node[$leaf] = $Value
}

function Convert-SheetToRecords {
    param(
        [string]$Path
    )

    $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Path))
    try {
        $shared = Get-SharedStrings -Zip $zip

        $sheetEntry = $zip.GetEntry('xl/worksheets/sheet1.xml')
        [xml]$sheetXml = New-Object xml
        $reader = New-Object System.IO.StreamReader($sheetEntry.Open())
        try {
            $sheetXml.LoadXml($reader.ReadToEnd())
        } finally {
            $reader.Dispose()
        }

        $rows = @($sheetXml.worksheet.sheetData.row)
        if ($rows.Count -lt 2) {
            return @()
        }

        $headerRow = $rows[0]
        $headers = [ordered]@{}
        foreach ($cell in $headerRow.c) {
            $column = ([string]$cell.r) -replace '\d', ''
            $headers[$column] = Get-CellText -Cell $cell -SharedStrings $shared
        }

        $records = New-Object System.Collections.Generic.List[object]
        foreach ($row in ($rows | Select-Object -Skip 2)) {
            $record = [ordered]@{}
            foreach ($cell in $row.c) {
                $column = ([string]$cell.r) -replace '\d', ''
                if (-not $headers.Contains($column)) {
                    continue
                }

                $rawHeader = [string]$headers[$column]
                $value = (Get-CellText -Cell $cell -SharedStrings $shared).Trim()
                if ([string]::IsNullOrWhiteSpace($rawHeader) -or [string]::IsNullOrWhiteSpace($value)) {
                    continue
                }

                $isArray = $rawHeader.EndsWith('[]')
                $header = $rawHeader.TrimStart('$')
                if ($isArray) {
                    $header = $header.Substring(0, $header.Length - 2)
                }

                $parts = $header.Split(':')
                Add-NestedValue -Target $record -Parts $parts -IsArray $isArray -Value $value
            }

            if ($record.Count -gt 0) {
                $records.Add($record)
            }
        }

        return $records
    } finally {
        $zip.Dispose()
    }
}

function Get-List {
    param($Value)

    if ($null -eq $Value) { return @() }
    if ($Value -is [string]) { return @($Value) }
    if ($Value -is [System.Collections.IEnumerable]) { return @($Value) }
    return @($Value)
}

function Format-Number {
    param([string]$Value)

    if ($Value -match '^-?\d+(\.\d+)?$') {
        $number = [double]$Value
        if ($number -gt 0) { return "+$Value" }
        return $Value
    }
    return $Value
}

function Format-EffectMap {
    param([System.Collections.IDictionary]$Effect)

    if (-not $Effect -or $Effect.Count -eq 0) {
        return 'None'
    }

    $pairs = foreach ($key in ($Effect.Keys | Sort-Object)) {
        "$key $(Format-Number $Effect[$key])"
    }
    return ($pairs -join ', ')
}

function Format-Array {
    param($Items)

    $values = Get-List $Items | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) }
    if ($values.Count -eq 0) { return 'None' }
    return ($values -join ', ')
}

function Format-Bool {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -eq '0') { return 'No' }
    return 'Yes'
}

function Format-Opportunity {
    param([string]$Value)

    switch ($Value) {
        'START' { return 'START: checked after life starts' }
        'TRAJECTORY' { return 'TRAJECTORY: checked during life progression' }
        'SUMMARY' { return 'SUMMARY: checked on summary screen' }
        'END' { return 'END: checked after pressing remake' }
        default { return $Value }
    }
}

function Convert-ToInt {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    return [int]$Value
}

function Format-AgeRanges {
    param([int[]]$Ages)

    $ages = @($Ages | Sort-Object -Unique)
    if ($ages.Count -eq 0) {
        return 'None'
    }

    $segments = New-Object System.Collections.Generic.List[string]
    $start = $ages[0]
    $end = $ages[0]

    for ($i = 1; $i -lt $ages.Count; $i++) {
        if ($ages[$i] -eq $end + 1) {
            $end = $ages[$i]
            continue
        }

        if ($start -eq $end) {
            $segments.Add([string]$start)
        } else {
            $segments.Add("$start-$end")
        }
        $start = $ages[$i]
        $end = $ages[$i]
    }

    if ($start -eq $end) {
        $segments.Add([string]$start)
    } else {
        $segments.Add("$start-$end")
    }

    return ($segments -join ', ')
}

function Format-AgeWeightRanges {
    param([System.Collections.IDictionary]$AgeWeightMap)

    if (-not $AgeWeightMap -or $AgeWeightMap.Count -eq 0) {
        return 'None'
    }

    $ages = @($AgeWeightMap.Keys | ForEach-Object { [int]$_ } | Sort-Object)
    $segments = New-Object System.Collections.Generic.List[string]
    $start = $ages[0]
    $end = $ages[0]
    $weight = [double]$AgeWeightMap[[string]$start]

    for ($i = 1; $i -lt $ages.Count; $i++) {
        $age = $ages[$i]
        $currentWeight = [double]$AgeWeightMap[[string]$age]
        if ($age -eq $end + 1 -and $currentWeight -eq $weight) {
            $end = $age
            continue
        }

        if ($start -eq $end) {
            $segment = [string]$start
        } else {
            $segment = "$start-$end"
        }
        if ($weight -ne 1) {
            $segment += " (weight $weight)"
        }
        $segments.Add($segment)

        $start = $age
        $end = $age
        $weight = $currentWeight
    }

    if ($start -eq $end) {
        $segment = [string]$start
    } else {
        $segment = "$start-$end"
    }
    if ($weight -ne 1) {
        $segment += " (weight $weight)"
    }
    $segments.Add($segment)

    return ($segments -join ', ')
}

function Sort-RecordsById {
    param($Records)

    return @(
        $Records | Sort-Object {
            if ($_.Contains('id') -and $_.id -match '^\d+$') {
                [int]$_.id
            } else {
                [int]::MaxValue
            }
        }, {
            if ($_.Contains('id')) { [string]$_.id } else { '' }
        }
    )
}

function Append-Line {
    param(
        [System.Text.StringBuilder]$Builder,
        [string]$Text = ''
    )

    [void]$Builder.AppendLine($Text)
}

$dataRoot = Join-Path $ProjectRoot 'data\zh-cn'
$talents = Convert-SheetToRecords -Path (Join-Path $dataRoot 'talents.xlsx')
$events = Convert-SheetToRecords -Path (Join-Path $dataRoot 'events.xlsx')
$achievements = Convert-SheetToRecords -Path (Join-Path $dataRoot 'achievement.xlsx')
$ages = Convert-SheetToRecords -Path (Join-Path $dataRoot 'age.xlsx')

$eventAgeMap = @{}
$talentAgeMap = @{}

foreach ($row in $ages) {
    if (-not $row.Contains('age')) { continue }
    $age = [int]$row.age

    foreach ($eventEntry in (Get-List $row.event)) {
        if ([string]::IsNullOrWhiteSpace($eventEntry)) { continue }
        $parts = [string]$eventEntry -split '\*', 2
        $eventId = $parts[0]
        $weight = if ($parts.Count -gt 1 -and $parts[1] -ne '') { [double]$parts[1] } else { 1 }
        if (-not $eventAgeMap.ContainsKey($eventId)) {
            $eventAgeMap[$eventId] = @{}
        }
        $ageKey = [string]$age
        if (-not $eventAgeMap[$eventId].ContainsKey($ageKey)) {
            $eventAgeMap[$eventId][$ageKey] = 0
        }
        $eventAgeMap[$eventId][$ageKey] = [double]$eventAgeMap[$eventId][$ageKey] + $weight
    }

    foreach ($talentEntry in (Get-List $row.talent)) {
        if ([string]::IsNullOrWhiteSpace($talentEntry)) { continue }
        $talentId = [string]$talentEntry
        if (-not $talentAgeMap.ContainsKey($talentId)) {
            $talentAgeMap[$talentId] = New-Object System.Collections.ArrayList
        }
        [void]$talentAgeMap[$talentId].Add($age)
    }
}

$eventBranchSources = @{}
foreach ($event in $events) {
    foreach ($branch in (Get-List $event.branch)) {
        if ([string]::IsNullOrWhiteSpace($branch)) { continue }
        $parts = [string]$branch -split ':', 2
        if ($parts.Count -ne 2) { continue }
        $condition = $parts[0]
        $nextId = $parts[1]
        if (-not $eventBranchSources.ContainsKey($nextId)) {
            $eventBranchSources[$nextId] = New-Object System.Collections.ArrayList
        }
        [void]$eventBranchSources[$nextId].Add("from event $($event.id): $condition")
    }
}

$builder = New-Object System.Text.StringBuilder

Append-Line $builder '# Content Reference'
Append-Line $builder ''
Append-Line $builder '> Generated from `data/zh-cn/*.xlsx`. This document lists all talents, events, event age pools, and achievement conditions.'
Append-Line $builder ''
Append-Line $builder '## 1. Overview'
Append-Line $builder ''
Append-Line $builder "- Total talents: $($talents.Count)"
Append-Line $builder "- Total events: $($events.Count)"
Append-Line $builder "- Total achievements: $($achievements.Count)"
Append-Line $builder "- Age rows: $($ages.Count)"
Append-Line $builder ''

Append-Line $builder '## 2. Talents'
Append-Line $builder ''
foreach ($talent in (Sort-RecordsById $talents)) {
    $effectText = if ($talent.Contains('effect')) { Format-EffectMap $talent.effect } else { 'None' }
    $replacementText = 'None'
    if ($talent.Contains('replacement')) {
        $replacementParts = New-Object System.Collections.Generic.List[string]
        if ($talent.replacement.Contains('grade')) {
            $replacementParts.Add("replacement by grade: $(Format-Array $talent.replacement.grade)")
        }
        if ($talent.replacement.Contains('talent')) {
            $replacementParts.Add("replacement by talent: $(Format-Array $talent.replacement.talent)")
        }
        if ($replacementParts.Count -gt 0) {
            $replacementText = $replacementParts -join '; '
        }
    }

    $agesText = if ($talentAgeMap.ContainsKey([string]$talent.id)) {
        Format-AgeRanges @($talentAgeMap[[string]$talent.id])
    } else {
        'None'
    }

    Append-Line $builder "### Talent $($talent.id) - $($talent.name)"
    Append-Line $builder ''
    Append-Line $builder "- Grade: $($talent.grade)"
    Append-Line $builder "- Description: $($talent.description)"
    Append-Line $builder "- Trigger ages: $agesText"
    Append-Line $builder "- Trigger condition: $(if ($talent.condition) { $talent.condition } else { 'None' })"
    Append-Line $builder "- Effect: $effectText"
    Append-Line $builder "- Extra initial points: $(if ($talent.status) { $talent.status } else { '0' })"
    Append-Line $builder "- Exclusive: $(Format-Bool $talent.exclusive)"
    Append-Line $builder "- Excluded talents: $(if ($talent.Contains('exclude')) { Format-Array $talent.exclude } else { 'None' })"
    Append-Line $builder "- Replacement rule: $replacementText"
    Append-Line $builder ''
}

Append-Line $builder '## 3. Events'
Append-Line $builder ''
foreach ($event in (Sort-RecordsById $events)) {
    $effectText = if ($event.Contains('effect')) { Format-EffectMap $event.effect } else { 'None' }
    $agePoolText = if ($eventAgeMap.ContainsKey([string]$event.id)) {
        Format-AgeWeightRanges $eventAgeMap[[string]$event.id]
    } else {
        'None'
    }
    $branchSourceText = if ($eventBranchSources.ContainsKey([string]$event.id)) {
        Format-Array $eventBranchSources[[string]$event.id]
    } else {
        'None'
    }
    $branchText = if ($event.Contains('branch')) { Format-Array $event.branch } else { 'None' }

    Append-Line $builder "### Event $($event.id)"
    Append-Line $builder ''
    Append-Line $builder "- Grade: $(if ($event.grade) { $event.grade } else { '0 / unmarked' })"
    Append-Line $builder "- Content: $($event.event)"
    Append-Line $builder "- Post content: $(if ($event.postEvent) { $event.postEvent } else { 'None' })"
    Append-Line $builder "- Age pool: $agePoolText"
    Append-Line $builder "- Randomly available: $(if ($event.NoRandom) { 'No (NoRandom)' } else { 'Yes' })"
    Append-Line $builder "- Include condition: $(if ($event.include) { $event.include } else { 'None' })"
    Append-Line $builder "- Exclude condition: $(if ($event.exclude) { $event.exclude } else { 'None' })"
    Append-Line $builder "- Branches: $branchText"
    Append-Line $builder "- Triggered by branches: $branchSourceText"
    Append-Line $builder "- Effect: $effectText"
    Append-Line $builder ''
}

Append-Line $builder '## 4. Achievements'
Append-Line $builder ''
foreach ($achievement in (Sort-RecordsById $achievements)) {
    Append-Line $builder "### Achievement $($achievement.id) - $($achievement.name)"
    Append-Line $builder ''
    Append-Line $builder "- Grade: $($achievement.grade)"
    Append-Line $builder "- Description: $($achievement.description)"
    Append-Line $builder "- Unlock timing: $(Format-Opportunity $achievement.opportunity)"
    Append-Line $builder "- Unlock condition: $(if ($achievement.condition) { $achievement.condition } else { 'None' })"
    Append-Line $builder "- Hidden: $(Format-Bool $achievement.hide)"
    Append-Line $builder ''
}

[System.IO.File]::WriteAllText($Output, $builder.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated: $Output"

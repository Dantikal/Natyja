param([string]$SourcePath,[string]$OutputPath)
$ErrorActionPreference='Stop'
$app=$null;$doc=$null
try {
 $ext=[IO.Path]::GetExtension($SourcePath).ToLower()
 if($ext -in @('.xls','.xlsx','.ods','.csv')){
  $app=New-Object -ComObject Excel.Application;$app.Visible=$false;$app.DisplayAlerts=$false;$app.AutomationSecurity=3;$app.AskToUpdateLinks=$false
  $doc=$app.Workbooks.Open($SourcePath,0,$true);$doc.ExportAsFixedFormat(0,$OutputPath)
 } elseif($ext -in @('.ppt','.pptx','.odp')){
  $app=New-Object -ComObject PowerPoint.Application;$app.AutomationSecurity=3
  $doc=$app.Presentations.Open($SourcePath,$true,$false,$false);$doc.SaveAs($OutputPath,32)
 } else {
  $app=New-Object -ComObject Word.Application;$app.Visible=$false;$app.DisplayAlerts=0;$app.AutomationSecurity=3
  $doc=$app.Documents.Open($SourcePath,$false,$true,$false);$doc.ExportAsFixedFormat($OutputPath,17)
 }
} finally {
 if($null -ne $doc){$doc.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($doc)}
 if($null -ne $app){$app.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)}
}

# Git ve GitHub ortam değişkenlerini yükle
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  GitHub Otomatik Senkronizasyon Başlatıldı (Canlı)   " -ForegroundColor Green
Write-Host "  Her dosya değişikliğinde otomatik commit ve push yapılır." -ForegroundColor Yellow
Write-Host "  Durdurmak için: Ctrl + C" -ForegroundColor Gray
Write-Host "=====================================================" -ForegroundColor Cyan

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

while ($true) {
    Start-Sleep -Seconds 10
    
    # Değişiklik kontrolü
    $status = git status --porcelain 2>$null
    
    if ($status) {
        $dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$dateStr] Değişiklik tespit edildi, GitHub'a aktarılıyor..." -ForegroundColor Yellow
        
        git add .
        git commit -m "Otomatik güncelleme: $dateStr"
        git push origin main
        
        Write-Host "[$dateStr] Başarıyla GitHub'a yüklendi (push tamamlandı)!" -ForegroundColor Green
    }
}

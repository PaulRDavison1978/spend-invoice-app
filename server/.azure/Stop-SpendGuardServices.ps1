# Stop-SpendGuardServices.ps1
# Azure Automation runbook to stop SpendGuard services (00:00 - 06:00 UTC)

$resourceGroup = "spendguard"
$webAppName = "spendguard-invoice-api"
$pgServerName = "spendguard-pgdb"

try {
    # Authenticate using managed identity
    Connect-AzAccount -Identity | Out-Null
    Write-Output "Authenticated with managed identity."

    # Stop the Web App
    Write-Output "Stopping Web App: $webAppName..."
    Stop-AzWebApp -ResourceGroupName $resourceGroup -Name $webAppName
    Write-Output "Web App stopped."

    # Stop the PostgreSQL Flexible Server
    Write-Output "Stopping PostgreSQL: $pgServerName..."
    Stop-AzPostgreSqlFlexibleServer -ResourceGroupName $resourceGroup -Name $pgServerName -NoWait
    Write-Output "PostgreSQL stop initiated."

    Write-Output "All services stopped successfully."
} catch {
    Write-Error "Failed to stop services: $_"
    throw
}

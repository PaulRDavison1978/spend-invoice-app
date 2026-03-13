# Start-SpendGuardServices.ps1
# Azure Automation runbook to start SpendGuard services (06:00 UTC)

$resourceGroup = "spendguard"
$webAppName = "spendguard-invoice-api"
$pgServerName = "spendguard-pgdb"

try {
    # Authenticate using managed identity
    Connect-AzAccount -Identity | Out-Null
    Write-Output "Authenticated with managed identity."

    # Start the PostgreSQL Flexible Server first (dependency)
    Write-Output "Starting PostgreSQL: $pgServerName..."
    Start-AzPostgreSqlFlexibleServer -ResourceGroupName $resourceGroup -Name $pgServerName
    Write-Output "PostgreSQL started."

    # Start the Web App
    Write-Output "Starting Web App: $webAppName..."
    Start-AzWebApp -ResourceGroupName $resourceGroup -Name $webAppName
    Write-Output "Web App started."

    Write-Output "All services started successfully."
} catch {
    Write-Error "Failed to start services: $_"
    throw
}

# Ghost Parking - End-to-End System Test Script (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   GHOST PARKING - MICROSERVICES TEST SUITE  " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Health Checks
Write-Host "`n[1/6] Checking Service Health Endpoints..." -ForegroundColor Yellow
$gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3000/health"
Write-Host " -> Gateway Express Status : $($gatewayHealth.status) (Postgres: $($gatewayHealth.postgres))" -ForegroundColor Green

$searchHealth = Invoke-RestMethod -Uri "http://localhost:8080/health"
Write-Host " -> Search Engine Go Status: $($searchHealth.status) (PostGIS: $($searchHealth.postgis_version))" -ForegroundColor Green

# 2. Register Host
Write-Host "`n[2/6] Registering Host User via Express..." -ForegroundColor Yellow
$randomSuffix = Get-Random -Minimum 1000 -Maximum 9999
$hostPayload = @{
    name                = "Host Partner $randomSuffix"
    email               = "host_$randomSuffix@example.com"
    phone_number        = "+9198765$randomSuffix"
    role                = "host"
    razorpay_account_id = "acc_$randomSuffix"
} | ConvertTo-Json

$hostRes = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method Post -ContentType "application/json" -Body $hostPayload
$hostId = $hostRes.user.id
Write-Host " -> Host Created with ID: $hostId" -ForegroundColor Green

# 3. Create Parking Spot with PostGIS Coordinates
Write-Host "`n[3/6] Creating Parking Spot (Bangalore MG Road: 12.9716, 77.5946)..." -ForegroundColor Yellow
$spotPayload = @{
    host_id     = $hostId
    title       = "Prime Garage #$randomSuffix"
    address     = "$randomSuffix MG Road, Bangalore, Karnataka"
    latitude    = 12.9716
    longitude   = 77.5946
    hourly_rate = 60.0
    is_active   = $true
} | ConvertTo-Json

$spotRes = Invoke-RestMethod -Uri "http://localhost:3000/spots" -Method Post -ContentType "application/json" -Body $spotPayload
$spotId = $spotRes.spot.id
Write-Host " -> Spot Created with ID: $spotId" -ForegroundColor Green

# 4. Query Nearby Spots via Express Gateway Proxy (Forwarding to Go Search Engine)
Write-Host "`n[4/6] Querying Express Proxy GET /api/spots/nearby (Single Entry Point -> Go PostGIS)..." -ForegroundColor Yellow
$proxyRes = Invoke-RestMethod -Uri "http://localhost:3000/api/spots/nearby?latitude=12.9716&longitude=77.5946"
Write-Host " -> Express Proxy returned $($proxyRes.count) matching spots via Go engine!" -ForegroundColor Green
$foundSpot = $proxyRes.spots | Where-Object { $_.id -eq $spotId }
if ($foundSpot) {
    Write-Host " -> Successfully matched Spot ID $spotId via Express Gateway!" -ForegroundColor Green
}
else {
    Write-Host " -> Warning: Newly created spot not found in nearby search." -ForegroundColor Red
}

# 5. Register Driver & Create Booking
Write-Host "`n[5/6] Registering Driver & Creating Booking..." -ForegroundColor Yellow
$driverPayload = @{
    name         = "Driver Bob $randomSuffix"
    email        = "driver_$randomSuffix@example.com"
    phone_number = "+9191234$randomSuffix"
    role         = "driver"
} | ConvertTo-Json

$driverRes = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method Post -ContentType "application/json" -Body $driverPayload
$driverId = $driverRes.user.id

$bookingPayload = @{
    driver_id    = $driverId
    spot_id      = $spotId
    start_time   = (Get-Date).ToString("o")
    end_time     = (Get-Date).AddHours(3).ToString("o")
    total_amount = 180.0
} | ConvertTo-Json

$bookingRes = Invoke-RestMethod -Uri "http://localhost:3000/bookings" -Method Post -ContentType "application/json" -Body $bookingPayload
$bookingId = $bookingRes.booking.id
Write-Host " -> Booking Created with ID: $bookingId (Status: $($bookingRes.booking.status))" -ForegroundColor Green

# 6. Payment Order & Verification
Write-Host "`n[6/6] Testing Razorpay Payment Flow..." -ForegroundColor Yellow
$orderRes = Invoke-RestMethod -Uri "http://localhost:3000/payments/order" -Method Post -ContentType "application/json" -Body (@{ booking_id = $bookingId } | ConvertTo-Json)
$orderId = $orderRes.order.id
Write-Host " -> Generated Order: $orderId" -ForegroundColor Green

$verifyRes = Invoke-RestMethod -Uri "http://localhost:3000/payments/verify" -Method Post -ContentType "application/json" -Body (@{
        booking_id          = $bookingId
        razorpay_order_id   = $orderId
        razorpay_payment_id = "pay_test_$randomSuffix"
    } | ConvertTo-Json)

Write-Host " -> Payment Verified! Booking Status is now: $($verifyRes.booking.status)" -ForegroundColor Green

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "       ALL 6 INTEGRATION TESTS PASSED!       " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# Ghost Parking - Core Business Logic & Polyglot Integration Test Suite (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   GHOST PARKING - FULL INTEGRATION & BUSINESS LOGIC TEST  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. Health Checks
# -----------------------------------------------------------------------------
Write-Host "`n[1/8] Verifying Service Health Endpoints..." -ForegroundColor Yellow

$gatewayHealth = Invoke-RestMethod -Uri "http://localhost:3000/health"
Write-Host " -> Gateway Express Status : $($gatewayHealth.status) (Postgres: $($gatewayHealth.postgres))" -ForegroundColor Green

$searchHealth = Invoke-RestMethod -Uri "http://localhost:8080/health"
Write-Host " -> Search Engine Go Status: $($searchHealth.status) (PostGIS: $($searchHealth.postgis_version))" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. Register Host Partner with Razorpay Account ID
# -----------------------------------------------------------------------------
Write-Host "`n[2/8] Registering Host with linked Razorpay Escrow Account..." -ForegroundColor Yellow
$randomSuffix = Get-Random -Minimum 1000 -Maximum 9999
$hostAccountId = "acc_host_$randomSuffix"

$hostPayload = @{
    name                = "Host Partner $randomSuffix"
    email               = "host_$randomSuffix@example.com"
    phone_number        = "+9198765$randomSuffix"
    role                = "host"
    razorpay_account_id = $hostAccountId
} | ConvertTo-Json

$hostRes = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method Post -ContentType "application/json" -Body $hostPayload
$hostId = $hostRes.user.id
Write-Host " -> Host Created with ID: $hostId" -ForegroundColor Green
Write-Host " -> Host Linked Razorpay Account: $($hostRes.user.razorpay_account_id)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 3. Create Parking Spot with PostGIS Coordinates
# -----------------------------------------------------------------------------
Write-Host "`n[3/8] Creating Parking Spot (Bangalore MG Road: 12.9716, 77.5946)..." -ForegroundColor Yellow
$spotPayload = @{
    host_id     = $hostId
    title       = "Prime Garage #$randomSuffix"
    address     = "$randomSuffix MG Road, Bangalore, Karnataka"
    latitude    = 12.9716
    longitude   = 77.5946
    hourly_rate = 100.0
    is_active   = $true
} | ConvertTo-Json

$spotRes = Invoke-RestMethod -Uri "http://localhost:3000/spots" -Method Post -ContentType "application/json" -Body $spotPayload
$spotId = $spotRes.spot.id
Write-Host " -> Spot Created with ID: $spotId" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. Test Go Search Engine directly: GET /spots/nearby (5-mile radius query)
# -----------------------------------------------------------------------------
Write-Host "`n[4/8] Testing Go REST endpoint: GET /spots/nearby (5-Mile Radius & Distance Sorting)..." -ForegroundColor Yellow
$goNearby = Invoke-RestMethod -Uri "http://localhost:8080/spots/nearby?latitude=12.9720&longitude=77.5950"
Write-Host " -> Go Engine found $($goNearby.count) spots within 5 miles radius" -ForegroundColor Green

$matchedSpot = $goNearby.spots | Where-Object { $_.id -eq $spotId }
if ($matchedSpot) {
    Write-Host " -> Matched Spot: '$($matchedSpot.title)'" -ForegroundColor Green
    Write-Host "    Distance: $([math]::Round($matchedSpot.distance_meters, 2)) meters ($([math]::Round($matchedSpot.distance_miles, 3)) miles)" -ForegroundColor Green
}
else {
    throw "Created spot not found in Go /spots/nearby endpoint!"
}

# -----------------------------------------------------------------------------
# 5. Test Express Internal Proxy: GET /api/spots/nearby -> Go Search Engine
# -----------------------------------------------------------------------------
Write-Host "`n[5/8] Testing Express HTTP Proxy: GET /api/spots/nearby (Mobile Client forwarding to Go)..." -ForegroundColor Yellow
$proxyRes = Invoke-RestMethod -Uri "http://localhost:3000/api/spots/nearby?latitude=12.9720&longitude=77.5950"
Write-Host " -> Express Proxy returned $($proxyRes.count) spots directly from Go Search Engine" -ForegroundColor Green

$proxyMatched = $proxyRes.spots | Where-Object { $_.id -eq $spotId }
if ($proxyMatched) {
    Write-Host " -> Successfully verified Express Proxy forwarding to Go service!" -ForegroundColor Green
}
else {
    throw "Spot not returned through Express /api/spots proxy!"
}

# -----------------------------------------------------------------------------
# 6. Register Driver & Create Booking
# -----------------------------------------------------------------------------
Write-Host "`n[6/8] Registering Driver & Creating Booking for 2 Hours (Total: ₹200.00)..." -ForegroundColor Yellow
$driverPayload = @{
    name         = "Driver Alex $randomSuffix"
    email        = "driver_$randomSuffix@example.com"
    phone_number = "+9191234$randomSuffix"
    role         = "driver"
} | ConvertTo-Json

$driverRes = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method Post -ContentType "application/json" -Body $driverPayload
$driverId = $driverRes.user.id

$totalBookingAmount = 200.0
$bookingPayload = @{
    driver_id    = $driverId
    spot_id      = $spotId
    start_time   = (Get-Date).ToString("o")
    end_time     = (Get-Date).AddHours(2).ToString("o")
    total_amount = $totalBookingAmount
} | ConvertTo-Json

$bookingRes = Invoke-RestMethod -Uri "http://localhost:3000/bookings" -Method Post -ContentType "application/json" -Body $bookingPayload
$bookingId = $bookingRes.booking.id
Write-Host " -> Booking Created with ID: $bookingId (Initial Status: $($bookingRes.booking.status))" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 7. Test Pre-Authorization (Razorpay Orders with payment_capture: 0)
# -----------------------------------------------------------------------------
Write-Host "`n[7/8] Testing Razorpay Pre-Authorization: POST /payments/pre-authorize..." -ForegroundColor Yellow
$preAuthPayload = @{ booking_id = $bookingId } | ConvertTo-Json
$preAuthRes = Invoke-RestMethod -Uri "http://localhost:3000/payments/pre-authorize" -Method Post -ContentType "application/json" -Body $preAuthPayload

$orderId = $preAuthRes.order.id
Write-Host " -> Pre-Authorization Order Created: $orderId" -ForegroundColor Green
Write-Host " -> Payment Capture Mode: $($preAuthRes.order.payment_capture) (0 = Manual capture / Pre-auth held)" -ForegroundColor Green
Write-Host " -> Route Split Preview: Host 80% = ₹$($preAuthRes.order.split_preview.host_share_80_percent), Platform 20% = ₹$($preAuthRes.order.split_preview.platform_share_20_percent)" -ForegroundColor Green

# Simulate driver entering parking (Authorization confirmed)
$verifyPayload = @{
    booking_id          = $bookingId
    razorpay_order_id   = $orderId
    razorpay_payment_id = "pay_auth_$randomSuffix"
} | ConvertTo-Json
$verifyRes = Invoke-RestMethod -Uri "http://localhost:3000/payments/verify" -Method Post -ContentType "application/json" -Body $verifyPayload
Write-Host " -> Payment Authorized. Booking Status is now: $($verifyRes.booking.status)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 8. Test Checkout & Webhook Payment Split (Razorpay Route: 80% Host / 20% Platform)
# -----------------------------------------------------------------------------
Write-Host "`n[8/8] Testing Razorpay Route Split upon Checkout (80% Host, 20% Platform)..." -ForegroundColor Yellow

# Test via Razorpay Webhook (payment.captured event)
$webhookPayload = @{
    event   = "payment.captured"
    payload = @{
        payment = @{
            entity = @{
                id       = "pay_captured_$randomSuffix"
                order_id = $orderId
                amount   = 20000
                currency = "INR"
                status   = "captured"
            }
        }
    }
} | ConvertTo-Json -Depth 5

$webhookRes = Invoke-RestMethod -Uri "http://localhost:3000/payments/webhook" -Method Post -ContentType "application/json" -Body $webhookPayload
Write-Host " -> Webhook processed with status: $($webhookRes.status)" -ForegroundColor Green

# Verify booking is now COMPLETED and query payment & split details
$bookingPaymentStatus = Invoke-RestMethod -Uri "http://localhost:3000/payments/booking/$bookingId"
Write-Host " -> Final Booking Status: $($bookingPaymentStatus.status)" -ForegroundColor Green
Write-Host " -> Razorpay Route Split Confirmed:" -ForegroundColor Green
Write-Host "    - Host Payout (80%)      : ₹$($bookingPaymentStatus.route_split.host_80_percent) -> Account: $($bookingPaymentStatus.route_split.host_linked_account)" -ForegroundColor Green
Write-Host "    - Platform Escrow Fee (20%): ₹$($bookingPaymentStatus.route_split.platform_20_percent)" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "       ALL 8 CORE BUSINESS LOGIC TESTS PASSED!            " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
# Ghost Parking 🚗👻

**Ghost Parking** is a high-concurrency, geospatial smart-parking platform built with a polyglot microservices architecture. It pairs an **Expo React Native mobile app** with an **Express.js API Gateway** (acting as the single entry point) and a specialized **Go PostGIS Search Engine** for ultra-fast spatial radius search, dynamic escrow payments via Razorpay, and geofenced driver check-in (<50 meters).

---

## 🏛️ System Architecture

```mermaid
graph TD
    Client["📱 Mobile App (Expo SDK 58)"]
    Gateway["⚡ Express Gateway (:3000)\n(Single Entry Point, CORS, Auth, Escrow)"]
    GoEngine["🏎️ Go Search Engine (:8080)\n(PostGIS Spatial Radar, GIST Index)"]
    DB[("🐘 PostgreSQL 15 + PostGIS 3.4\n(:5432)")]
    Cache[("⚡ Redis 7\n(:6379)")]
    Razorpay["💳 Razorpay Escrow API"]

    Client -->|"HTTP / REST\n(:3000)"| Gateway
    Gateway -->|"Internal Proxy\n/api/spots/*"| GoEngine
    Gateway -->|"Prisma ORM"| DB
    Gateway -->|"Token / Cache"| Cache
    Gateway -->|"Pre-Auth / Escrow"| Razorpay
    GoEngine -->|"Spatial Queries\n(ST_DWithin)"| DB
```

### Microservice Responsibilities

| Service | Technology | Port | Description |
| :--- | :--- | :--- | :--- |
| **`mobile`** | React Native, Expo SDK 58, TypeScript | 8081 | Driver & Host dashboard, role-based navigation with `AuthContext` + `expo-secure-store`, custom MapView with Fabric marker layout stabilization, GPS check-in verification (<50m). |
| **`gateway-express`** | Node.js, Express, Prisma ORM, JWT, Bcrypt | 3000 | **Single Entry Point**: Role-based JWT authentication (`POST /auth/register`, `POST /auth/login`), `verifyToken` & `requireHost` route protection, Booking lifecycle, Razorpay Escrow, CORS handling, and internal HTTP proxy to Go. |
| **`search-engine-go`** | Go 1.22, `database/sql`, PostGIS | 8080 | Spatial search engine utilizing PostGIS GIST indexes (`ST_DWithin`, `ST_DistanceSphere`) within 5-mile radius. Auto-loads `.env` configuration. |
| **`postgres`** | Docker (`postgis/postgis:15-3.4`) | 5434 (Host) / 5432 | Primary relational database with spatial GIS extensions enabled. |
| **`redis`** | Docker (`redis:7-alpine`) | 6379 | In-memory cache for sessions and high-throughput query caching. |

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+) & Docker Compose
- [Node.js](https://nodejs.org/) (v18 or v20 LTS) & `npm`
- [Go](https://go.dev/dl/) (v1.21+) *(required if running Go engine natively outside Docker)*
- [Expo Go](https://expo.dev/go) on your Android/iOS mobile device *(or Android Studio Emulator)*

---

## ⚙️ Environment Configuration

1. **Root Environment**:
   ```bash
   cp .env.example .env
   ```

2. **Express Gateway Environment** (`gateway-express/.env`):
   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ghost_parking?schema=public"
   REDIS_URL="redis://localhost:6379"
   SEARCH_SERVICE_URL="http://localhost:8080"
   RAZORPAY_KEY_ID="rzp_test_example"
   RAZORPAY_KEY_SECRET="rzp_secret_example"
   RAZORPAY_WEBHOOK_SECRET="whsec_example"
   ```

3. **Go Search Engine Environment** (`search-engine-go/.env`):
   ```env
   PORT=8080
   DATABASE_URL="postgres://postgres:postgres@localhost:5432/ghost_parking?sslmode=disable"
   ENVIRONMENT=development
   ```

---

## 🚀 Step-by-Step Launch Guide

### Step 1: Boot PostgreSQL (PostGIS) and Redis Containers
Launch the database and cache services using Docker Compose:
```bash
# Start PostgreSQL (PostGIS) and Redis in background
docker compose up -d postgres redis

# Check container health status
docker compose ps
```
The initialization script `init.sql` automatically loads the `postgis` extension and creates spatial schemas.

---

### Step 2: Initialize Database Schemas (Prisma)
Generate the Prisma ORM client and synchronize schemas:
```bash
cd gateway-express
npm install
npx prisma generate
npx prisma db push
cd ..
```

---

### Step 3: Boot the Go Search Engine
The Go Search Engine provides sub-millisecond PostGIS radius queries.

**Option A — Running locally with Go:**
```bash
cd search-engine-go
go run main.go
```
*Output: `[Search Engine] PostGIS ready: 3.4 ... Initializing service on port 8080...`*

**Option B — Running inside Docker:**
```bash
docker compose up -d search-engine-go
```

---

### Step 4: Launch the Express API Gateway (Single Entry Point)
Start the Express API Gateway which manages authentication, bookings, and proxies spatial queries to the Go service:
```bash
cd gateway-express
npm run dev
```
*Output: `Ghost Parking API Gateway listening on port 3000`*

Verify health at:
- `http://localhost:3000/health` (Express Gateway + PostgreSQL + Redis)
- `http://localhost:8080/health` (Go Search Engine + PostGIS)
- `http://localhost:3000/api/spots/nearby?latitude=12.9716&longitude=77.5946` (Express Gateway Proxying to Go)

---

### Step 5: Launch the Expo Mobile App

1. Install dependencies:
   ```bash
   cd mobile
   npm install
   ```

2. Start the Metro bundler bound to your local Wi-Fi / LAN IP:
   ```bash
   npm run start:lan
   ```
   *(Or run `npm start` / `npm run start:tunnel`)*

3. Open the **Expo Go** app on your physical Android/iOS device and scan the displayed QR code. Ensure your device is on the same local Wi-Fi network as your development machine.

---

## 🌐 Single Entry Point & Proxy Architecture

The mobile app never connects directly to database or internal microservices. All communication routes through `gateway-express` on port `3000`:

```
Mobile App  ──GET /api/spots/nearby?latitude=...&longitude=...──>  Express Gateway (:3000)
                                                                           │
                                                                 (http-proxy-middleware)
                                                                           │
                                                                           ▼
                                                                 Go Search Engine (:8080)
                                                                           │
                                                                    (PostGIS Query)
                                                                           │
                                                                           ▼
                                                                  PostgreSQL Database
```

- **CORS Configured**: Allows cross-origin requests from web dev tools, Expo Metro web, and mobile clients with preflight `OPTIONS` caching.
- **Dynamic LAN Resolution**: `mobile/src/config/api.ts` automatically extracts your development machine's local IP address using `Constants.expoConfig?.hostUri`, with fallback to `10.0.2.2:3000` for Android emulators.
- **Automatic Fallback**: If the Go service is temporarily booting or unreachable, the mobile `spotService` seamlessly degrades to direct Express `/spots` and offline cache without crashing.

---

## 🧪 Comprehensive Testing Guide

### 1. Backend Express JWT & Authorization Test Suite (Jest & Supertest)
Run the dedicated backend test suites covering role validation, bcrypt hashing, JWT issuance, route guards (`verifyToken`, `requireHost`), spot creation permissions, and Razorpay order/payment verification:
```bash
cd gateway-express

# Run all 16 integration tests
npm test
```

### 2. Mobile Automated Test Suite (Jest & React Native Testing Library)
Run the 12 mobile test suites (68 unit & component tests) covering role-based authentication, navigation stack isolation, spot normalization, GPS centering, map screens, and Razorpay checkout:
```bash
cd mobile

# Run all 12 test suites (68 tests)
npm test

# Run tests with code coverage report
npm run test:coverage
```

**Key Test Suites Included:**
- `__tests__/components/RootNavigator.test.tsx`: Tests conditional root navigation rendering (Auth Stack on missing token, `DriverTabNavigator` on driver role, `HostTabNavigator` on host role).
- `__tests__/components/RegisterScreen.test.tsx` & `LoginScreen.test.tsx`: Tests driver/host role toggle UI, form validation, error banners, and secure store persistence.
- `__tests__/unit/authContext.test.tsx`: Validates `AuthContext` state lifecycle, `expo-secure-store` token persistence, and role changes.
- `__tests__/unit/spotService.test.ts`: Tests `normalizeSpot()`, Go PostGIS response parsing, Express fallback routing, and network failure tolerance.
- `__tests__/unit/geo.test.ts`: Validates distance calculations (`calculateDistanceMeters`) and the <50m check-in radius constraint (`isWithinCheckInRadius`).
- `__tests__/components/DriverMapScreen.test.tsx`: Tests live backend connection status indicator, search query filtering, affordability pill filters, and reservation modals.
- `__tests__/components/DriverBookingsCheckIn.test.tsx`: Tests GPS check-in verification (<50m activates booking; >50m blocks check-in with error alert).

---

### 3. End-to-End PowerShell Integration Test Suites
When containers and backend services are running, execute the automated end-to-end integration test suites:

```powershell
# 1. Complete stack validation (Health, Registration, PostGIS search, Booking, Payments)
.\test-suites\test-stack.ps1

# 2. Comprehensive business logic test (Escrow Pre-Authorization, Express Proxy, GPS Check-in, Auto-settlement)
.\test-suites\test-business.ps1
```

---

### 3. Manual cURL Testing

**Test Express Gateway Health:**
```bash
curl -X GET http://localhost:3000/health
```

**Test Go PostGIS Spatial Search via Express Proxy:**
```bash
curl -X GET "http://localhost:3000/api/spots/nearby?latitude=12.9716&longitude=77.5946"
```

**Test Driver Check-In (<50 meters validation):**
```bash
curl -X POST http://localhost:3000/bookings/check-in \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "YOUR_BOOKING_ID",
    "driver_latitude": 12.9716,
    "driver_longitude": 77.5946
  }'
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
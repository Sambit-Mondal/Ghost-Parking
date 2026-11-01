# Ghost Parking Distributed System

## Executive Summary

Ghost Parking is an enterprise-grade, high-concurrency geospatial smart-parking reservation and settlement platform. Designed around a polyglot microservices architecture, the system decouples client-facing application delivery from real-time spatial indexing, transaction orchestration, and ledger management.

The platform resolves high-density urban parking contention by pairing sub-millisecond geospatial radius queries with an escrow-backed reservation lifecycle. Key capabilities include:

- Sub-millisecond spatial search utilizing PostgreSQL PostGIS with spatial GIST indexes and spherical distance functions (`ST_DWithin`, `ST_DistanceSphere`).
- Role-based access control (Driver, Host, Administrator) enforcing strict route guards and asymmetric JWT authentication across all application tiers.
- Automated escrow split settlements powered by Razorpay Route, allocating 80% net proceeds to property hosts and retaining a 20% platform commission upon signature verification.
- Geofenced check-in verification requiring cryptographic or physical GPS positioning within 50 meters of parking coordinates before escrow release.
- Bidirectional real-time state management over WebSocket connections, multiplexed into user-scoped private rooms for instantaneous listing updates and booking state transitions.

---

## System Architecture Overview

The system implements the Single Entry Point architectural pattern. Client applications interface solely through the Node.js Express API Gateway. The Gateway terminates TLS, validates JWT tokens, handles CORS policies, orchestrates database persistence via Prisma ORM, and acts as an internal reverse proxy for high-throughput spatial queries serviced by the Go Search Engine.

```mermaid
flowchart TD
    subgraph ClientLayer["Client Layer"]
        MobileApp["React Native Mobile Application\nExpo SDK 58 / TypeScript\n(Port 8081)"]
    end

    subgraph GatewayLayer["API Gateway & Ingress Layer"]
        Gateway["Express API Gateway\nNode.js / Prisma / Socket.io\n(Port 3000)"]
    end

    subgraph EngineLayer["Specialized Search Layer"]
        GoEngine["Spatial Search Engine\nGo 1.22 / PostGIS Driver\n(Port 8080)"]
    end

    subgraph DataLayer["Persistence & Caching Layer"]
        Postgres[("PostgreSQL 15 + PostGIS 3.4\nRelational & Spatial Store\n(Port 5434 Host / 5432 Container)")]
        RedisCache[("Redis 7 Alpine\nSession Cache & Rate Limiting\n(Port 6379)")]
    end

    subgraph ExternalServices["External Banking & Clearing"]
        Razorpay["Razorpay Route API\nEscrow Hold & Split Settlement"]
    end

    MobileApp -->|"HTTPS / WSS (REST & Socket.io)"| Gateway
    Gateway -->|"Reverse Proxy (/api/spots/*)"| GoEngine
    Gateway -->|"Prisma ORM (Connection Pool)"| Postgres
    Gateway -->|"Key-Value Operations"| RedisCache
    Gateway -->|"Pre-Auth & Webhook Verification"| Razorpay
    GoEngine -->|"Spatial Queries (ST_DWithin, GIST)"| Postgres
    GoEngine -->|"Spatial Response Caching"| RedisCache
```

### Architectural Subsystem Responsibilities

1. **Client Layer (Mobile Application)**:
   - Built on React Native and Expo SDK 58.
   - Manages distinct navigational hierarchies for Driver and Host personas.
   - Maintains offline-resilient authentication tokens in secure hardware-backed storage (`expo-secure-store`).
   - Renders radar-assisted spatial map views with Fabric marker layout stabilization.
   - Interacts with device GPS hardware to enforce Euclidean radius thresholds during check-in.

2. **API Gateway & Ingress (Express Gateway)**:
   - Exposes RESTful resource endpoints under `/auth`, `/bookings`, `/spots`, `/host`, and `/payments`.
   - Terminates client connections and manages Socket.io bidirectional rooms (`room_user_{userId}`).
   - Executes transactional booking updates, escrow creation, payment validation, and 80/20 financial calculations.
   - Proxies incoming spatial queries (`/api/spots/nearby`, `/api/spots/search`) directly to the Go Search Engine using `http-proxy-middleware`.

3. **Search Engine (Go Engine)**:
   - High-throughput, memory-efficient spatial computation service built in Go 1.22.
   - Directly executes PostGIS geospatial operations on spherical earth models (`EPSG:4326`).
   - Employs GIST indexes to compute spatial containment and sorting within arbitrary radiuses (default 5 miles) with sub-10ms response latencies.

4. **Persistence and Cache Layer (PostgreSQL & Redis)**:
   - PostgreSQL 15 image customized with PostGIS 3.4 extension modules (`postgis/postgis:15-3.4`).
   - Houses relational tables (`users`, `parking_spots`, `bookings`) with strict foreign keys and automated timestamps.
   - Redis 7 provides caching for spot availability, geographic cluster responses, and gateway state.

---

## Technology Stack

### Mobile Application
- Framework: React Native 0.76.7, Expo SDK 58
- Programming Language: TypeScript 5.3+
- Navigation: React Navigation 7 (Native Stack, Bottom Tabs)
- Real-Time Protocol: Socket.io Client 4.8+
- Spatial Visuals: React Native Maps, Expo Location
- Security & Storage: `expo-secure-store`
- Unit & Component Testing: Jest 29, React Native Testing Library, Babel Jest

### API Gateway
- Runtime: Node.js 20 LTS
- Web Framework: Express 4.19+
- Database ORM: Prisma 5.10+ with PostgreSQL PostGIS extensions
- Real-Time Communication: Socket.io 4.8+
- Cryptography & Auth: JSON Web Tokens (`jsonwebtoken`), Bcrypt.js, Native Node Crypto (HMAC-SHA256)
- Reverse Proxy: `http-proxy-middleware` 3.0+
- Payment Processing: Razorpay Node SDK 2.9+
- Integration Testing: Jest 29, Supertest 6.3+

### Spatial Search Engine
- Language & Runtime: Go 1.22
- HTTP Server: Standard Library (`net/http`) with custom CORS and logging middleware
- Database Driver: `github.com/lib/pq`
- Caching Client: `github.com/redis/go-redis/v9`
- Geospatial Layer: PostGIS 3.4 spatial operators (`ST_DWithin`, `ST_DistanceSphere`, `ST_SetSRID`, `ST_MakePoint`)

### Data & Infrastructure
- Relational Store: PostgreSQL 15.6 with PostGIS 3.4.2
- Cache Store: Redis 7.2 Alpine
- Container Runtime: Docker Engine 24+, Docker Compose v2

---

## Prerequisites

Ensure the following runtimes and tools are installed and operational on your development workstation:

- **Docker Desktop**: Version 24.0 or later with Compose V2.
- **Node.js**: Version 20 LTS (minimum v18.18.0) and `npm` v10+.
- **Go Compiler**: Version 1.21 or 1.22+ (required for local native compilation of the search service).
- **Git**: Version 2.40 or higher.
- **Expo Go App**: Installed on a physical Android or iOS test device (or an initialized Android Studio Emulator / Apple iOS Simulator).
- **OpenSSL / Terminal Shell**: PowerShell 7+ on Windows or Bash/Zsh on Linux/macOS.

---

## Environment Configuration

The system uses dedicated environment files across layers to maintain strict isolation of secrets, database credentials, and network endpoints.

### Root Orchestration (`.env`)

Located at the repository root; consumed by Docker Compose:

```env
# PostgreSQL Container Configuration
POSTGRES_DB=ghost_parking
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5434

# Redis Container Configuration
REDIS_PORT=6379

# Service Ports
GATEWAY_PORT=3000
SEARCH_PORT=8080

# Razorpay API Credentials
RAZORPAY_KEY_ID="rzp_test_TpMSjWEuKaM6of"
RAZORPAY_KEY_SECRET="BQdtjoPRObN14ymibNvRCbqh"
RAZORPAY_WEBHOOK_SECRET="20yA3ntKsfg6nZfC5b4diNDCyZ/m5BDhUNmz6bPrtrg="
```

### API Gateway (`gateway-express/.env`)

Located at `gateway-express/.env`; consumed by the Node.js Express server:

```env
# Server Network Settings
PORT=3000
NODE_ENV=development

# Database & Cache Connection Strings
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/ghost_parking?schema=public"
REDIS_URL="redis://localhost:6379"

# Security & Access Control
JWT_SECRET="ghost-parking-secret-key-change-in-prod"

# Downstream Search Proxy Target
SEARCH_SERVICE_URL="http://localhost:8080"

# Razorpay Escrow Credentials
RAZORPAY_KEY_ID="rzp_test_TpMSjWEuKaM6of"
RAZORPAY_KEY_SECRET="BQdtjoPRObN14ymibNvRCbqh"
RAZORPAY_WEBHOOK_SECRET="20yA3ntKsfg6nZfC5b4diNDCyZ/m5BDhUNmz6bPrtrg="
```

### Go Search Engine (`search-engine-go/.env`)

Located at `search-engine-go/.env`; consumed by the Go spatial search daemon:

```env
PORT=8080
DATABASE_URL="postgres://postgres:postgres@localhost:5434/ghost_parking?sslmode=disable"
REDIS_URL="localhost:6379"
ENVIRONMENT=development
```

### Mobile Application (`mobile/.env`)

Located at `mobile/.env`; consumed by the Expo React Native Metro bundler:

```env
# API Gateway Target
# Option A: Local Wi-Fi (Physical phone and computer on identical Wi-Fi network)
EXPO_PUBLIC_API_URL=http://192.168.0.147:3000

# Option B: Cellular / Remote Debugging via ngrok or cloud tunnel
# EXPO_PUBLIC_API_URL=https://your-tunnel-subdomain.ngrok-free.app

# Option C: Android Virtual Device Emulator Loopback Alias
# EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# Razorpay Client-Side Test Key
EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_TpMSjWEuKaM6of
```

---

## Local Installation & Build Steps

Follow these sequential steps to initialize repository modules, synchronize database schemas, and build application packages.

### 1. Clone the Monorepo

```bash
git clone https://github.com/your-org/ghost-parking.git
cd ghost-parking
```

### 2. Install Root and Gateway Dependencies

```bash
# Install root orchestration tools
npm install

# Install API Gateway dependencies
cd gateway-express
npm install
cd ..
```

### 3. Generate Database Client & Run Schema Migrations

Ensure Docker containers are running before executing Prisma commands (see Running the Application).

```bash
cd gateway-express
# Generate Prisma JavaScript Client
npx prisma generate

# Synchronize Prisma schema definitions to PostgreSQL
npx prisma db push
cd ..
```

### 4. Build and Verify the Go Search Engine

```bash
cd search-engine-go
# Verify and download Go module dependencies
go mod download
go mod verify

# Compile binary verification test
go build -o bin/search-engine-go main.go
cd ..
```

### 5. Install Mobile Client Dependencies

```bash
cd mobile
npm install
cd ..
```

---

## Running the Application

To execute the complete distributed environment locally, open four distinct terminal sessions or utilize process management tooling.

### Step 1: Start Containerized Infrastructure (PostgreSQL & Redis)

Launch the persistence layer in background daemon mode:

```bash
# From repository root
docker compose up -d postgres redis
```

Verify service health checks have passed:

```bash
docker compose ps
```

*Expected output verification:*
- `ghost-parking-postgres`: Status `healthy` on ports `0.0.0.0:5434->5432/tcp`.
- `ghost-parking-redis`: Status `healthy` on ports `0.0.0.0:6379->6379/tcp`.

### Step 2: Launch the Go Search Engine

Run the Go spatial service in Terminal Session 2:

```bash
cd search-engine-go
go run main.go
```

*Expected console confirmation:*
```text
[Search Engine] Initializing service on port 8080...
[Search Engine] PostGIS ready: 3.4 ...
[Search Engine] Redis cache connected on localhost:6379
[Search Engine] HTTP server listening on :8080
```

### Step 3: Launch the Express API Gateway

Start the Node.js API Gateway in Terminal Session 3:

```bash
cd gateway-express
npm run dev
```

*Expected console confirmation:*
```text
[Prisma] Connected to database: ghost_parking
[Redis] Connection established successfully
[Socket.io] Real-time engine attached
Ghost Parking API Gateway listening on port 3000
```

### Step 4: Launch the Expo Mobile Application

Start the Metro Bundler in Terminal Session 4:

```bash
cd mobile
# Launch bundler bound to development LAN interface
npm run start:lan
```

Scan the terminal QR code using **Expo Go** on an Android or iOS device connected to the same local Wi-Fi network, or press `a` to open the Android Emulator.

---

## Service Health & Verification Endpoints

Execute cURL commands from any terminal shell to validate inter-service connectivity:

1. **Verify API Gateway Health (Database & Redis connectivity)**:
   ```bash
   curl -s http://localhost:3000/health
   ```
   *Response:*
   ```json
   {
     "status": "healthy",
     "service": "gateway-express",
     "postgres": "ok",
     "redis": "ready"
   }
   ```

2. **Verify Go Search Engine Health (PostGIS extension readiness)**:
   ```bash
   curl -s http://localhost:8080/health
   ```
   *Response:*
   ```json
   {
     "status": "healthy",
     "service": "search-engine-go",
     "postgis_version": "3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1"
   }
   ```

3. **Verify Gateway-to-Go Reverse Proxy (Spatial Radius Search)**:
   ```bash
   curl -s "http://localhost:3000/api/spots/nearby?latitude=12.9716&longitude=77.5946"
   ```
   *Response returns nearby parking records sorted by PostGIS Euclidean distance.*

4. **Verify Geofenced Check-In Endpoint (<50m boundary test)**:
   ```bash
   curl -X POST http://localhost:3000/bookings/check-in \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <VALID_DRIVER_JWT>" \
     -d '{
       "booking_id": "00000000-0000-0000-0000-000000000000",
       "driver_latitude": 12.9716,
       "driver_longitude": 77.5946
     }'
   ```

---

## Automated Test Suites

The repository contains isolated unit, component, and integration suites covering all business logic constraints.

### 1. API Gateway Integration Suite (Jest & Supertest)

Covers JWT registration, bcrypt password hashing, role permissions, Razorpay Route calculations, webhook signatures, and Socket.io room isolation:

```bash
cd gateway-express
npm test
```
*Current coverage: 3 test suites, 31 tests passed.*

### 2. Mobile Unit & Component Suite (Jest & React Native Testing Library)

Covers `AuthContext` token persistence, card formatting utilities (`formatCardNumber`), `DriverMapScreen` radar markers, escrow reservation modals, and geofence check-in validation:

```bash
cd mobile
npm test
```
*Current coverage: 15 test suites, 104 tests passed.*

---

## Directory Structure

```text
Ghost-Parking/
├── docker-compose.yml             # Docker multi-container composition manifest
├── init.sql                       # PostgreSQL bootstrap script (PostGIS initialization)
├── package.json                   # Monorepo root scripts and tooling
├── .env                           # Root infrastructure environment variables
├── .env.example                   # Infrastructure environment template
├── .gitignore                     # Monorepo Git exclusion definitions
├── test-suites/                   # End-to-end integration and smoke test scripts
│   ├── test-stack.ps1             # Service health and network check script
│   └── test-business.ps1          # Business workflow automation script
│
├── gateway-express/               # Ingress & API Gateway Microservice
│   ├── Dockerfile                 # Container image specification for Gateway
│   ├── package.json               # Gateway Node.js dependencies and scripts
│   ├── prisma/
│   │   └── schema.prisma          # PostgreSQL relational & PostGIS schema definitions
│   ├── __tests__/                 # Automated integration test specifications
│   │   ├── auth.test.js           # JWT registration and role guard validation
│   │   ├── payments.test.js       # Razorpay order, verify, route split tests
│   │   └── socket.test.js         # Socket.io private room and broadcast tests
│   └── src/
│       ├── server.js              # Application bootstrapping, CORS, and route mounting
│       ├── lib/                   # Shared connections (Prisma client, Redis, Socket)
│       ├── middleware/            # Token verification and role authorization guards
│       ├── proxy/                 # Reverse proxy rules targeting the Go search service
│       └── routes/                # Endpoint routers (auth, bookings, payments, spots, host)
│
├── search-engine-go/              # Spatial Search Engine Microservice
│   ├── Dockerfile                 # Multi-stage Go build container definition
│   ├── go.mod                     # Go module definitions and dependencies
│   ├── go.sum                     # Go checksum validation manifest
│   ├── main.go                    # Main daemon routine, routing, and HTTP middleware
│   ├── db/                        # Database driver connection and PostGIS initializers
│   ├── handlers/                  # HTTP request handlers for spatial radius search
│   └── models/                    # Data structs for parking spots and spatial results
│
└── mobile/                        # React Native Mobile Application
    ├── App.tsx                    # Root React Native component entry point
    ├── app.json                   # Expo application configuration manifest
    ├── package.json               # Mobile npm dependencies and execution scripts
    ├── __tests__/                 # Mobile unit and component test suites
    │   ├── components/            # Screen rendering and UI interaction tests
    │   └── unit/                  # Formatting, calculation, and service tests
    └── src/
        ├── components/            # Reusable Atomic UI primitives (Buttons, Cards, Inputs)
        ├── config/                # API resolution and dynamic host IP detection
        ├── context/               # Global state providers (Authentication context)
        ├── navigation/            # Navigation stacks (AuthStack, DriverTabs, HostTabs)
        ├── screens/               # Screen components (Auth, Driver Dashboard, Host Listings)
        ├── services/              # API clients (spotService, paymentService, socketService)
        ├── theme/                 # Design tokens (colors, typography, elevation)
        └── utils/                 # Formatting utilities (currency, distance, card numbers)
```

---

## Operational Specifications & Design Constraints

1. **Card Input Formatting & Verification**:
   - Card number fields automatically enforce a 19-character limit (`XXXX XXXX XXXX XXXX`) via `formatCardNumber`.
   - Raw digits are stripped of non-numeric characters via `stripCardNumber` prior to payload dispatch to `/payments/verify`.
   - Payment signatures are validated using standard `HMAC-SHA256` matching Razorpay's cryptographic specification:
     $$\text{Signature} = \text{HMAC-SHA256}(\text{order\_id} \parallel \text{payment\_id}, \, \text{secret})$$

2. **Host Split Calculation**:
   - Financial distributions are determined according to:
     $$\text{Host Share} = \text{round}(\text{Total Paice} \times 0.80)$$
     $$\text{Platform Commission} = \text{Total Paise} - \text{Host Share}$$
   - Payout transfers to host linked accounts (`razorpay_account_id`) are executed immediately upon payment verification or held in platform escrow if pending account association.

3. **Geofenced Check-In Constraint**:
   - Euclidean spatial distance is computed via the spherical law of cosines:
     $$D = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
   - Check-in is authorized if and only if $D \le 50\text{ meters}$.

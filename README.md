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

### 1. Card Input Formatting & Numeric Payload Extraction

To protect against buffer and layout overflow bugs in the mobile client while maintaining clean numerical payloads for payment processing, all card entry fields adhere to strict formatting and validation rules:

- **19-Character Layout Constraint**: Card number fields restrict entry to a maximum of 19 characters (16 numerical digits plus 3 interstitial whitespace delimiters).
- **Dynamic Grouping Engine**: The utility function `formatCardNumber` strips all non-numeric characters and inserts a single space delimiter after every 4 digits:
  ```typescript
  export const formatCardNumber = (value: string): string => {
    if (!value) return '';
    const cleanDigits = value.replace(/\D/g, '').slice(0, 16);
    return cleanDigits.replace(/(\d{4})/g, '$1 ').trim();
  };
  ```
- **Payload Extraction Isolation**: As the user types, the UI component renders the grouped display representation (`XXXX XXXX XXXX XXXX`). Before dispatching the payload to `/payments/verify`, the component extracts pure numeric digits using `stripCardNumber` (aliased as `cleanCardNumber`):
  ```typescript
  export const stripCardNumber = (value: string): string => {
    if (!value) return '';
    return value.replace(/\D/g, '').slice(0, 16);
  };
  ```

### 2. Cryptographic Payment Verification (HMAC-SHA256)

Payment authenticity is guaranteed via cryptographic signature validation matching Razorpay's specification. The Express API Gateway accepts order IDs, payment IDs, and signatures at `POST /payments/verify` and validates integrity against the server-side `RAZORPAY_KEY_SECRET`:

```text
signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
```

Implementation logic in `gateway-express/src/routes/payments.js`:
```javascript
const expectedSignature = crypto
  .createHmac('sha256', razorpaySecret)
  .update(`${effectiveOrderId}|${paymentId}`)
  .digest('hex');

if (expectedSignature !== signature) {
  return res.status(400).json({ error: 'Invalid payment signature' });
}
```

- **Tamper Resistance**: If `expectedSignature !== signature`, the gateway immediately rejects the request with HTTP `400 Bad Request`, halts the escrow workflow, and retains the booking in `pending` status.
- **Dual Execution Pathways**:
  - *Native SDK Pathway*: Mobile clients running in compiled builds forward native callbacks (`razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature`).
  - *Sandboxed Development Pathway*: Expo Go sessions utilize test card inputs (`POST /payments/verify` with `card_number`). The gateway validates format, generates an authorized payment identifier (`pay_test_...`), and computes the canonical HMAC-SHA256 signature server-side.

### 3. Dynamic 80/20 Financial Split Settlement (Razorpay Route)

The platform implements an automated financial clearing model allocating 80% of gross booking revenues to property hosts and retaining a 20% commission fee:

```text
Host Net Earnings (80%)   = round(Total Amount * 0.80)
Platform Commission (20%) = Total Amount - Host Net Earnings
```

- **Calculated Split in Minor Currency Units (Paise)**:
  - Total Paise: `Math.round(totalAmount * 100)`
  - Host Share Paise: `Math.round(totalPaise * 0.80)`
  - Platform Share Paise: `totalPaise - hostSharePaise`
- **Razorpay Route Transfer Execution**:
  ```javascript
  const transferPayload = {
    transfers: [
      {
        account: hostAccountId,
        amount: split.hostSharePaise,
        currency: 'INR',
        notes: {
          booking_id: booking.id,
          driver_id: booking.driver_id,
          split_rule: '80_percent_host',
        },
        on_hold: 0,
      },
    ],
  };
  await razorpay.payments.transfer(paymentId, transferPayload);
  ```
- **Escrow Fallback Policy**: When a host has not yet linked a verified `razorpay_account_id`, the host net earnings are retained in the platform escrow pool (`held_in_escrow`), and a transaction record is created with `status: 'held_in_escrow'` until account linkage is completed.

### 4. Geofenced Driver Check-In Constraint (<50 Meters)

To confirm physical vehicle arrival and authorize space occupancy, the system evaluates the Euclidean distance between the driver's device coordinates and the registered parking spot coordinates.

The distance calculation employs the spherical law of cosines:

$$
D = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)
$$

Where:
- $R = 6,371,000\text{ meters}$ (mean volumetric radius of Earth).
- $\phi_1, \phi_2$ denote the driver and parking spot latitudes in radians.
- $\Delta\phi = \phi_2 - \phi_1$ denotes the latitude difference.
- $\Delta\lambda = \lambda_2 - \lambda_1$ denotes the longitude difference.

Constraint Enforcement:
- Physical check-in is authorized if and only if:
  $$D \le 50.0\text{ meters}$$
- When $D > 50\text{ meters}$, the gateway returns:
  ```json
  {
    "error": "Driver is not within 50 meters of the parking spot",
    "distance_meters": 342.5,
    "max_allowed_meters": 50.0
  }
  ```
- Upon valid check-in ($D \le 50\text{m}$), the booking status transitions to `active`, and a targeted `booking_updated` event is dispatched across Socket.io to both host and driver rooms.

---

## Contributing

We welcome contributions from the engineering community. All contributors must adhere to the engineering standards and quality gates detailed below.

### Branching Strategy

The repository follows a modified GitFlow branching model centered on a protected `main` branch:

- `main`: Production-ready branch. Direct pushes are disabled; all updates arrive via approved pull requests.
- `develop`: Integration and staging branch for feature merges.
- Working branches must branch off `develop` (or `main` for critical production hotfixes) using strict naming prefixes:
  - `feature/<ticket-id>-<short-description>`: New functional capabilities (e.g., `feature/GP-104-spatial-clustering`).
  - `bugfix/<ticket-id>-<short-description>`: Defect repairs (e.g., `bugfix/GP-212-card-format-overflow`).
  - `hotfix/<ticket-id>-<short-description>`: Production emergency patches (e.g., `hotfix/GP-301-gateway-cors`).
  - `chore/<ticket-id>-<short-description>`: Maintenance, dependency updates, and tooling.

### Commit Message Standards

All commits must adhere to the Conventional Commits 1.0.0 specification:

```text
<type>(<scope>): <subject in present imperative tense>

[optional body describing the technical rationale]

[optional footer referencing issue or breaking change]
```

Permitted commit types:
- `feat`: Addition of a new user- or system-facing feature.
- `fix`: Resolution of a defect or bug.
- `docs`: Documentation modifications only.
- `refactor`: Code changes that neither fix a bug nor introduce a feature.
- `perf`: Optimizations that improve execution speed or resource utilization.
- `test`: Addition or modification of unit, integration, or component tests.
- `build`: Modifications affecting build systems, packaging, or external dependencies.
- `ci`: Changes to continuous integration pipelines and configuration scripts.
- `chore`: Routine operational, toolchain, or metadata maintenance.

Permitted scopes:
`gateway`, `search`, `mobile`, `db`, `infra`, `auth`, `payments`, `socket`.

Example commit messages:
```text
feat(gateway): implement user-scoped booking query endpoint
fix(mobile): enforce 19-character limit on card number input
test(search): add PostGIS spatial radius benchmark assertions
chore(deps): update prisma client to version 5.10.2
```

### Pull Request Protocols

Prior to submitting a pull request:
1. Rebase your working branch onto the latest `origin/main` to ensure linear history.
2. Execute the test suites across all affected services and confirm zero test regressions:
   ```bash
   # Backend Gateway Test Suite
   npm --prefix gateway-express test

   # Mobile Test Suite
   npm --prefix mobile test
   ```
3. Ensure no linting or type-checking errors exist.
4. Complete the Pull Request template:
   - Provide a concise summary of technical changes.
   - Detail reproduction or verification steps.
   - Attach test execution output or benchmark metrics.
5. Code reviews require approval from at least one core engineer prior to merging.
6. Merges are performed via Squash and Merge or Rebase and Merge to maintain a clean git history.

---

## Issue Reporting

When reporting defects or proposing architectural enhancements, use the standardized issue templates below.

### Bug Report Guidelines

Submit bug reports via the repository Issue Tracker with the following structure:

```markdown
### Environment Information
- Operating System: [e.g., Windows 11, Ubuntu 22.04 LTS, macOS 14]
- Node.js Version: [e.g., v20.11.0]
- Go Version: [e.g., go1.22.1]
- Docker Engine Version: [e.g., 24.0.7]
- Mobile Device / OS: [e.g., Pixel 7 Android 14 / Expo Go 58.0.0]

### Problem Description
A clear and concise description of the observed defect.

### Reproduction Steps
1. Execute endpoint '...' with payload '...'
2. Observe status code '...'
3. Note error banner in mobile view '...'

### Expected Behavior
A concise description of the expected system response.

### Diagnostic Logs
```text
[Paste relevant gateway, Go daemon, or Metro terminal logs here]
```
```

### Feature Request Guidelines

Propose new capabilities with the following structure:

```markdown
### Problem Statement
A concise description of the business need or architectural bottleneck.

### Proposed Technical Solution
Detailed description of the proposed service, endpoint, or schema change.

### Affected Microservices
- [ ] API Gateway (Node.js/Express)
- [ ] Spatial Search Engine (Go)
- [ ] Mobile Client (React Native/Expo)
- [ ] Database / PostGIS Schema

### Alternatives Considered
Other architectural approaches evaluated and reasons for rejection.
```

---

## License

This software is distributed under the terms of the MIT License. For complete terms, conditions, and copyright notices, refer to the [LICENSE](LICENSE) file located at the root of this repository.

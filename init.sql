-- 1. Enable PostGIS Extension (Required for Spatial Queries)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUM Types
CREATE TYPE user_role AS ENUM ('driver', 'host', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'active', 'completed', 'cancelled', 'disputed');

-- 3. Users Table (Managed by Express)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL DEFAULT 'driver',
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    phone_number VARCHAR(20) UNIQUE,
    razorpay_account_id VARCHAR(100), -- For Host escrow payouts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Parking Spots Table (Queried heavily by Golang, Managed by Express)
CREATE TABLE parking_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    -- PostGIS Point Geometry (SRID 4326 for standard GPS coords)
    location GEOMETRY(Point, 4326) NOT NULL, 
    hourly_rate DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a GIST index for lightning-fast radius searches in Go
CREATE INDEX idx_parking_spots_location ON parking_spots USING GIST (location);

-- 5. Bookings Table (Managed by Express)
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES users(id),
    spot_id UUID NOT NULL REFERENCES parking_spots(id),
    status booking_status NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

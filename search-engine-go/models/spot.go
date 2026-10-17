package models

import (
	"bytes"
	"database/sql/driver"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"
)

// Point represents a geographic coordinate (GPS WGS 84 / SRID 4326)
type Point struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
}

// String outputs WKT representation of Point
func (p Point) String() string {
	return fmt.Sprintf("POINT(%f %f)", p.Longitude, p.Latitude)
}

// Value implements the database/sql driver.Valuer interface
func (p Point) Value() (driver.Value, error) {
	return fmt.Sprintf("SRID=4326;POINT(%f %f)", p.Longitude, p.Latitude), nil
}

// Scan implements the database/sql Scanner interface for PostGIS geometries.
// Supports:
// 1. EWKB binary byte slices (PostGIS default binary transfer)
// 2. EWKB hex strings (e.g. 0101000020E6100000...)
// 3. WKT strings (e.g. POINT(77.5946 12.9716) or SRID=4326;POINT(...))
// 4. GeoJSON strings (e.g. {"type":"Point","coordinates":[77.5946,12.9716]})
func (p *Point) Scan(value interface{}) error {
	if value == nil {
		p.Longitude = 0
		p.Latitude = 0
		return nil
	}

	var rawBytes []byte

	switch v := value.(type) {
	case []byte:
		rawBytes = v
	case string:
		rawBytes = []byte(v)
	default:
		return fmt.Errorf("unsupported data type for Point geometry: %T", value)
	}

	strVal := strings.TrimSpace(string(rawBytes))

	// 1. Check if WKT format: POINT(...) or SRID=4326;POINT(...)
	if strings.Contains(strVal, "POINT") {
		idx := strings.Index(strVal, "POINT")
		wkt := strVal[idx:]
		var lng, lat float64
		_, err := fmt.Sscanf(wkt, "POINT(%f %f)", &lng, &lat)
		if err != nil {
			// Try with space after parenthesis: POINT( lng lat )
			_, err = fmt.Sscanf(wkt, "POINT ( %f %f )", &lng, &lat)
		}
		if err == nil {
			p.Longitude = lng
			p.Latitude = lat
			return nil
		}
	}

	// 2. Check if GeoJSON format: {"type":"Point","coordinates":[lng,lat]}
	if strings.HasPrefix(strVal, "{") && strings.Contains(strVal, "coordinates") {
		var geo struct {
			Type        string    `json:"type"`
			Coordinates []float64 `json:"coordinates"`
		}
		if err := json.Unmarshal([]byte(strVal), &geo); err == nil && len(geo.Coordinates) >= 2 {
			p.Longitude = geo.Coordinates[0]
			p.Latitude = geo.Coordinates[1]
			return nil
		}
	}

	// 3. Check if Hex-encoded EWKB string
	data := rawBytes
	if len(rawBytes) >= 42 && isHexString(rawBytes) {
		decoded, err := hex.DecodeString(string(rawBytes))
		if err == nil {
			data = decoded
		}
	}

	// 4. Parse EWKB binary
	if len(data) >= 21 {
		return p.parseEWKB(data)
	}

	return fmt.Errorf("unable to parse geometry value into Point: %s", strVal)
}

func isHexString(b []byte) bool {
	for _, c := range b {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func (p *Point) parseEWKB(data []byte) error {
	reader := bytes.NewReader(data)

	// Byte 0: Endianness (1 = LittleEndian, 0 = BigEndian)
	var byteOrder binary.ByteOrder
	endianByte, err := reader.ReadByte()
	if err != nil {
		return err
	}
	if endianByte == 1 {
		byteOrder = binary.LittleEndian
	} else {
		byteOrder = binary.BigEndian
	}

	// Bytes 1-4: Geometry Type (EWKB includes SRID flag 0x20000000)
	var geomType uint32
	if err := binary.Read(reader, byteOrder, &geomType); err != nil {
		return err
	}

	hasSRID := (geomType & 0x20000000) != 0

	// If SRID flag is set, read 4-byte SRID
	if hasSRID {
		var srid uint32
		if err := binary.Read(reader, byteOrder, &srid); err != nil {
			return err
		}
	}

	// Next 8 bytes: X coordinate (Longitude)
	var xBits uint64
	if err := binary.Read(reader, byteOrder, &xBits); err != nil {
		return err
	}
	p.Longitude = math.Float64frombits(xBits)

	// Next 8 bytes: Y coordinate (Latitude)
	var yBits uint64
	if err := binary.Read(reader, byteOrder, &yBits); err != nil {
		return err
	}
	p.Latitude = math.Float64frombits(yBits)

	return nil
}

// ParkingSpot maps directly to the parking_spots table
type ParkingSpot struct {
	ID             string    `json:"id" db:"id"`
	HostID         string    `json:"host_id" db:"host_id"`
	Title          string    `json:"title" db:"title"`
	Address        string    `json:"address" db:"address"`
	Location       Point     `json:"location" db:"location"`
	HourlyRate     float64   `json:"hourly_rate" db:"hourly_rate"`
	IsActive       bool      `json:"is_active" db:"is_active"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
	DistanceMeters *float64  `json:"distance_meters,omitempty" db:"distance_meters"`
}

// SearchParams contains query parameters for spatial search
type SearchParams struct {
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	RadiusMeters float64 `json:"radius_meters"`
	Limit        int     `json:"limit"`
}

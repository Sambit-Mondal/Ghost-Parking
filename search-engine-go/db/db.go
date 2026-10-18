package db

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"search-engine-go/models"
)

type DB struct {
	*sql.DB
}

// Connect establishes a connection pool to PostgreSQL with retries
func Connect(databaseURL string) (*DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Try pinging the database with exponential backoff
	var lastErr error
	for attempts := 1; attempts <= 10; attempts++ {
		ctxErr := db.Ping()
		if ctxErr == nil {
			log.Printf("[DB] Connected to PostgreSQL successfully (attempt %d)", attempts)
			return &DB{db}, nil
		}
		lastErr = ctxErr
		waitTime := time.Duration(attempts) * 500 * time.Millisecond
		log.Printf("[DB] Waiting for database (attempt %d/10): %v", attempts, ctxErr)
		time.Sleep(waitTime)
	}

	return nil, fmt.Errorf("database unreachable after 10 attempts: %w", lastErr)
}

// CheckPostGIS verifies the PostGIS extension is installed and returns its version
func (db *DB) CheckPostGIS() (string, error) {
	var version string
	err := db.QueryRow("SELECT PostGIS_Version()").Scan(&version)
	if err != nil {
		return "", err
	}
	return version, nil
}

// GetNearbySpots5Miles executes a raw PostGIS spatial query to return available parking spots
// within a 5-mile (8046.72 meters) radius, sorted by distance ascending.
func (db *DB) GetNearbySpots5Miles(lat, lng float64, limit int) ([]models.ParkingSpot, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	const radiusMeters = 8046.72 // 5 miles in meters (5 * 1609.344)

	query := `
		SELECT 
			id,
			host_id,
			title,
			address,
			ST_X(location::geometry) as longitude,
			ST_Y(location::geometry) as latitude,
			hourly_rate,
			is_active,
			created_at,
			updated_at,
			ST_Distance(
				location::geography, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
			) as distance_meters
		FROM parking_spots
		WHERE is_active = true
		  AND ST_DWithin(
				location::geography, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
				$3
		  )
		ORDER BY distance_meters ASC
		LIMIT $4;
	`

	rows, err := db.Query(query, lng, lat, radiusMeters, limit)
	if err != nil {
		return nil, fmt.Errorf("nearby spots query failed: %w", err)
	}
	defer rows.Close()

	var spots []models.ParkingSpot
	for rows.Next() {
		var s models.ParkingSpot
		var spotLng, spotLat float64
		var distMeters float64

		err := rows.Scan(
			&s.ID,
			&s.HostID,
			&s.Title,
			&s.Address,
			&spotLng,
			&spotLat,
			&s.HourlyRate,
			&s.IsActive,
			&s.CreatedAt,
			&s.UpdatedAt,
			&distMeters,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		s.Location = models.Point{Longitude: spotLng, Latitude: spotLat}
		s.DistanceMeters = &distMeters
		distMiles := distMeters / 1609.344
		s.DistanceMiles = &distMiles
		spots = append(spots, s)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return spots, nil
}

// SearchNearbySpots searches for active spots within a radius (meters) using the PostGIS GIST index
func (db *DB) SearchNearbySpots(params models.SearchParams) ([]models.ParkingSpot, error) {
	if params.Limit <= 0 || params.Limit > 100 {
		params.Limit = 20
	}
	if params.RadiusMeters <= 0 {
		params.RadiusMeters = 5000 // default 5km
	}

	query := `
		SELECT 
			id,
			host_id,
			title,
			address,
			ST_X(location::geometry) as longitude,
			ST_Y(location::geometry) as latitude,
			hourly_rate,
			is_active,
			created_at,
			updated_at,
			ST_Distance(
				location::geography, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
			) as distance_meters
		FROM parking_spots
		WHERE is_active = true
		  AND ST_DWithin(
				location::geography, 
				ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
				$3
		  )
		ORDER BY distance_meters ASC
		LIMIT $4;
	`

	rows, err := db.Query(query, params.Longitude, params.Latitude, params.RadiusMeters, params.Limit)
	if err != nil {
		return nil, fmt.Errorf("search query failed: %w", err)
	}
	defer rows.Close()

	var spots []models.ParkingSpot
	for rows.Next() {
		var s models.ParkingSpot
		var lng, lat float64
		var dist float64

		err := rows.Scan(
			&s.ID,
			&s.HostID,
			&s.Title,
			&s.Address,
			&lng,
			&lat,
			&s.HourlyRate,
			&s.IsActive,
			&s.CreatedAt,
			&s.UpdatedAt,
			&dist,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		s.Location = models.Point{Longitude: lng, Latitude: lat}
		s.DistanceMeters = &dist
		spots = append(spots, s)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return spots, nil
}

// GetAllSpots lists parking spots with pagination
func (db *DB) GetAllSpots(limit, offset int) ([]models.ParkingSpot, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	query := `
		SELECT 
			id,
			host_id,
			title,
			address,
			ST_X(location::geometry) as longitude,
			ST_Y(location::geometry) as latitude,
			hourly_rate,
			is_active,
			created_at,
			updated_at
		FROM parking_spots
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2;
	`

	rows, err := db.Query(query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var spots []models.ParkingSpot
	for rows.Next() {
		var s models.ParkingSpot
		var lng, lat float64

		err := rows.Scan(
			&s.ID,
			&s.HostID,
			&s.Title,
			&s.Address,
			&lng,
			&lat,
			&s.HourlyRate,
			&s.IsActive,
			&s.CreatedAt,
			&s.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		s.Location = models.Point{Longitude: lng, Latitude: lat}
		spots = append(spots, s)
	}

	return spots, nil
}

// GetSpotByID fetches a spot by UUID
func (db *DB) GetSpotByID(id string) (*models.ParkingSpot, error) {
	query := `
		SELECT 
			id,
			host_id,
			title,
			address,
			location,
			hourly_rate,
			is_active,
			created_at,
			updated_at
		FROM parking_spots
		WHERE id = $1;
	`

	var s models.ParkingSpot
	err := db.QueryRow(query, id).Scan(
		&s.ID,
		&s.HostID,
		&s.Title,
		&s.Address,
		&s.Location, // Scanned directly via custom PostGIS Scanner!
		&s.HourlyRate,
		&s.IsActive,
		&s.CreatedAt,
		&s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &s, nil
}

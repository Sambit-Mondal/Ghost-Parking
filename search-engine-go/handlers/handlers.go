package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"search-engine-go/db"
	"search-engine-go/models"
)

type Handler struct {
	DB        *db.DB
	StartTime time.Time
}

func NewHandler(database *db.DB) *Handler {
	return &Handler{
		DB:        database,
		StartTime: time.Now(),
	}
}

// JSONResponse helper
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// JSONError helper
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// Health checks DB and PostGIS readiness
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	postgisVersion, err := h.DB.CheckPostGIS()
	if err != nil {
		respondJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"status":          "unhealthy",
			"service":         "search-engine-go",
			"database_error":  err.Error(),
			"uptime_seconds":  time.Since(h.StartTime).Seconds(),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "healthy",
		"service":         "search-engine-go",
		"postgis_version": postgisVersion,
		"uptime_seconds":  time.Since(h.StartTime).Seconds(),
	})
}

// NearbySpots handles GET /spots/nearby?latitude=...&longitude=... (5-mile radius search)
func (h *Handler) NearbySpots(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	query := r.URL.Query()
	latStr := query.Get("latitude")
	if latStr == "" {
		latStr = query.Get("lat")
	}

	lngStr := query.Get("longitude")
	if lngStr == "" {
		lngStr = query.Get("lng")
	}

	if latStr == "" || lngStr == "" {
		respondError(w, http.StatusBadRequest, "Missing required query parameters: 'latitude' and 'longitude'")
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil || lat < -90 || lat > 90 {
		respondError(w, http.StatusBadRequest, "Invalid 'latitude' coordinate (must be between -90 and 90)")
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil || lng < -180 || lng > 180 {
		respondError(w, http.StatusBadRequest, "Invalid 'longitude' coordinate (must be between -180 and 180)")
		return
	}

	limit := 50
	if lStr := query.Get("limit"); lStr != "" {
		if lVal, err := strconv.Atoi(lStr); err == nil && lVal > 0 && lVal <= 100 {
			limit = lVal
		}
	}

	spots, err := h.DB.GetNearbySpots5Miles(lat, lng, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to retrieve nearby spots: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"query": map[string]interface{}{
			"latitude":     lat,
			"longitude":    lng,
			"radius_miles": 5.0,
			"limit":        limit,
		},
		"count": len(spots),
		"spots": spots,
	})
}

// Search handles spatial radius queries: GET /search?lat=...&lng=...&radius=...&limit=...
func (h *Handler) Search(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	query := r.URL.Query()
	latStr := query.Get("lat")
	lngStr := query.Get("lng")

	if latStr == "" || lngStr == "" {
		respondError(w, http.StatusBadRequest, "Missing required query parameters: 'lat' and 'lng'")
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil || lat < -90 || lat > 90 {
		respondError(w, http.StatusBadRequest, "Invalid 'lat' coordinate (must be between -90 and 90)")
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil || lng < -180 || lng > 180 {
		respondError(w, http.StatusBadRequest, "Invalid 'lng' coordinate (must be between -180 and 180)")
		return
	}

	radius := 5000.0 // Default 5000 meters (5km)
	if rStr := query.Get("radius"); rStr != "" {
		if rVal, err := strconv.ParseFloat(rStr, 64); err == nil && rVal > 0 {
			radius = rVal
		}
	}

	limit := 20
	if lStr := query.Get("limit"); lStr != "" {
		if lVal, err := strconv.Atoi(lStr); err == nil && lVal > 0 && lVal <= 100 {
			limit = lVal
		}
	}

	params := models.SearchParams{
		Latitude:     lat,
		Longitude:    lng,
		RadiusMeters: radius,
		Limit:        limit,
	}

	spots, err := h.DB.SearchNearbySpots(params)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Search query error: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"query": map[string]interface{}{
			"latitude":      lat,
			"longitude":     lng,
			"radius_meters": radius,
			"limit":         limit,
		},
		"count": len(spots),
		"spots": spots,
	})
}

// ListSpots handles GET /spots
func (h *Handler) ListSpots(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	query := r.URL.Query()
	limit := 50
	offset := 0

	if lStr := query.Get("limit"); lStr != "" {
		if lVal, err := strconv.Atoi(lStr); err == nil && lVal > 0 {
			limit = lVal
		}
	}
	if oStr := query.Get("offset"); oStr != "" {
		if oVal, err := strconv.Atoi(oStr); err == nil && oVal >= 0 {
			offset = oVal
		}
	}

	spots, err := h.DB.GetAllSpots(limit, offset)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch spots: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"count": len(spots),
		"spots": spots,
	})
}

// GetSpotByID handles GET /spots/{id}
func (h *Handler) GetSpotByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract UUID from path: /spots/{id}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 2 || pathParts[1] == "" {
		respondError(w, http.StatusBadRequest, "Missing spot ID in path")
		return
	}

	id := pathParts[1]
	spot, err := h.DB.GetSpotByID(id)
	if err != nil {
		respondError(w, http.StatusNotFound, "Spot not found")
		return
	}

	respondJSON(w, http.StatusOK, spot)
}

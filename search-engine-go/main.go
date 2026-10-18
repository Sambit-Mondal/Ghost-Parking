package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"search-engine-go/db"
	"search-engine-go/handlers"
)

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s %s - %v", r.Method, r.URL.Path, r.RemoteAddr, time.Since(start))
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/ghost_parking?sslmode=disable")

	log.Printf("[Search Engine] Initializing service on port %s...", port)

	// Connect to PostgreSQL database
	database, err := db.Connect(dbURL)
	if err != nil {
		log.Fatalf("[Search Engine] Failed to connect to database: %v", err)
	}
	defer database.Close()

	// Verify PostGIS extension
	postgisVersion, err := database.CheckPostGIS()
	if err != nil {
		log.Printf("[Search Engine] Warning: PostGIS extension check returned error: %v", err)
	} else {
		log.Printf("[Search Engine] PostGIS ready: %s", postgisVersion)
	}

	h := handlers.NewHandler(database)
	mux := http.NewServeMux()

	// Endpoints
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/spots/nearby", h.NearbySpots)
	mux.HandleFunc("/search", h.Search)
	mux.HandleFunc("/spots", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/spots/nearby" {
			h.NearbySpots(w, r)
			return
		}
		if r.URL.Path == "/spots" || r.URL.Path == "/spots/" {
			h.ListSpots(w, r)
		} else {
			h.GetSpotByID(w, r)
		}
	})
	mux.HandleFunc("/spots/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/spots/nearby" {
			h.NearbySpots(w, r)
			return
		}
		h.GetSpotByID(w, r)
	})

	// Root welcome endpoint
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"service": "search-engine-go",
			"status":  "running",
			"endpoints": map[string]string{
				"health":       "GET /health",
				"spots_nearby": "GET /spots/nearby?latitude=12.9716&longitude=77.5946",
				"search":       "GET /search?lat=12.9716&lng=77.5946&radius=5000&limit=20",
				"spots":        "GET /spots",
				"spot":         "GET /spots/{id}",
			},
		})
	})

	handler := corsMiddleware(loggingMiddleware(mux))

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Graceful shutdown channel
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("[Search Engine] HTTP server listening on http://0.0.0.0:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Search Engine] Server failed: %v", err)
		}
	}()

	<-stopChan
	log.Println("[Search Engine] Shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Search Engine] Server shutdown error: %v", err)
	}

	log.Println("[Search Engine] Server stopped.")
}

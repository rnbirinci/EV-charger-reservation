package store

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
)

func Connect() (*pgxpool.Pool, error) {
	url := os.Getenv("DB_URL") // Get the database URL from environment variable
	if url == "" {             // Check if the environment variable is set
		return nil, fmt.Errorf("DB_URL is not set")
	}

	pool, err := pgxpool.New(context.Background(), url) // Create a new connection pool to the database using the provided URL
	if err != nil {                                     // Check if there was an error creating the connection pool
		return nil, fmt.Errorf("error connecting to database: %v", err)
	}

	err = pool.Ping(context.Background()) // Ping the database to ensure the connection is valid
	if err != nil {                       // Check if there was an error pinging the database
		return nil, fmt.Errorf("error pinging database: %v", err)
	}

	return pool, nil // Return the connection pool and nil error if successful
}

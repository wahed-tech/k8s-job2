package main

import (
	"crypto/rand"
	"encoding/base64"
	"log"
	"net/http"
	"os"
)

func main() {
	// Generate a fresh session key on every start.
	// Sessions are invalidated on pod restart — acceptable for an internal tool.
	sessionKey := make([]byte, 32)
	if _, err := rand.Read(sessionKey); err != nil {
		log.Fatal("failed to generate session key:", err)
	}

	s := &Server{
		clientID:     mustEnv("GITHUB_CLIENT_ID"),
		clientSecret: mustEnv("GITHUB_CLIENT_SECRET"),
		sessionKey:   sessionKey,
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	// Auth
	mux.HandleFunc("/auth/login", s.handleLogin)
	mux.HandleFunc("/auth/callback", s.handleCallback)
	mux.HandleFunc("/auth/logout", s.handleLogout)

	// API — exact match before prefix
	mux.HandleFunc("/api/me", s.handleMe)
	mux.HandleFunc("/api/repos", s.handleRepos)
	mux.HandleFunc("/api/repos/", s.handleDeployment)

	// Static + SPA catch-all
	registerStaticHandlers(mux)

	log.Printf("k8sjob listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env var %s is not set", key)
	}
	return v
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b)[:n], nil
}

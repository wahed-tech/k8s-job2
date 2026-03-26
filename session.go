package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
)

const sessionCookieName = "k8sjob_session"

// SessionData is stored AES-GCM encrypted in the session cookie.
// Stateless: no server-side storage required.
type SessionData struct {
	Token     string `json:"token"`
	Login     string `json:"login"`
	AvatarURL string `json:"avatar_url"`
}

// getSession reads and decrypts the session cookie from the request.
func (s *Server) getSession(r *http.Request) (*SessionData, error) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return nil, err
	}
	data, err := s.decrypt(cookie.Value)
	if err != nil {
		return nil, err
	}
	var session SessionData
	if err := json.Unmarshal(data, &session); err != nil {
		return nil, err
	}
	return &session, nil
}

// setSession encrypts session data and writes it as an HTTP-only cookie.
func (s *Server) setSession(w http.ResponseWriter, session SessionData) error {
	payload, err := json.Marshal(session)
	if err != nil {
		return err
	}
	encrypted, err := s.encrypt(payload)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    encrypted,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		// No MaxAge/Expires — browser session cookie.
	})
	return nil
}

// clearSession deletes the session cookie.
func (s *Server) clearSession(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:   sessionCookieName,
		MaxAge: -1,
		Path:   "/",
	})
}

// encrypt encodes data using AES-256-GCM and returns a base64url string.
func (s *Server) encrypt(data []byte) (string, error) {
	block, err := aes.NewCipher(s.sessionKey)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return base64.URLEncoding.EncodeToString(ciphertext), nil
}

// decrypt reverses encrypt.
func (s *Server) decrypt(encoded string) ([]byte, error) {
	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(s.sessionKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(data) < gcm.NonceSize() {
		return nil, fmt.Errorf("invalid ciphertext")
	}
	nonce, ciphertext := data[:gcm.NonceSize()], data[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// requestBaseURL derives the app's base URL from the incoming request.
// It respects X-Forwarded-Proto set by ingress controllers and load balancers.
func requestBaseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

// handleLogin starts the GitHub OAuth flow.
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	state, err := randomString(32)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Short-lived CSRF state cookie verified in handleCallback.
	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		MaxAge:   300,
		SameSite: http.SameSiteLaxMode,
	})

	authURL := "https://github.com/login/oauth/authorize?" + url.Values{
		"client_id":    {s.clientID},
		"scope":        {"repo read:org"},
		"state":        {state},
		"redirect_uri": {requestBaseURL(r) + "/auth/callback"},
	}.Encode()

	http.Redirect(w, r, authURL, http.StatusFound)
}

// handleCallback exchanges the OAuth authorization code for an access token
// and sets the encrypted session cookie.
func (s *Server) handleCallback(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid OAuth state", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_state", MaxAge: -1, Path: "/"})

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing OAuth code", http.StatusBadRequest)
		return
	}

	token, err := s.exchangeCode(code)
	if err != nil {
		http.Error(w, "failed to get access token: "+err.Error(), http.StatusInternalServerError)
		return
	}

	login, avatarURL, err := s.fetchUserInfo(token)
	if err != nil {
		http.Error(w, "failed to fetch GitHub user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := s.setSession(w, SessionData{Token: token, Login: login, AvatarURL: avatarURL}); err != nil {
		http.Error(w, "session error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/", http.StatusFound)
}

// handleLogout clears the session cookie and redirects to the home page.
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	s.clearSession(w)
	http.Redirect(w, r, "/", http.StatusFound)
}

// handleMe returns the current authenticated user's login and avatar.
func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	session, err := s.getSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"login":      session.Login,
		"avatar_url": session.AvatarURL,
	})
}

// exchangeCode trades a GitHub OAuth authorization code for an access token.
func (s *Server) exchangeCode(code string) (string, error) {
	resp, err := http.PostForm("https://github.com/login/oauth/access_token", url.Values{
		"client_id":     {s.clientID},
		"client_secret": {s.clientSecret},
		"code":          {code},
	})
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	vals, err := url.ParseQuery(string(body))
	if err != nil {
		return "", err
	}
	token := vals.Get("access_token")
	if token == "" {
		msg := vals.Get("error_description")
		if msg == "" {
			msg = string(body)
		}
		return "", fmt.Errorf("%s", msg)
	}
	return token, nil
}

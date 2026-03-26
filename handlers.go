package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
)

// errNotFound is returned by GitHub client functions when a resource does not exist.
var errNotFound = errors.New("not found")

// handleRepos lists all wahed-tech repositories visible to the authenticated user.
func (s *Server) handleRepos(w http.ResponseWriter, r *http.Request) {
	session, err := s.getSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	repos, err := s.listRepos(session.Token)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if repos == nil {
		repos = []RepoInfo{} // ensure JSON encodes as [] not null
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(repos)
}

// handleDeployment fetches .kube/base/deployment.yaml from the requested repo.
// Path: /api/repos/{repo}/deployment
func (s *Server) handleDeployment(w http.ResponseWriter, r *http.Request) {
	repo, ok := parseRepoFromPath(r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}

	session, err := s.getSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	yaml, err := s.fetchDeploymentYAML(session.Token, url.PathEscape(repo))
	if errors.Is(err, errNotFound) {
		http.Error(w, "deployment.yaml not found at .kube/base/deployment.yaml", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"content": yaml})
}

// parseRepoFromPath extracts the repo name from /api/repos/{repo}/deployment.
func parseRepoFromPath(path string) (repo string, ok bool) {
	path = strings.TrimPrefix(path, "/api/repos/")
	if !strings.HasSuffix(path, "/deployment") {
		return "", false
	}
	repo = strings.TrimSuffix(path, "/deployment")
	return repo, repo != ""
}

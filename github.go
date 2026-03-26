package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// RepoInfo is the subset of GitHub repository data exposed by the API.
type RepoInfo struct {
	Name        string `json:"name"`
	FullName    string `json:"full_name"`
	Description string `json:"description"`
}

// fetchUserInfo calls the GitHub /user endpoint and returns the user's login and avatar URL.
func (s *Server) fetchUserInfo(token string) (login, avatarURL string, err error) {
	var user struct {
		Login     string `json:"login"`
		AvatarURL string `json:"avatar_url"`
	}
	if err := s.githubGet(token, "https://api.github.com/user", &user); err != nil {
		return "", "", err
	}
	return user.Login, user.AvatarURL, nil
}

// listRepos returns all repositories in the wahed-tech org visible to the token owner.
// It handles GitHub's pagination transparently.
func (s *Server) listRepos(token string) ([]RepoInfo, error) {
	var result []RepoInfo
	for page := 1; ; page++ {
		apiURL := fmt.Sprintf(
			"https://api.github.com/orgs/wahed-tech/repos?type=all&per_page=100&page=%d",
			page,
		)

		req, _ := http.NewRequest(http.MethodGet, apiURL, nil)
		s.setGitHubHeaders(req, token)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("GitHub API %d: %s", resp.StatusCode, body)
		}

		var page []struct {
			Name        string `json:"name"`
			FullName    string `json:"full_name"`
			Description string `json:"description"`
		}
		if err := json.Unmarshal(body, &page); err != nil {
			return nil, err
		}
		for _, r := range page {
			result = append(result, RepoInfo{Name: r.Name, FullName: r.FullName, Description: r.Description})
		}

		if !strings.Contains(resp.Header.Get("Link"), `rel="next"`) {
			break
		}
	}
	return result, nil
}

// fetchDeploymentYAML fetches and decodes .kube/base/deployment.yaml from the given repo.
// Returns the raw YAML string, or an error if the file doesn't exist.
func (s *Server) fetchDeploymentYAML(token, repo string) (string, error) {
	apiURL := fmt.Sprintf(
		"https://api.github.com/repos/wahed-tech/%s/contents/.kube/base/deployment.yaml",
		repo,
	)

	req, _ := http.NewRequest(http.MethodGet, apiURL, nil)
	s.setGitHubHeaders(req, token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusNotFound {
		return "", errNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("GitHub API %d: %s", resp.StatusCode, body)
	}

	var ghFile struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal(body, &ghFile); err != nil {
		return "", fmt.Errorf("failed to parse GitHub response: %w", err)
	}

	// GitHub base64-encodes file content with embedded newlines.
	cleaned := strings.ReplaceAll(ghFile.Content, "\n", "")
	decoded, err := base64.StdEncoding.DecodeString(cleaned)
	if err != nil {
		return "", fmt.Errorf("failed to decode file content: %w", err)
	}
	return string(decoded), nil
}

// githubGet is a convenience wrapper for simple GET requests that decode JSON into dest.
func (s *Server) githubGet(token, apiURL string, dest any) error {
	req, _ := http.NewRequest(http.MethodGet, apiURL, nil)
	s.setGitHubHeaders(req, token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GitHub API %d: %s", resp.StatusCode, body)
	}
	return json.NewDecoder(resp.Body).Decode(dest)
}

// setGitHubHeaders applies the standard GitHub API headers to a request.
func (s *Server) setGitHubHeaders(req *http.Request, token string) {
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
}

package main

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed frontend
var frontendFS embed.FS

// registerStaticHandlers serves the embedded frontend directory under /static/
// and the SPA catch-all at /.
func registerStaticHandlers(mux *http.ServeMux) {
	sub, _ := fs.Sub(frontendFS, "frontend")
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(sub))))

	indexHTML, _ := frontendFS.ReadFile("frontend/index.html")
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})
}

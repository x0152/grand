package main

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	runtimetemplates "mantis/apps/runtime/templates"
)

func main() {
	log.SetFlags(0)
	out := flag.String("output", "", "directory to write rendered Dockerfiles and manifest into")
	flag.Parse()
	if *out == "" {
		log.Fatalf("sandbox-render: -output is required")
	}
	if err := os.MkdirAll(*out, 0o755); err != nil {
		log.Fatalf("sandbox-render: mkdir %s: %v", *out, err)
	}

	bases, err := runtimetemplates.Bases()
	if err != nil {
		log.Fatalf("sandbox-render: render bases: %v", err)
	}
	tpls, err := runtimetemplates.Builtin()
	if err != nil {
		log.Fatalf("sandbox-render: render templates: %v", err)
	}
	all := append(append([]runtimetemplates.Template{}, bases...), tpls...)

	manifestPath := filepath.Join(*out, "manifest.txt")
	manifest, err := os.Create(manifestPath)
	if err != nil {
		log.Fatalf("sandbox-render: create manifest: %v", err)
	}
	defer manifest.Close()

	for _, t := range all {
		dir := filepath.Join(*out, t.Name)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			log.Fatalf("sandbox-render: mkdir %s: %v", dir, err)
		}
		path := filepath.Join(dir, "Dockerfile")
		if err := os.WriteFile(path, []byte(t.Dockerfile), 0o644); err != nil {
			log.Fatalf("sandbox-render: write %s: %v", path, err)
		}
		hash := dockerfileHash(t.Dockerfile)
		if _, err := fmt.Fprintf(manifest, "%s\t%s\n", t.Name, hash); err != nil {
			log.Fatalf("sandbox-render: write manifest: %v", err)
		}
		log.Printf("sandbox-render: %-12s sha=%s -> %s", t.Name, hash, path)
	}
	log.Printf("sandbox-render: %d sandbox Dockerfiles ready in %s", len(all), *out)
}

func dockerfileHash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:8])
}

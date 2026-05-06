package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"mantis/apps/runtime/health"
	"mantis/apps/runtime/keys"
	"mantis/apps/runtime/progress"
	"mantis/apps/runtime/spec"
	"mantis/apps/runtime/sshcfg"
	"mantis/apps/runtime/templates"
	"mantis/core/auth"
	"mantis/core/protocols"
	"mantis/core/types"
)

const (
	registeredConnectionPrefix = "sb-"
	pubkeyEnvVar               = "SANDBOX_SSH_PUBLIC_KEY"
)

type Endpoints struct {
	rt                protocols.Runtime
	connectionStore   protocols.Store[string, types.Connection]
	guardProfileStore protocols.Store[string, types.GuardProfile]
	keyIssuer         *keys.Issuer
	specBuilder       *spec.Builder
	token             string
	progress          *progress.Tracker
}

func NewEndpoints(
	rt protocols.Runtime,
	connectionStore protocols.Store[string, types.Connection],
	guardProfileStore protocols.Store[string, types.GuardProfile],
	keyIssuer *keys.Issuer,
	specBuilder *spec.Builder,
	token string,
) *Endpoints {
	return &Endpoints{
		rt:                rt,
		connectionStore:   connectionStore,
		guardProfileStore: guardProfileStore,
		keyIssuer:         keyIssuer,
		specBuilder:       specBuilder,
		token:             token,
		progress:          progress.NewTracker(),
	}
}

func (e *Endpoints) Mount(r chi.Router) {
	r.Route("/api/runtime", func(r chi.Router) {
		r.Use(e.authMiddleware)
		r.Get("/sandboxes", e.listSandboxes)
		r.Post("/sandboxes", e.createSandbox)
		r.Get("/sandboxes/{name}/logs", e.sandboxLogs)
		r.Get("/sandboxes/{name}/status", e.sandboxStatus)
		r.Post("/sandboxes/{name}/rebuild", e.rebuildSandbox)
		r.Post("/sandboxes/{name}/start", e.startSandbox)
		r.Post("/sandboxes/{name}/stop", e.stopSandbox)
		r.Delete("/sandboxes/{name}", e.deleteSandbox)
		r.Get("/egress/state", e.egressState)
	})
}

func (e *Endpoints) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if e.token != "" && r.Header.Get("X-Runtime-Token") == e.token {
			next.ServeHTTP(w, r)
			return
		}
		if _, ok := auth.FromContext(r.Context()); ok {
			next.ServeHTTP(w, r)
			return
		}
		if e.token == "" {
			next.ServeHTTP(w, r)
			return
		}
		http.Error(w, "forbidden", http.StatusForbidden)
	})
}

func (e *Endpoints) listSandboxes(w http.ResponseWriter, r *http.Request) {
	conns, err := e.connectionStore.List(r.Context(), types.ListQuery{Page: types.Page{Limit: 1000}})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	containers, err := e.rt.List(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	byName := make(map[string]types.RuntimeContainer, len(containers))
	for _, c := range containers {
		byName[c.Name] = c
	}
	out := make([]SandboxStatus, 0)
	for _, c := range conns {
		if c.Dockerfile == "" {
			continue
		}
		sandboxName := strings.TrimPrefix(c.Name, registeredConnectionPrefix)
		container, ok := byName[sandboxName]
		state := "not-built"
		if ok {
			state = container.Status
		}
		out = append(out, SandboxStatus{Connection: c, Container: container, State: state})
	}
	writeJSON(w, http.StatusOK, SandboxListOutput{Sandboxes: out})
}

func (e *Endpoints) createSandbox(w http.ResponseWriter, r *http.Request) {
	var input SandboxInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if input.Name == "" || input.Dockerfile == "" {
		http.Error(w, "name and dockerfile are required", http.StatusBadRequest)
		return
	}
	if err := validateSandboxName(input.Name); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := validateDockerfile(input.Dockerfile); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	key, err := e.keyIssuer.Ensure(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	conn, err := e.upsertSandboxConnection(r.Context(), input, key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if isWaitRequested(r) {
		e.provisionSandboxStream(w, r, conn, input.Dockerfile, key)
		return
	}
	e.provisionSandboxAsync(w, conn, input.Dockerfile, key)
}

func (e *Endpoints) rebuildSandbox(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	conn, err := e.findSandboxConnection(r.Context(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	key, err := e.keyIssuer.Ensure(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if isWaitRequested(r) {
		e.provisionSandboxStream(w, r, *conn, conn.Dockerfile, key)
		return
	}
	e.provisionSandboxAsync(w, *conn, conn.Dockerfile, key)
}

func isWaitRequested(r *http.Request) bool {
	v := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("wait")))
	switch v {
	case "1", "true", "yes":
		return true
	}
	return false
}

func (e *Endpoints) startSandbox(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	conn, err := e.findSandboxConnection(r.Context(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	key, err := e.keyIssuer.Ensure(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	runSpec := e.specBuilder.Build(
		r.Context(),
		name,
		*conn,
		map[string]string{pubkeyEnvVar: key.PublicKey},
		nil,
	)
	container, err := e.rt.Run(r.Context(), runSpec)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := e.syncConnectionHost(r.Context(), *conn, name, container.IP, key.PrivateKey); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"container": container})
}

func (e *Endpoints) stopSandbox(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if err := e.rt.Stop(r.Context(), name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (e *Endpoints) deleteSandbox(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	_ = e.rt.Remove(r.Context(), name)
	conn, _ := e.findSandboxConnection(r.Context(), name)
	if conn != nil {
		if err := e.connectionStore.Delete(r.Context(), []string{conn.ID}); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (e *Endpoints) provisionSandboxStream(w http.ResponseWriter, r *http.Request, conn types.Connection, dockerfile string, key types.SandboxKey) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)

	sandboxName := imageNameFromConn(conn)
	job := e.progress.Begin(sandboxName)
	sink := io.MultiWriter(w, job)
	flushSink := func() {
		if flusher != nil {
			flusher.Flush()
		}
	}
	e.runProvisioning(r.Context(), job, conn, sandboxName, dockerfile, key, sink, flushSink)
}

func (e *Endpoints) provisionSandboxAsync(w http.ResponseWriter, conn types.Connection, dockerfile string, key types.SandboxKey) {
	sandboxName := imageNameFromConn(conn)
	job := e.progress.Begin(sandboxName)

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		e.runProvisioning(ctx, job, conn, sandboxName, dockerfile, key, job, nil)
	}()

	writeJSON(w, http.StatusAccepted, map[string]any{
		"status":  "accepted",
		"name":    conn.Name,
		"sandbox": sandboxName,
		"phase":   progress.PhaseQueued,
		"message": fmt.Sprintf("provisioning started; check progress with `runtimectl status %s` or `runtimectl logs %s`", sandboxName, sandboxName),
	})
}

func (e *Endpoints) runProvisioning(ctx context.Context, job *progress.Job, conn types.Connection, sandboxName, dockerfile string, key types.SandboxKey, sink io.Writer, flush func()) {
	writeLine := func(s string) {
		_, _ = io.WriteString(sink, s)
		if flush != nil {
			flush()
		}
	}

	job.SetPhase(progress.PhaseBuilding, "building image")
	writeLine(fmt.Sprintf("[1/4] building image sandbox/%s\n", sandboxName))
	hardened := templates.Harden(dockerfile)
	stream, err := e.rt.Build(ctx, sandboxName, []byte(hardened))
	if err != nil {
		job.SetPhase(progress.PhaseFailed, "build: "+err.Error())
		writeLine(fmt.Sprintf("error: build failed: %s\n", err.Error()))
		return
	}
	buf := make([]byte, 4096)
	for {
		n, rerr := stream.Read(buf)
		if n > 0 {
			_, _ = sink.Write(buf[:n])
			if flush != nil {
				flush()
			}
		}
		if rerr != nil {
			break
		}
	}
	stream.Close()

	job.SetPhase(progress.PhaseStarting, "starting container")
	writeLine(fmt.Sprintf("[2/4] starting container %s\n", sandboxName))
	runSpec := e.specBuilder.Build(
		ctx,
		sandboxName,
		conn,
		map[string]string{pubkeyEnvVar: key.PublicKey},
		nil,
	)
	container, err := e.rt.Run(ctx, runSpec)
	if err != nil {
		job.SetPhase(progress.PhaseFailed, "start: "+err.Error())
		writeLine(fmt.Sprintf("error: start failed: %s\n", err.Error()))
		return
	}

	if err := e.syncConnectionHost(ctx, conn, sandboxName, container.IP, key.PrivateKey); err != nil {
		writeLine(fmt.Sprintf("warning: failed to refresh connection host: %s\n", err.Error()))
	}

	job.SetPhase(progress.PhaseWaiting, "waiting for sshd")
	writeLine(fmt.Sprintf("[3/4] waiting for %s to become ready\n", sandboxName))
	ready, waitErr := health.WaitForReady(ctx, e.rt, sandboxName, 60*time.Second)
	if waitErr != nil {
		job.SetPhase(progress.PhaseFailed, "readiness: "+waitErr.Error())
		writeLine(fmt.Sprintf("error: readiness check failed: %s\n", waitErr.Error()))
		writeLine(fmt.Sprintf("hint: run `runtimectl logs %s` to inspect container output\n", sandboxName))
		return
	}
	if ready.IP != "" && ready.IP != container.IP {
		if err := e.syncConnectionHost(ctx, conn, sandboxName, ready.IP, key.PrivateKey); err != nil {
			writeLine(fmt.Sprintf("warning: failed to refresh connection host: %s\n", err.Error()))
		}
	}
	container = ready

	job.SetPhase(progress.PhaseReady, fmt.Sprintf("running at %s", container.Host))
	writeLine(fmt.Sprintf("[4/4] container %s is %s at %s (ssh:22 reachable)\n", sandboxName, container.Status, container.Host))
	writeLine(fmt.Sprintf("READY %s\n", conn.Name))
}

func (e *Endpoints) sandboxStatus(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	snap, ok := e.progress.Get(name)
	if !ok {
		container, err := e.rt.Inspect(r.Context(), name)
		if err != nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"name":  name,
				"phase": "unknown",
			})
			return
		}
		phase := container.Status
		if phase == "running" {
			phase = progress.PhaseReady
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"name":  name,
			"phase": phase,
			"host":  container.Host,
			"ip":    container.IP,
		})
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

func (e *Endpoints) sandboxLogs(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	tail := 200
	if v := strings.TrimSpace(r.URL.Query().Get("tail")); v != "" {
		if v == "all" {
			tail = 0
		} else if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			tail = n
		}
	}
	follow := false
	switch strings.ToLower(strings.TrimSpace(r.URL.Query().Get("follow"))) {
	case "1", "true", "yes":
		follow = true
	}
	stream, err := e.rt.Logs(r.Context(), name, tail, follow)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer stream.Close()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, rerr := stream.Read(buf)
		if n > 0 {
			if _, werr := w.Write(buf[:n]); werr != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if rerr != nil {
			return
		}
	}
}

func (e *Endpoints) syncConnectionHost(ctx context.Context, conn types.Connection, sandboxName, ip, privateKey string) error {
	cfg, err := sshcfg.Build(sandboxName, ip, privateKey)
	if err != nil {
		return err
	}
	if string(conn.Config) == string(cfg) {
		return nil
	}
	conn.Config = cfg
	_, err = e.connectionStore.Update(ctx, []types.Connection{conn})
	return err
}

func imageNameFromConn(conn types.Connection) string {
	return strings.TrimPrefix(conn.Name, registeredConnectionPrefix)
}

func validateSandboxName(name string) error {
	if len(name) == 0 || len(name) > 48 {
		return fmt.Errorf("sandbox name must be 1-48 chars")
	}
	for _, r := range name {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-'
		if !ok {
			return fmt.Errorf("sandbox name may contain only lowercase letters, digits and dashes")
		}
	}
	return nil
}

func validateDockerfile(dockerfile string) error {
	lower := strings.ToLower(dockerfile)
	if strings.Contains(lower, "from sandbox/sandbox-base") {
		return nil
	}
	if strings.Contains(lower, "openssh-server") || strings.Contains(lower, "openssh") {
		return nil
	}
	return fmt.Errorf("dockerfile must either start with `FROM sandbox/sandbox-base:latest` (recommended — sshd, bash and the sandbox user are pre-installed) or explicitly install openssh-server (e.g. `RUN apk add --no-cache openssh-server bash <extra-packages>` on Alpine, `RUN apt-get update && apt-get install -y openssh-server bash <extra-packages>` on Debian/Ubuntu); without sshd the runtime cannot mount an SSH connection")
}

func (e *Endpoints) upsertSandboxConnection(ctx context.Context, input SandboxInput, key types.SandboxKey) (types.Connection, error) {
	connName := input.ConnectionName
	if connName == "" {
		connName = registeredConnectionPrefix + input.Name
	}

	profileIDs := input.ProfileIDs
	if profileIDs == nil {
		profileIDs = []string{}
	}

	config, err := sshcfg.Build(input.Name, "", key.PrivateKey)
	if err != nil {
		return types.Connection{}, err
	}

	existing, err := e.findConnectionByName(ctx, connName)
	if err != nil {
		return types.Connection{}, err
	}
	if existing != nil {
		existing.Description = input.Description
		existing.Config = config
		existing.ProfileIDs = profileIDs
		existing.Dockerfile = input.Dockerfile
		updated, uerr := e.connectionStore.Update(ctx, []types.Connection{*existing})
		if uerr != nil {
			return types.Connection{}, uerr
		}
		return updated[0], nil
	}
	conn := types.Connection{
		ID:            uuid.New().String(),
		Type:          "ssh",
		Name:          connName,
		Description:   input.Description,
		Config:        config,
		ProfileIDs:    profileIDs,
		Dockerfile:    input.Dockerfile,
		Memories:      []types.Memory{},
		MemoryEnabled: true,
	}
	created, cerr := e.connectionStore.Create(ctx, []types.Connection{conn})
	if cerr != nil {
		return types.Connection{}, cerr
	}
	return created[0], nil
}

func (e *Endpoints) findSandboxConnection(ctx context.Context, sandboxName string) (*types.Connection, error) {
	for _, n := range []string{sandboxName, registeredConnectionPrefix + sandboxName} {
		conn, err := e.findConnectionByName(ctx, n)
		if err != nil {
			return nil, err
		}
		if conn != nil && conn.Dockerfile != "" {
			return conn, nil
		}
	}
	return nil, fmt.Errorf("sandbox %q not found", sandboxName)
}

func (e *Endpoints) findConnectionByName(ctx context.Context, name string) (*types.Connection, error) {
	items, err := e.connectionStore.List(ctx, types.ListQuery{Filter: map[string]string{"name": name}, Page: types.Page{Limit: 1}})
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, nil
	}
	return &items[0], nil
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

package runtime

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"mantis/apps/runtime/health"
	"mantis/apps/runtime/keys"
	"mantis/apps/runtime/spec"
	"mantis/apps/runtime/sshcfg"
	"mantis/apps/runtime/templates"
	"mantis/core/protocols"
	"mantis/core/types"
)

const (
	dockerfileHashLabel = "sandbox.dockerfile_hash"
	pubkeyEnvVar        = "SANDBOX_SSH_PUBLIC_KEY"
)

type Bootstrapper struct {
	rt              protocols.Runtime
	connectionStore protocols.Store[string, types.Connection]
	keyIssuer       *keys.Issuer
	specBuilder     *spec.Builder
	envProvider     func(name string) map[string]string
}

func NewBootstrapper(
	rt protocols.Runtime,
	connectionStore protocols.Store[string, types.Connection],
	keyIssuer *keys.Issuer,
	specBuilder *spec.Builder,
) *Bootstrapper {
	return &Bootstrapper{
		rt:              rt,
		connectionStore: connectionStore,
		keyIssuer:       keyIssuer,
		specBuilder:     specBuilder,
	}
}

func (b *Bootstrapper) SetEnvProvider(p func(name string) map[string]string) {
	b.envProvider = p
}

func (b *Bootstrapper) Run(ctx context.Context) error {
	key, err := b.keyIssuer.Ensure(ctx)
	if err != nil {
		return fmt.Errorf("issue sandbox key: %w", err)
	}

	if err := b.ensureBaseImages(ctx); err != nil {
		log.Printf("runtime bootstrap: ensure base images: %v", err)
	}

	if err := b.seedBuiltins(ctx, key); err != nil {
		log.Printf("runtime bootstrap: seed builtins: %v", err)
	}

	conns, err := b.connectionStore.List(ctx, types.ListQuery{Page: types.Page{Limit: 1000}})
	if err != nil {
		return fmt.Errorf("list connections: %w", err)
	}
	for _, conn := range conns {
		if conn.Dockerfile == "" {
			continue
		}
		sandboxName := strings.TrimPrefix(conn.Name, "sb-")
		if err := b.ensureSandbox(ctx, conn, sandboxName, key); err != nil {
			log.Printf("runtime bootstrap: sandbox %s: %v", sandboxName, err)
		}
		// Reattach gateway every time. Running containers stay attached to
		// their per-sandbox networks across restarts of the gateway, but the
		// gateway itself loses those dynamic endpoint attachments when its
		// container is recreated. Without this re-sync the sandbox keeps
		// pointing its DNS at a stale IP and every lookup times out.
		if err := b.rt.EnsureGatewayAttached(ctx, sandboxName); err != nil {
			log.Printf("runtime bootstrap: gateway attach %s: %v", sandboxName, err)
		}
	}
	return nil
}

func (b *Bootstrapper) ensureBaseImages(ctx context.Context) error {
	bases, err := templates.Bases()
	if err != nil {
		return err
	}
	for _, t := range bases {
		hash := dockerfileHash(t.Dockerfile)
		if labels, err := b.rt.ImageLabels(ctx, t.Name); err == nil && labels != nil && labels[dockerfileHashLabel] == hash {
			continue
		}
		log.Printf("runtime bootstrap: building base image %s", t.Name)
		stream, err := b.rt.BuildWithLabels(ctx, t.Name, []byte(t.Dockerfile), map[string]string{dockerfileHashLabel: hash})
		if err != nil {
			log.Printf("runtime bootstrap: base %s build start: %v", t.Name, err)
			continue
		}
		if _, err := io.Copy(io.Discard, stream); err != nil {
			stream.Close()
			log.Printf("runtime bootstrap: base %s build stream: %v", t.Name, err)
			continue
		}
		stream.Close()
		log.Printf("runtime bootstrap: base image %s ready", t.Name)
	}
	return nil
}

func (b *Bootstrapper) seedBuiltins(ctx context.Context, key types.SandboxKey) error {
	tpls, err := templates.Builtin()
	if err != nil {
		return err
	}
	conns, err := b.connectionStore.List(ctx, types.ListQuery{Page: types.Page{Limit: 1000}})
	if err != nil {
		return err
	}
	byName := make(map[string]types.Connection, len(conns))
	for _, c := range conns {
		byName[c.Name] = c
	}
	for _, t := range tpls {
		config, _ := sshcfg.Build(t.Name, "", key.PrivateKey)
		existing, ok := byName[t.Name]
		if !ok {
			conn := types.Connection{
				ID:            uuid.New().String(),
				Type:          "ssh",
				Name:          t.Name,
				Description:   t.Description,
				Config:        config,
				ProfileIDs:    []string{t.ProfileID},
				Dockerfile:    t.Dockerfile,
				Memories:      []types.Memory{},
				MemoryEnabled: true,
			}
			if _, err := b.connectionStore.Create(ctx, []types.Connection{conn}); err != nil {
				log.Printf("runtime bootstrap: create builtin %s: %v", t.Name, err)
			} else {
				log.Printf("runtime bootstrap: seeded builtin %s", t.Name)
			}
			continue
		}
		if existing.Dockerfile == t.Dockerfile {
			continue
		}
		existing.Dockerfile = t.Dockerfile
		existing.Config = config
		if len(existing.ProfileIDs) == 0 {
			existing.ProfileIDs = []string{t.ProfileID}
		}
		if existing.Description == "" {
			existing.Description = t.Description
		}
		if _, err := b.connectionStore.Update(ctx, []types.Connection{existing}); err != nil {
			log.Printf("runtime bootstrap: resync builtin %s: %v", t.Name, err)
		} else {
			log.Printf("runtime bootstrap: resynced builtin %s", t.Name)
		}
	}
	return nil
}

func (b *Bootstrapper) RestartSandbox(ctx context.Context, sandboxName string) error {
	key, err := b.keyIssuer.Ensure(ctx)
	if err != nil {
		return fmt.Errorf("issue sandbox key: %w", err)
	}
	conns, err := b.connectionStore.List(ctx, types.ListQuery{Page: types.Page{Limit: 1000}})
	if err != nil {
		return err
	}
	var conn types.Connection
	found := false
	for _, c := range conns {
		if c.Name == sandboxName {
			conn = c
			found = true
			break
		}
	}
	if !found || conn.Dockerfile == "" {
		return fmt.Errorf("sandbox %q not found or has no dockerfile", sandboxName)
	}
	if err := b.rt.Stop(ctx, sandboxName); err != nil {
		log.Printf("runtime restart: stop %s: %v", sandboxName, err)
	}
	if err := b.rt.Remove(ctx, sandboxName); err != nil {
		log.Printf("runtime restart: remove %s: %v", sandboxName, err)
	}
	if err := b.ensureSandbox(ctx, conn, sandboxName, key); err != nil {
		return err
	}
	if err := b.rt.EnsureGatewayAttached(ctx, sandboxName); err != nil {
		log.Printf("runtime restart: gateway attach %s: %v", sandboxName, err)
	}
	return nil
}

func (b *Bootstrapper) ensureSandbox(ctx context.Context, conn types.Connection, sandboxName string, key types.SandboxKey) error {
	wantHash := dockerfileHash(conn.Dockerfile)
	container, err := b.rt.Inspect(ctx, sandboxName)
	if err == nil && container.Status == "running" && container.Labels[dockerfileHashLabel] == wantHash {
		if err := b.syncConnectionHost(ctx, conn, sandboxName, container.IP, key.PrivateKey); err != nil {
			log.Printf("runtime bootstrap: sync host %s: %v", sandboxName, err)
		}
		return nil
	}

	needBuild := true
	if labels, err := b.rt.ImageLabels(ctx, sandboxName); err == nil && labels != nil && labels[dockerfileHashLabel] == wantHash {
		needBuild = false
	} else if err != nil {
		log.Printf("runtime bootstrap: image labels %s: %v", sandboxName, err)
	}
	if needBuild {
		log.Printf("runtime bootstrap: building %s", sandboxName)
		stream, err := b.rt.BuildWithLabels(ctx, sandboxName, []byte(conn.Dockerfile), map[string]string{dockerfileHashLabel: wantHash})
		if err != nil {
			return fmt.Errorf("build: %w", err)
		}
		if _, err := io.Copy(io.Discard, stream); err != nil {
			stream.Close()
			return fmt.Errorf("build stream: %w", err)
		}
		stream.Close()
	}

	log.Printf("runtime bootstrap: starting %s", sandboxName)
	spec := b.specBuilder.Build(
		ctx,
		sandboxName,
		conn,
		b.envForSandbox(sandboxName, key.PublicKey),
		map[string]string{dockerfileHashLabel: wantHash},
	)
	started, err := b.rt.Run(ctx, spec)
	if err != nil {
		return fmt.Errorf("run: %w", err)
	}
	ready, waitErr := health.WaitForReady(ctx, b.rt, sandboxName, 60*time.Second)
	if waitErr != nil {
		log.Printf("runtime bootstrap: %s did not become ready: %v", sandboxName, waitErr)
	} else {
		started = ready
	}
	if err := b.syncConnectionHost(ctx, conn, sandboxName, started.IP, key.PrivateKey); err != nil {
		log.Printf("runtime bootstrap: sync host %s: %v", sandboxName, err)
	}
	return nil
}

func (b *Bootstrapper) syncConnectionHost(ctx context.Context, conn types.Connection, sandboxName, ip, privateKey string) error {
	cfg, err := sshcfg.Build(sandboxName, ip, privateKey)
	if err != nil {
		return err
	}
	if string(conn.Config) == string(cfg) {
		return nil
	}
	conn.Config = cfg
	_, err = b.connectionStore.Update(ctx, []types.Connection{conn})
	return err
}

func dockerfileHash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:8])
}

func (b *Bootstrapper) envForSandbox(name, publicKey string) map[string]string {
	env := map[string]string{pubkeyEnvVar: publicKey}
	if name == "runtimectl" {
		env["RUNTIMECTL_URL"] = "http://app:8080"
		env["RUNTIMECTL_TOKEN"] = os.Getenv("RUNTIME_API_TOKEN")
	}
	if b.envProvider != nil {
		for k, v := range b.envProvider(name) {
			env[k] = v
		}
	}
	return env
}

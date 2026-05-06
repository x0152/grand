package progress

import (
	"strings"
	"sync"
	"time"
)

const (
	PhaseQueued   = "queued"
	PhaseBuilding = "building"
	PhaseStarting = "starting"
	PhaseWaiting  = "waiting"
	PhaseReady    = "ready"
	PhaseFailed   = "failed"
)

type Snapshot struct {
	Name      string    `json:"name"`
	Phase     string    `json:"phase"`
	Message   string    `json:"message,omitempty"`
	Log       string    `json:"log,omitempty"`
	StartedAt time.Time `json:"startedAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type entry struct {
	mu        sync.Mutex
	phase     string
	message   string
	log       strings.Builder
	logLimit  int
	startedAt time.Time
	updatedAt time.Time
}

type Tracker struct {
	mu      sync.Mutex
	entries map[string]*entry
}

func NewTracker() *Tracker {
	return &Tracker{entries: make(map[string]*entry)}
}

func (t *Tracker) Begin(name string) *Job {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now().UTC()
	e := &entry{
		phase:     PhaseQueued,
		logLimit:  64 * 1024,
		startedAt: now,
		updatedAt: now,
	}
	t.entries[name] = e
	return &Job{tracker: t, name: name, entry: e}
}

func (t *Tracker) Get(name string) (Snapshot, bool) {
	t.mu.Lock()
	e, ok := t.entries[name]
	t.mu.Unlock()
	if !ok {
		return Snapshot{}, false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	return Snapshot{
		Name:      name,
		Phase:     e.phase,
		Message:   e.message,
		Log:       e.log.String(),
		StartedAt: e.startedAt,
		UpdatedAt: e.updatedAt,
	}, true
}

type Job struct {
	tracker *Tracker
	name    string
	entry   *entry
}

func (j *Job) Name() string { return j.name }

func (j *Job) SetPhase(phase, message string) {
	j.entry.mu.Lock()
	j.entry.phase = phase
	j.entry.message = message
	j.entry.updatedAt = time.Now().UTC()
	j.entry.mu.Unlock()
}

func (j *Job) Append(line string) {
	j.entry.mu.Lock()
	if j.entry.log.Len()+len(line) > j.entry.logLimit {
		current := j.entry.log.String()
		drop := j.entry.log.Len() + len(line) - j.entry.logLimit
		if drop < 0 {
			drop = 0
		}
		if drop > len(current) {
			drop = len(current)
		}
		current = current[drop:]
		j.entry.log.Reset()
		j.entry.log.WriteString(current)
	}
	j.entry.log.WriteString(line)
	j.entry.updatedAt = time.Now().UTC()
	j.entry.mu.Unlock()
}

func (j *Job) Write(p []byte) (int, error) {
	j.Append(string(p))
	return len(p), nil
}

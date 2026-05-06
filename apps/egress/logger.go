package egress

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"sync"
	"time"
)

type LogEntry struct {
	Time    string `json:"time"`
	Verdict string `json:"verdict"`
	Layer   string `json:"layer"`
	Sandbox string `json:"sandbox"`
	SrcIP   string `json:"src_ip"`
	Host    string `json:"host,omitempty"`
	QType   string `json:"qtype,omitempty"`
	DstIP   string `json:"dst_ip,omitempty"`
	Reason  string `json:"reason,omitempty"`
}

type EventSink interface {
	Notify(verdict string, entry LogEntry)
}

type Logger struct {
	mu    sync.Mutex
	out   io.Writer
	sinks []EventSink
}

func NewLogger() *Logger {
	return &Logger{out: os.Stdout}
}

func (l *Logger) AddSink(s EventSink) {
	if s == nil {
		return
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sinks = append(l.sinks, s)
}

func (l *Logger) Allow(e LogEntry) { l.write("allow", e) }
func (l *Logger) Block(e LogEntry) { l.write("block", e) }

func (l *Logger) write(verdict string, e LogEntry) {
	e.Verdict = verdict
	if e.Time == "" {
		e.Time = time.Now().UTC().Format(time.RFC3339Nano)
	}
	raw, err := json.Marshal(e)
	if err != nil {
		log.Printf("egress logger: marshal: %v", err)
		return
	}
	l.mu.Lock()
	_, _ = l.out.Write(append(raw, '\n'))
	sinks := append([]EventSink(nil), l.sinks...)
	l.mu.Unlock()
	// Block events must land in the guard store before the agent fetches the
	// command's egress footer. Allow events are noisy and never read on the hot
	// path, so we keep them async.
	if verdict == "block" {
		for _, s := range sinks {
			s.Notify(verdict, e)
		}
		return
	}
	for _, s := range sinks {
		go s.Notify(verdict, e)
	}
}

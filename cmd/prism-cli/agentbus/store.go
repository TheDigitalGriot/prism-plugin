package agentbus

import (
	"fmt"
	"sync"
	"time"

	"github.com/prism-plugin/prism-cli/app/adapter"
	"github.com/prism-plugin/prism-cli/app/chat"
)

// Store manages all active and historical managed sessions.
type Store struct {
	mu             sync.RWMutex
	activeSessions map[string]*ManagedSession // sessionID → session
	bus            *Bus
	counter        int // monotonic counter for unique IDs
}

// NewStore creates a Store backed by the given Bus.
func NewStore(bus *Bus) *Store {
	return &Store{
		activeSessions: make(map[string]*ManagedSession),
		bus:            bus,
	}
}

// Create registers a new in-memory session for a given project directory.
// It generates a unique session ID and publishes EventSessionCreated.
func (s *Store) Create(projectDir string) *ManagedSession {
	s.mu.Lock()
	s.counter++
	id := fmt.Sprintf("session-%d-%d", time.Now().UnixMilli(), s.counter)
	ms := &ManagedSession{
		Session: adapter.Session{
			ID:          id,
			ProjectPath: projectDir,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			Adapter:     "claude",
		},
		State:    SessionActive,
		Messages: []chat.Message{},
	}
	s.activeSessions[id] = ms
	s.mu.Unlock()

	s.bus.Publish(Event{
		Type:      EventSessionCreated,
		Timestamp: time.Now(),
		SessionID: id,
	})

	return ms
}

// Get retrieves a managed session by ID. Returns nil if not found.
func (s *Store) Get(sessionID string) *ManagedSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeSessions[sessionID]
}

// AddMessage appends a message to an existing session's in-memory buffer.
func (s *Store) AddMessage(sessionID string, msg chat.Message) {
	s.mu.Lock()
	ms, ok := s.activeSessions[sessionID]
	if ok {
		ms.Messages = append(ms.Messages, msg)
		ms.Session.UpdatedAt = time.Now()
		ms.Session.MessageCount = len(ms.Messages)
	}
	s.mu.Unlock()
}

// UpdateState changes the state of an existing session.
func (s *Store) UpdateState(sessionID string, state SessionState) {
	s.mu.Lock()
	if ms, ok := s.activeSessions[sessionID]; ok {
		ms.State = state
	}
	s.mu.Unlock()
}

// List returns a snapshot of all managed sessions.
func (s *Store) List() []*ManagedSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*ManagedSession, 0, len(s.activeSessions))
	for _, ms := range s.activeSessions {
		out = append(out, ms)
	}
	return out
}

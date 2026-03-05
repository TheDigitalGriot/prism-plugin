package agentbus

import "sync"

// Bus is a thread-safe publish/subscribe event bus.
// It is transport-agnostic — no Bubble Tea or UI imports.
type Bus struct {
	mu          sync.RWMutex
	subscribers []func(Event)
}

// New creates a new Bus.
func New() *Bus {
	return &Bus{}
}

// Publish broadcasts an event to all current subscribers.
// Runs each handler in a separate goroutine to avoid blocking the publisher.
func (b *Bus) Publish(event Event) {
	b.mu.RLock()
	subs := make([]func(Event), len(b.subscribers))
	copy(subs, b.subscribers)
	b.mu.RUnlock()

	for _, sub := range subs {
		sub := sub
		go sub(event)
	}
}

// Subscribe registers a handler and returns an unsubscribe function.
func (b *Bus) Subscribe(handler func(Event)) (unsubscribe func()) {
	b.mu.Lock()
	b.subscribers = append(b.subscribers, handler)
	idx := len(b.subscribers) - 1
	b.mu.Unlock()

	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		// Remove by index — replace with last element and shrink.
		last := len(b.subscribers) - 1
		if idx <= last {
			b.subscribers[idx] = b.subscribers[last]
			b.subscribers[last] = nil
			b.subscribers = b.subscribers[:last]
		}
	}
}

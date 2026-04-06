package agentbus

// EventConsumer defines how a platform-specific receiver handles bus events (Phase 19).
// Implementations can deliver events to a Bubble Tea channel, a gRPC stream,
// a WebSocket connection, or any other transport.
type EventConsumer interface {
	// OnEvent is called for each event published on the bus.
	// Implementations must not block; use a buffered channel or goroutine if needed.
	OnEvent(event Event)
	// Close releases any resources held by the consumer.
	Close()
}

// ChannelConsumer routes events into a Go channel (the Bubble Tea bridge pattern).
// It is the concrete consumer used by the TUI.
type ChannelConsumer struct {
	ch chan Event
}

// NewChannelConsumer creates a ChannelConsumer backed by a buffered channel of size `buf`.
func NewChannelConsumer(buf int) *ChannelConsumer {
	return &ChannelConsumer{ch: make(chan Event, buf)}
}

// OnEvent sends the event to the channel non-blockingly (drops on overflow).
func (c *ChannelConsumer) OnEvent(event Event) {
	select {
	case c.ch <- event:
	default:
		// Channel full — drop to avoid blocking the bus goroutine.
	}
}

// Chan returns the receive-only channel for use in Bubble Tea Cmds.
func (c *ChannelConsumer) Chan() <-chan Event { return c.ch }

// Close closes the underlying channel so receivers can detect shutdown.
func (c *ChannelConsumer) Close() { close(c.ch) }

// RegisterConsumer wires a consumer to the bus: every published event calls consumer.OnEvent.
// Returns an unsubscribe function.
func RegisterConsumer(bus *Bus, consumer EventConsumer) (unsubscribe func()) {
	return bus.Subscribe(func(e Event) {
		consumer.OnEvent(e)
	})
}

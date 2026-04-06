package agentbus

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestBusPublishReceived(t *testing.T) {
	b := New()
	var got Event
	var wg sync.WaitGroup
	wg.Add(1)

	b.Subscribe(func(e Event) {
		got = e
		wg.Done()
	})

	b.Publish(Event{Type: EventTextDelta, Text: "hello"})
	wg.Wait()

	if got.Type != EventTextDelta || got.Text != "hello" {
		t.Fatalf("unexpected event: %+v", got)
	}
}

func TestBusUnsubscribe(t *testing.T) {
	b := New()
	var count int32

	unsub := b.Subscribe(func(e Event) {
		atomic.AddInt32(&count, 1)
	})

	b.Publish(Event{Type: EventTextDelta})
	time.Sleep(20 * time.Millisecond)

	unsub()
	b.Publish(Event{Type: EventTextDelta})
	time.Sleep(20 * time.Millisecond)

	if atomic.LoadInt32(&count) != 1 {
		t.Fatalf("expected 1 delivery, got %d", count)
	}
}

func TestBusConcurrentSafe(t *testing.T) {
	b := New()
	var received int64
	var wg sync.WaitGroup

	const subs = 10
	const pubs = 100

	for i := 0; i < subs; i++ {
		b.Subscribe(func(e Event) {
			atomic.AddInt64(&received, 1)
		})
	}

	for i := 0; i < pubs; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			b.Publish(Event{Type: EventTextDelta})
		}()
	}

	wg.Wait()
	time.Sleep(50 * time.Millisecond) // let goroutines finish

	expected := int64(subs * pubs)
	if atomic.LoadInt64(&received) != expected {
		t.Fatalf("expected %d deliveries, got %d", expected, received)
	}
}

package agentbus

import (
	"testing"

	"github.com/prism-plugin/prism-cli/app/chat"
)

func TestStoreCreate(t *testing.T) {
	b := New()
	s := NewStore(b)

	ms1 := s.Create("/project/a")
	ms2 := s.Create("/project/b")

	if ms1.Session.ID == ms2.Session.ID {
		t.Fatal("expected unique session IDs")
	}
	if ms1.Session.ProjectPath != "/project/a" {
		t.Fatalf("wrong project path: %s", ms1.Session.ProjectPath)
	}
}

func TestStoreAddMessage(t *testing.T) {
	b := New()
	s := NewStore(b)

	ms := s.Create("/project")
	id := ms.Session.ID

	s.AddMessage(id, chat.Message{Type: chat.MessageTypeUser, Content: "hello"})
	s.AddMessage(id, chat.Message{Type: chat.MessageTypeAssistant, Content: "world"})

	got := s.Get(id)
	if got == nil {
		t.Fatal("session not found")
	}
	if len(got.Messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(got.Messages))
	}
}

func TestStoreList(t *testing.T) {
	b := New()
	s := NewStore(b)

	s.Create("/a")
	s.Create("/b")
	s.Create("/c")

	list := s.List()
	if len(list) != 3 {
		t.Fatalf("expected 3 sessions, got %d", len(list))
	}
}

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// mockBroker stands up a WS server that speaks the broker dialect:
// hello -> welcome (with one service), then request -> response (echo).
func mockBroker(t *testing.T) (url string, closeFn func()) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		ctx := r.Context()

		var hello map[string]json.RawMessage
		if err := wsjson.Read(ctx, conn, &hello); err != nil {
			return
		}
		_ = wsjson.Write(ctx, conn, map[string]any{
			"type":          "welcome",
			"brokerVersion": "0.1.0",
			"sessionId":     "sess-1",
			"capabilities":  []any{},
			"services": []map[string]any{
				{"id": "code-intel", "name": "Code Intelligence", "status": "ready", "adapterType": "stdio-mcp", "capabilities": []any{}},
			},
		})

		for {
			var raw map[string]json.RawMessage
			if err := wsjson.Read(ctx, conn, &raw); err != nil {
				return
			}
			var id string
			_ = json.Unmarshal(raw["id"], &id)
			_ = wsjson.Write(ctx, conn, map[string]any{
				"type":   "response",
				"id":     id,
				"ok":     true,
				"result": map[string]any{"echo": "ok"},
			})
		}
	}))
	url = "ws" + strings.TrimPrefix(srv.URL, "http")
	return url, srv.Close
}

func TestDialReceivesRegistry(t *testing.T) {
	url, closeFn := mockBroker(t)
	defer closeFn()

	c, err := Dial(context.Background(), url)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.Close()

	if c.BrokerVersion != "0.1.0" {
		t.Errorf("brokerVersion = %q, want 0.1.0", c.BrokerVersion)
	}
	if len(c.Services) != 1 || c.Services[0].ID != "code-intel" {
		t.Fatalf("services = %+v, want one code-intel", c.Services)
	}
	if c.Services[0].Status != "ready" {
		t.Errorf("status = %q, want ready", c.Services[0].Status)
	}
}

func TestCallRoundTrip(t *testing.T) {
	url, closeFn := mockBroker(t)
	defer closeFn()

	c, err := Dial(context.Background(), url)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.Close()

	res, err := c.Call("code-intel", "search_graph", map[string]any{"q": "auth"})
	if err != nil {
		t.Fatalf("call: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(res, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if m["echo"] != "ok" {
		t.Errorf("result = %s, want echo:ok", res)
	}
}

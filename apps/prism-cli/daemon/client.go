// Package daemon is a thin Go WebSocket client for the Prism daemon-broker.
// It speaks the same envelope the TS client does (hello/welcome, request/response,
// service_stream). Hand-written (Option A from the plan) so the Go TUI is a
// first-class real-time broker client with no Node runtime dependency.
package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

const (
	connectTimeout = 5 * time.Second
	callTimeout    = 60 * time.Second
)

// SkillManifestEntry mirrors the broker's capability entry.
type SkillManifestEntry struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Methods     []string `json:"methods"`
}

// ServiceDescriptor is the client view of a brokered service.
type ServiceDescriptor struct {
	ID           string               `json:"id"`
	Name         string               `json:"name"`
	Status       string               `json:"status"`
	AdapterType  string               `json:"adapterType,omitempty"`
	Capabilities []SkillManifestEntry `json:"capabilities"`
}

// Client is a connected daemon-broker client.
type Client struct {
	conn          *websocket.Conn
	ctx           context.Context
	cancel        context.CancelFunc
	SessionID     string
	BrokerVersion string
	Services      []ServiceDescriptor
	nextID        int64
}

type welcomeMsg struct {
	BrokerVersion string              `json:"brokerVersion"`
	SessionID     string              `json:"sessionId"`
	Services      []ServiceDescriptor `json:"services"`
}

type responseMsg struct {
	ID     string          `json:"id"`
	OK     bool            `json:"ok"`
	Result json.RawMessage `json:"result"`
	Error  *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type envelope struct {
	ID      string `json:"id"`
	Service string `json:"service"`
	Method  string `json:"method"`
	Payload any    `json:"payload,omitempty"`
	Ts      int64  `json:"ts"`
}

func readRaw(ctx context.Context, conn *websocket.Conn) (map[string]json.RawMessage, string, error) {
	var raw map[string]json.RawMessage
	if err := wsjson.Read(ctx, conn, &raw); err != nil {
		return nil, "", err
	}
	var typ string
	if b, ok := raw["type"]; ok {
		_ = json.Unmarshal(b, &typ)
	}
	return raw, typ, nil
}

func remarshal(raw map[string]json.RawMessage, v any) error {
	b, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// Dial connects to the broker and completes the hello/welcome handshake.
func Dial(ctx context.Context, url string) (*Client, error) {
	cctx, cancel := context.WithCancel(ctx)
	conn, _, err := websocket.Dial(cctx, url, nil)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("dial: %w", err)
	}
	// The broker's welcome ships the full registry snapshot; capability manifests
	// (e.g. code-intel's tools/list) push it past coder/websocket's 32 KiB default
	// read limit. Raise to 1 MiB so `daemon ls` can read the welcome.
	conn.SetReadLimit(1 << 20)
	c := &Client{conn: conn, ctx: cctx, cancel: cancel}

	hello := map[string]any{"type": "hello", "clientId": "prism-cli", "version": "0.1.0"}
	if err := wsjson.Write(cctx, conn, hello); err != nil {
		_ = c.Close()
		return nil, fmt.Errorf("hello: %w", err)
	}

	deadline, dcancel := context.WithTimeout(cctx, connectTimeout)
	defer dcancel()
	for {
		raw, typ, err := readRaw(deadline, conn)
		if err != nil {
			_ = c.Close()
			return nil, fmt.Errorf("await welcome: %w", err)
		}
		if typ != "welcome" {
			continue
		}
		var w welcomeMsg
		if err := remarshal(raw, &w); err != nil {
			_ = c.Close()
			return nil, err
		}
		c.SessionID = w.SessionID
		c.BrokerVersion = w.BrokerVersion
		c.Services = w.Services
		return c, nil
	}
}

// Call sends a unary request and returns the raw JSON result.
func (c *Client) Call(service, method string, payload any) (json.RawMessage, error) {
	id := fmt.Sprintf("req-%d", atomic.AddInt64(&c.nextID, 1))
	env := envelope{ID: id, Service: service, Method: method, Payload: payload, Ts: time.Now().UnixMilli()}
	if err := wsjson.Write(c.ctx, c.conn, env); err != nil {
		return nil, fmt.Errorf("write: %w", err)
	}

	deadline, dcancel := context.WithTimeout(c.ctx, callTimeout)
	defer dcancel()
	for {
		raw, typ, err := readRaw(deadline, c.conn)
		if err != nil {
			return nil, err
		}
		if typ != "response" {
			continue // ignore interleaved service_stream / service_update frames
		}
		var r responseMsg
		if err := remarshal(raw, &r); err != nil {
			return nil, err
		}
		if r.ID != id {
			continue
		}
		if !r.OK {
			if r.Error != nil {
				return nil, fmt.Errorf("%s: %s", r.Error.Code, r.Error.Message)
			}
			return nil, fmt.Errorf("call to %s.%s failed", service, method)
		}
		return r.Result, nil
	}
}

// Close terminates the connection.
func (c *Client) Close() error {
	err := c.conn.Close(websocket.StatusNormalClosure, "")
	c.cancel()
	return err
}

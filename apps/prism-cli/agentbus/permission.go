package agentbus

// PermissionRequest is emitted when Claude CLI needs approval before running a tool.
type PermissionRequest struct {
	ID          string // Unique request ID
	ToolName    string // Tool requesting permission (e.g., "Bash")
	Description string // Human-readable description of what the tool will do
	Preview     string // Command text or file diff shown to the user
	SessionID   string // Session this request belongs to
}

// PermissionResponse carries the user's decision back to the Claude CLI subprocess.
type PermissionResponse struct {
	RequestID string // Matches PermissionRequest.ID
	Action    string // "allow", "allow_session", "deny"
}

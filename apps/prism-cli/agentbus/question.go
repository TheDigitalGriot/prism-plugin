package agentbus

// QuestionRequest is emitted when Claude invokes the AskUserQuestion tool.
type QuestionRequest struct {
	ID        string     // Unique request ID
	SessionID string     // Session this request belongs to
	Questions []Question // One or more questions to present
}

// Question is a single question with optional multiple-choice options.
type Question struct {
	Text        string           // The question text
	Header      string           // Short label/header chip (max 12 chars)
	Options     []QuestionOption // Available choices (empty = free-text)
	MultiSelect bool             // Whether multiple options can be chosen
}

// QuestionOption is a single selectable option within a Question.
type QuestionOption struct {
	Label       string // Display text
	Description string // Explanation shown to the user
}

// QuestionResponse carries the user's answers back to the Claude CLI subprocess.
type QuestionResponse struct {
	RequestID string            // Matches QuestionRequest.ID
	Answers   map[string]string // question text → selected answer label
	Skipped   bool              // True if the user pressed Escape
}

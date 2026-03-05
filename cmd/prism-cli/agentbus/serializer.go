package agentbus

import "encoding/json"

// ToJSON serializes an Event to JSON for cross-platform transport (Phase 19).
func (e *Event) ToJSON() ([]byte, error) {
	return json.Marshal(e)
}

// FromJSON deserializes a JSON payload into an Event.
func FromJSON(data []byte) (*Event, error) {
	var e Event
	if err := json.Unmarshal(data, &e); err != nil {
		return nil, err
	}
	return &e, nil
}

package ui

import "testing"

func TestCalculatePaneWidths_DefaultRatio(t *testing.T) {
	pw := CalculatePaneWidths(100, 30, 25, 40)

	// inner = 99 (100 - 1 divider); left = 29 (floor of 30%), right = 70
	if pw.Divider != 1 {
		t.Errorf("Divider: want 1, got %d", pw.Divider)
	}
	if pw.Available != 100 {
		t.Errorf("Available: want 100, got %d", pw.Available)
	}
	total := pw.Left + pw.Right + pw.Divider
	if total != 100 {
		t.Errorf("Left(%d) + Right(%d) + Divider(%d) = %d, want 100", pw.Left, pw.Right, pw.Divider, total)
	}
	if pw.Left < 25 {
		t.Errorf("Left %d below minLeft 25", pw.Left)
	}
	if pw.Right < 40 {
		t.Errorf("Right %d below minRight 40", pw.Right)
	}
}

func TestCalculatePaneWidths_MinLeftEnforced(t *testing.T) {
	// Narrow terminal: ratio would give left=10 but minLeft=25
	pw := CalculatePaneWidths(80, 10, 25, 40)

	if pw.Left < 25 {
		t.Errorf("Left %d below minLeft 25", pw.Left)
	}
	if pw.Right < 40 {
		t.Errorf("Right %d below minRight 40", pw.Right)
	}
}

func TestCalculatePaneWidths_VeryNarrow(t *testing.T) {
	// When available is too narrow for both minimums, each gets its minimum.
	pw := CalculatePaneWidths(60, 30, 25, 40)

	// inner = 59 < 25+40=65, so fallback to minimums
	if pw.Left != 25 {
		t.Errorf("Left: want 25, got %d", pw.Left)
	}
	if pw.Right != 40 {
		t.Errorf("Right: want 40, got %d", pw.Right)
	}
}

func TestCalculatePaneWidths_WideTerminal(t *testing.T) {
	pw := CalculatePaneWidths(200, 30, 25, 40)

	if pw.Left < 25 {
		t.Errorf("Left %d below minLeft", pw.Left)
	}
	if pw.Right < 40 {
		t.Errorf("Right %d below minRight", pw.Right)
	}
	total := pw.Left + pw.Right + pw.Divider
	if total != 200 {
		t.Errorf("Widths don't sum to 200: got %d", total)
	}
}

func TestCalculatePaneWidths_HalfSplit(t *testing.T) {
	pw := CalculatePaneWidths(120, 50, 10, 10)

	// inner = 119, left ≈ 59, right = 60
	total := pw.Left + pw.Right + pw.Divider
	if total != 120 {
		t.Errorf("Widths don't sum to 120: got %d", total)
	}
}

func TestFocusPaneConstants(t *testing.T) {
	if PaneLeft == PaneRight {
		t.Error("PaneLeft and PaneRight must be distinct")
	}
	if PaneLeft != 0 {
		t.Errorf("PaneLeft: want 0, got %d", PaneLeft)
	}
	if PaneRight != 1 {
		t.Errorf("PaneRight: want 1, got %d", PaneRight)
	}
}

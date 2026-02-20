package diff

import (
	"strings"
	"testing"
)

func TestRenderLineDiff_NilDiff(t *testing.T) {
	result := RenderLineDiff(nil, 80, 0, 50, 0, nil, false)
	if !strings.Contains(result, "No diff content") {
		t.Errorf("nil diff should show 'No diff content', got %q", result)
	}
}

func TestRenderLineDiff_BinaryDiff(t *testing.T) {
	parsed := &ParsedDiff{Binary: true}
	result := RenderLineDiff(parsed, 80, 0, 50, 0, nil, false)
	if !strings.Contains(result, "Binary file differs") {
		t.Errorf("binary diff should show 'Binary file differs', got %q", result)
	}
}

func TestRenderLineDiff_BasicOutput(t *testing.T) {
	parsed, _ := ParseUnifiedDiff(sampleDiff)
	result := RenderLineDiff(parsed, 80, 0, 50, 0, nil, false)

	if result == "" {
		t.Error("rendered diff should not be empty")
	}
	// Should contain hunk header marker
	if !strings.Contains(result, "@@") {
		t.Error("should contain hunk header @@")
	}
	// Should contain line numbers
	if !strings.Contains(result, "10") {
		t.Error("should contain line number 10")
	}
}

func TestRenderLineDiff_MaxLinesRespected(t *testing.T) {
	parsed, _ := ParseUnifiedDiff(sampleDiff)
	result := RenderLineDiff(parsed, 80, 0, 3, 0, nil, false)
	lines := strings.Split(strings.TrimSuffix(result, "\n"), "\n")
	if len(lines) > 3 {
		t.Errorf("maxLines=3 but got %d lines", len(lines))
	}
}

func TestRenderSideBySide_NilDiff(t *testing.T) {
	result := RenderSideBySide(nil, 120, 0, 50, 0, nil, false)
	if !strings.Contains(result, "No diff content") {
		t.Errorf("nil diff should show 'No diff content', got %q", result)
	}
}

func TestRenderSideBySide_BasicOutput(t *testing.T) {
	parsed, _ := ParseUnifiedDiff(sampleDiff)
	result := RenderSideBySide(parsed, 120, 0, 50, 0, nil, false)

	if result == "" {
		t.Error("side-by-side output should not be empty")
	}
	// Should contain vertical separator between panels
	if !strings.Contains(result, "│") {
		t.Error("should contain panel separator │")
	}
}

func TestGroupLinesForSideBySide_Pairing(t *testing.T) {
	lines := []DiffLine{
		{Type: LineContext, Content: "context"},
		{Type: LineRemove, Content: "old"},
		{Type: LineAdd, Content: "new"},
		{Type: LineContext, Content: "more context"},
	}

	pairs := groupLinesForSideBySide(lines)
	if len(pairs) != 3 {
		t.Fatalf("want 3 pairs, got %d", len(pairs))
	}

	// First: context on both sides
	if pairs[0].left == nil || pairs[0].right == nil {
		t.Error("context pair should have both sides")
	}

	// Second: remove/add pair
	if pairs[1].left == nil || pairs[1].right == nil {
		t.Error("remove/add pair should have both sides")
	}
	if pairs[1].left.Type != LineRemove {
		t.Error("left of pair should be remove")
	}
	if pairs[1].right.Type != LineAdd {
		t.Error("right of pair should be add")
	}

	// Third: trailing context
	if pairs[2].left == nil || pairs[2].right == nil {
		t.Error("trailing context should have both sides")
	}
}

func TestGroupLinesForSideBySide_UnevenPairs(t *testing.T) {
	lines := []DiffLine{
		{Type: LineRemove, Content: "old1"},
		{Type: LineRemove, Content: "old2"},
		{Type: LineAdd, Content: "new1"},
	}

	pairs := groupLinesForSideBySide(lines)
	// 2 removes, 1 add → 2 pairs (second pair has left only)
	if len(pairs) != 2 {
		t.Fatalf("want 2 pairs, got %d", len(pairs))
	}
	if pairs[1].left == nil {
		t.Error("second pair should have left (second remove)")
	}
	if pairs[1].right != nil {
		t.Error("second pair should have nil right (no matching add)")
	}
}

func TestRenderFileHeader(t *testing.T) {
	header := RenderFileHeader("main.go", "+5/-3", 60)
	if !strings.Contains(header, "main.go") {
		t.Error("file header should contain filename")
	}
	if !strings.Contains(header, "+5/-3") {
		t.Error("file header should contain stats")
	}
}

func TestRenderMultiFileDiff_NilDiff(t *testing.T) {
	result := RenderMultiFileDiff(nil, DiffViewUnified, 80, 0, 50, 0, false)
	if !strings.Contains(result, "No diff content") {
		t.Errorf("nil multi-file diff should show 'No diff content', got %q", result)
	}
}

func TestRenderMultiFileDiff_BasicOutput(t *testing.T) {
	mfd := ParseMultiFileDiff(multiFileDiff)
	result := RenderMultiFileDiff(mfd, DiffViewUnified, 80, 0, 100, 0, false)

	if result == "" {
		t.Error("multi-file diff output should not be empty")
	}
	// Should contain both filenames
	if !strings.Contains(result, "foo.go") {
		t.Error("should contain foo.go")
	}
	if !strings.Contains(result, "bar.go") {
		t.Error("should contain bar.go")
	}
}

func TestTruncateLine(t *testing.T) {
	s := "hello world"
	got := truncateLine(s, 8)
	if len(got) > 8 {
		t.Errorf("truncateLine(8) result too long: %q", got)
	}
}

func TestTruncateLine_Short(t *testing.T) {
	s := "hi"
	got := truncateLine(s, 10)
	if got != "hi" {
		t.Errorf("short string should not be truncated, got %q", got)
	}
}

func TestPadRight(t *testing.T) {
	got := padRight("hi", 5)
	if got != "hi   " {
		t.Errorf("padRight: want %q, got %q", "hi   ", got)
	}
}

func TestPadToWidth(t *testing.T) {
	got := padToWidth("ab", 4)
	if got != "ab  " {
		t.Errorf("padToWidth: want %q, got %q", "ab  ", got)
	}
}

func TestTruncateLeft(t *testing.T) {
	got := truncateLeft("abcdef", 2)
	if got != "cdef" {
		t.Errorf("truncateLeft(2): want %q, got %q", "cdef", got)
	}
}

func TestTruncateLeft_Zero(t *testing.T) {
	got := truncateLeft("hello", 0)
	if got != "hello" {
		t.Errorf("truncateLeft(0): want %q, got %q", "hello", got)
	}
}

func TestSyntaxHighlighter_GoFile(t *testing.T) {
	h := NewSyntaxHighlighter("main.go")
	if h == nil {
		t.Fatal("expected non-nil highlighter for .go file")
	}
	segments := h.HighlightLine("func main() {")
	if len(segments) == 0 {
		t.Error("expected non-empty highlight segments")
	}
	// "func" should be a keyword with some style
	found := false
	for _, seg := range segments {
		if strings.Contains(seg.Text, "func") {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected 'func' keyword in highlight segments")
	}
}

func TestSyntaxHighlighter_UnknownFile(t *testing.T) {
	h := NewSyntaxHighlighter("random.xyzabc")
	if h != nil {
		t.Error("expected nil highlighter for unknown file type")
	}
}

func TestGetSideBySideClipInfo_NilDiff(t *testing.T) {
	info := GetSideBySideClipInfo(nil, 40, 0)
	if info.HasMoreLeft || info.HasMoreRight || info.MaxContentWidth != 0 {
		t.Error("nil diff clip info should be zero-value")
	}
}

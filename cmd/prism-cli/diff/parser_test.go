package diff

import (
	"strings"
	"testing"
)

const sampleDiff = `diff --git a/main.go b/main.go
index abc1234..def5678 100644
--- a/main.go
+++ b/main.go
@@ -10,7 +10,8 @@ func main() {
 	fmt.Println("hello")
 	x := 1
-	y := 2
+	y := 3
+	z := 4
 	fmt.Println(x)
 }
`

const multiFileDiff = `diff --git a/foo.go b/foo.go
--- a/foo.go
+++ b/foo.go
@@ -1,3 +1,3 @@
 package foo
-var x = 1
+var x = 2
diff --git a/bar.go b/bar.go
--- a/bar.go
+++ b/bar.go
@@ -1,3 +1,4 @@
 package bar
 var a = 1
+var b = 2
`

const binaryDiff = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ
`

func TestParseUnifiedDiff_Basic(t *testing.T) {
	parsed, err := ParseUnifiedDiff(sampleDiff)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed == nil {
		t.Fatal("parsed is nil")
	}
	if parsed.Binary {
		t.Error("should not be binary")
	}
	if parsed.OldFile != "main.go" {
		t.Errorf("OldFile: want main.go, got %q", parsed.OldFile)
	}
	if parsed.NewFile != "main.go" {
		t.Errorf("NewFile: want main.go, got %q", parsed.NewFile)
	}
	if len(parsed.Hunks) != 1 {
		t.Fatalf("want 1 hunk, got %d", len(parsed.Hunks))
	}

	hunk := parsed.Hunks[0]
	if hunk.OldStart != 10 || hunk.OldCount != 7 {
		t.Errorf("hunk old: want -10,7, got -%d,%d", hunk.OldStart, hunk.OldCount)
	}
	if hunk.NewStart != 10 || hunk.NewCount != 8 {
		t.Errorf("hunk new: want +10,8, got +%d,%d", hunk.NewStart, hunk.NewCount)
	}

	// Count line types
	adds, removes, ctx := 0, 0, 0
	for _, line := range hunk.Lines {
		switch line.Type {
		case LineAdd:
			adds++
		case LineRemove:
			removes++
		case LineContext:
			ctx++
		}
	}
	if adds != 2 {
		t.Errorf("want 2 adds, got %d", adds)
	}
	if removes != 1 {
		t.Errorf("want 1 remove, got %d", removes)
	}
	if ctx < 3 {
		t.Errorf("want at least 3 context lines, got %d", ctx)
	}
}

func TestParseUnifiedDiff_Binary(t *testing.T) {
	parsed, err := ParseUnifiedDiff(binaryDiff)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !parsed.Binary {
		t.Error("should be binary")
	}
}

func TestParseUnifiedDiff_Empty(t *testing.T) {
	parsed, err := ParseUnifiedDiff("")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if parsed.Binary {
		t.Error("empty diff should not be binary")
	}
	if len(parsed.Hunks) != 0 {
		t.Errorf("empty diff should have 0 hunks, got %d", len(parsed.Hunks))
	}
}

func TestParseUnifiedDiff_LineNumbers(t *testing.T) {
	parsed, err := ParseUnifiedDiff(sampleDiff)
	if err != nil {
		t.Fatal(err)
	}

	hunk := parsed.Hunks[0]
	// First context line should start at old=10, new=10
	first := hunk.Lines[0]
	if first.OldLineNo != 10 {
		t.Errorf("first line OldLineNo: want 10, got %d", first.OldLineNo)
	}
	if first.NewLineNo != 10 {
		t.Errorf("first line NewLineNo: want 10, got %d", first.NewLineNo)
	}

	// Find the remove line (y := 2)
	for _, line := range hunk.Lines {
		if line.Type == LineRemove {
			if line.OldLineNo == 0 {
				t.Error("remove line should have OldLineNo > 0")
			}
			if line.NewLineNo != 0 {
				t.Error("remove line should have NewLineNo = 0")
			}
			break
		}
	}
}

func TestParseUnifiedDiff_WordDiffs(t *testing.T) {
	parsed, err := ParseUnifiedDiff(sampleDiff)
	if err != nil {
		t.Fatal(err)
	}

	hunk := parsed.Hunks[0]
	// The remove/add pair (y := 2 → y := 3) should get word diffs
	for _, line := range hunk.Lines {
		if line.Type == LineRemove && strings.Contains(line.Content, "y") {
			if len(line.WordDiff) == 0 {
				t.Error("expected word diff on remove line for 'y := 2'")
			}
			break
		}
	}
}

func TestParseMultiFileDiff(t *testing.T) {
	mfd := ParseMultiFileDiff(multiFileDiff)
	if mfd == nil {
		t.Fatal("result is nil")
	}
	if len(mfd.Files) != 2 {
		t.Fatalf("want 2 files, got %d", len(mfd.Files))
	}

	// First file
	f0 := mfd.Files[0]
	if f0.FileName() != "foo.go" {
		t.Errorf("file 0 name: want foo.go, got %q", f0.FileName())
	}
	if f0.Additions != 1 || f0.Deletions != 1 {
		t.Errorf("file 0 stats: want +1/-1, got +%d/-%d", f0.Additions, f0.Deletions)
	}

	// Second file
	f1 := mfd.Files[1]
	if f1.FileName() != "bar.go" {
		t.Errorf("file 1 name: want bar.go, got %q", f1.FileName())
	}
	if f1.Additions != 1 || f1.Deletions != 0 {
		t.Errorf("file 1 stats: want +1/-0, got +%d/-%d", f1.Additions, f1.Deletions)
	}
}

func TestMultiFileDiff_FileCount(t *testing.T) {
	mfd := ParseMultiFileDiff(multiFileDiff)
	if mfd.FileCount() != 2 {
		t.Errorf("want FileCount=2, got %d", mfd.FileCount())
	}
}

func TestMultiFileDiff_NilSafe(t *testing.T) {
	var mfd *MultiFileDiff
	if mfd.TotalLines() != 0 {
		t.Error("TotalLines on nil should be 0")
	}
	if mfd.FileAtLine(0) != -1 {
		t.Error("FileAtLine on nil should be -1")
	}
	if mfd.FileCount() != 0 {
		t.Error("FileCount on nil should be 0")
	}
}

func TestParsedDiff_TotalLines(t *testing.T) {
	parsed, _ := ParseUnifiedDiff(sampleDiff)
	total := parsed.TotalLines()
	if total <= 0 {
		t.Errorf("TotalLines should be > 0, got %d", total)
	}
}

func TestParsedDiff_MaxLineNumber(t *testing.T) {
	parsed, _ := ParseUnifiedDiff(sampleDiff)
	max := parsed.MaxLineNumber()
	if max < 10 {
		t.Errorf("MaxLineNumber should be >= 10, got %d", max)
	}
}

func TestChangeStats(t *testing.T) {
	info := FileDiffInfo{
		Diff:      &ParsedDiff{NewFile: "test.go"},
		Additions: 10,
		Deletions: 5,
	}
	if info.ChangeStats() != "+10/-5" {
		t.Errorf("want +10/-5, got %q", info.ChangeStats())
	}
}

func TestFileName_Preference(t *testing.T) {
	// Prefers NewFile
	info := FileDiffInfo{Diff: &ParsedDiff{OldFile: "old.go", NewFile: "new.go"}}
	if info.FileName() != "new.go" {
		t.Errorf("want new.go, got %q", info.FileName())
	}

	// Falls back to OldFile when NewFile is /dev/null
	info2 := FileDiffInfo{Diff: &ParsedDiff{OldFile: "deleted.go", NewFile: "/dev/null"}}
	if info2.FileName() != "deleted.go" {
		t.Errorf("want deleted.go, got %q", info2.FileName())
	}

	// "unknown" when both empty
	info3 := FileDiffInfo{Diff: &ParsedDiff{}}
	if info3.FileName() != "unknown" {
		t.Errorf("want unknown, got %q", info3.FileName())
	}
}

func TestTokenize(t *testing.T) {
	tokens := tokenize("hello world  foo")
	// Should split into: "hello", " ", "world", "  ", "foo"
	if len(tokens) != 5 {
		t.Errorf("want 5 tokens, got %d: %v", len(tokens), tokens)
	}
}

func TestTokenize_Empty(t *testing.T) {
	tokens := tokenize("")
	if len(tokens) != 0 {
		t.Errorf("want 0 tokens for empty string, got %d", len(tokens))
	}
}

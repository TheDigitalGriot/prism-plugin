package app

import (
	"testing"
)

func TestFuzzyScore_ExactMatch(t *testing.T) {
	score := fuzzyScore("model.go", "model.go")
	if score <= 0 {
		t.Errorf("exact match should have positive score, got %d", score)
	}
}

func TestFuzzyScore_SubsequenceMatch(t *testing.T) {
	// "mgo" should match "model.go" (m...g...o)
	score := fuzzyScore("mgo", "cmd/prism-cli/app/model.go")
	if score <= 0 {
		t.Errorf("subsequence 'mgo' should match 'model.go', got score %d", score)
	}
}

func TestFuzzyScore_NoMatch(t *testing.T) {
	score := fuzzyScore("xyz", "model.go")
	if score != 0 {
		t.Errorf("non-matching query should return 0, got %d", score)
	}
}

func TestFuzzyScore_EmptyQuery(t *testing.T) {
	score := fuzzyScore("", "model.go")
	if score != 1 {
		t.Errorf("empty query should match with score 1, got %d", score)
	}
}

func TestFuzzyScore_Ranking(t *testing.T) {
	// "main" should score higher on "main.go" than "src/domain/maintenance.go"
	scoreExact := fuzzyScore("main", "main.go")
	scoreLong := fuzzyScore("main", "src/domain/maintenance.go")

	if scoreExact <= scoreLong {
		t.Errorf("exact prefix match (%d) should score higher than scattered match (%d)", scoreExact, scoreLong)
	}
}

func TestFuzzyScore_FilenameBias(t *testing.T) {
	// Matching at the start of filename should score higher
	scoreFilename := fuzzyScore("mod", "cmd/app/model.go")
	scorePath := fuzzyScore("mod", "model/config/app.go")

	// Both should match
	if scoreFilename <= 0 {
		t.Errorf("'mod' should match 'cmd/app/model.go', got %d", scoreFilename)
	}
	if scorePath <= 0 {
		t.Errorf("'mod' should match 'model/config/app.go', got %d", scorePath)
	}
}

func TestFileFinder_Filter(t *testing.T) {
	cache := []string{
		"cmd/prism-cli/app/model.go",
		"cmd/prism-cli/app/update.go",
		"cmd/prism-cli/app/views.go",
		"cmd/prism-cli/main.go",
		"README.md",
	}

	ff := NewFileFinder("/project", cache)

	// Initial state shows first N files
	if len(ff.filtered) == 0 {
		t.Error("initial filtered list should not be empty")
	}

	// Filter for "model"
	ff.Filter("model")
	found := false
	for _, m := range ff.filtered {
		if m.RelPath == "cmd/prism-cli/app/model.go" {
			found = true
			break
		}
	}
	if !found {
		t.Error("filter 'model' should include model.go in results")
	}

	// Filter for "xyz" should return nothing
	ff.Filter("xyz")
	if len(ff.filtered) != 0 {
		t.Errorf("filter 'xyz' should match nothing, got %d results", len(ff.filtered))
	}

	// Clear filter
	ff.Filter("")
	if len(ff.filtered) == 0 {
		t.Error("clearing filter should show initial results")
	}
}

func TestFileFinder_SelectNavigation(t *testing.T) {
	cache := []string{"a.go", "b.go", "c.go"}
	ff := NewFileFinder("/project", cache)

	if ff.selectedIndex != 0 {
		t.Errorf("initial selection should be 0, got %d", ff.selectedIndex)
	}

	ff.SelectNext()
	if ff.selectedIndex != 1 {
		t.Errorf("after SelectNext, expected 1 got %d", ff.selectedIndex)
	}

	ff.SelectPrev()
	if ff.selectedIndex != 0 {
		t.Errorf("after SelectPrev, expected 0 got %d", ff.selectedIndex)
	}

	// Wrap around
	ff.SelectPrev()
	if ff.selectedIndex != 2 {
		t.Errorf("SelectPrev should wrap to 2, got %d", ff.selectedIndex)
	}
}

func TestFileFinder_SelectedFile(t *testing.T) {
	cache := []string{"a.go", "b.go"}
	ff := NewFileFinder("/project", cache)

	sel := ff.SelectedFile()
	if sel == nil {
		t.Fatal("SelectedFile should not be nil")
	}
	if sel.RelPath != "a.go" {
		t.Errorf("expected 'a.go', got %q", sel.RelPath)
	}

	ff.SelectNext()
	sel = ff.SelectedFile()
	if sel.RelPath != "b.go" {
		t.Errorf("expected 'b.go', got %q", sel.RelPath)
	}
}

package dialog

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/prism-plugin/prism-cli/agentbus"
	"github.com/prism-plugin/prism-cli/styles"
)

type questionMode int

const (
	modeOptions  questionMode = iota // navigating options
	modeCustom                       // typing custom text
	modeSubmit                       // focus on submit/skip buttons
)

// QuestionDialog renders an AskUserQuestion prompt as an accordion.
// It implements the dialog.Dialog interface.
type QuestionDialog struct {
	id             string
	questions      []agentbus.Question
	answers        [][]int  // selected option indices per question (multi-select)
	customTexts    []string // custom text per question ("Other" option)
	customActive   []bool   // whether custom input is being typed
	activeQuestion int      // which question is expanded (accordion)
	focusedOption  int      // which option has focus in active question
	focusedBtn     int      // 0=submit, 1=skip (when mode==modeSubmit)
	mode           questionMode
}

// NewQuestion creates a QuestionDialog for the given questions.
func NewQuestion(id string, questions []agentbus.Question) *QuestionDialog {
	n := len(questions)
	d := &QuestionDialog{
		id:           id,
		questions:    questions,
		answers:      make([][]int, n),
		customTexts:  make([]string, n),
		customActive: make([]bool, n),
		mode:         modeOptions,
	}
	for i := range d.answers {
		d.answers[i] = []int{}
	}
	return d
}

// ID returns the dialog identifier.
func (d *QuestionDialog) ID() string { return d.id }

// HandleMouse is a no-op (keyboard-driven only).
func (d *QuestionDialog) HandleMouse(_ tea.MouseMsg) Action { return ActionNone }

// Update processes keyboard input.
func (d *QuestionDialog) Update(msg tea.Msg) (Action, tea.Cmd) {
	keyMsg, ok := msg.(tea.KeyMsg)
	if !ok {
		return ActionNone, nil
	}
	key := keyMsg.String()

	switch d.mode {
	case modeOptions:
		return d.handleOptionsKey(key)
	case modeCustom:
		return d.handleCustomKey(key)
	case modeSubmit:
		return d.handleSubmitKey(key)
	}
	return ActionNone, nil
}

func (d *QuestionDialog) handleOptionsKey(key string) (Action, tea.Cmd) {
	q := d.questions[d.activeQuestion]
	optCount := len(q.Options)

	switch key {
	case "up", "k":
		if d.focusedOption > 0 {
			d.focusedOption--
		}
	case "down", "j":
		if d.focusedOption < optCount-1 {
			d.focusedOption++
		}
	case "enter":
		if !q.MultiSelect {
			// Single-select: set answer and advance.
			d.answers[d.activeQuestion] = []int{d.focusedOption}
			if d.focusedOption == optCount-1 {
				// "Other..." option.
				d.mode = modeCustom
				return ActionNone, nil
			}
			return d.advance()
		}
		// Multi-select: Enter advances.
		return d.advance()
	case " ":
		if q.MultiSelect {
			d.toggleOption(d.activeQuestion, d.focusedOption)
		}
	case "left":
		if d.activeQuestion > 0 {
			d.activeQuestion--
			d.focusedOption = 0
		}
	case "right":
		if d.activeQuestion < len(d.questions)-1 {
			d.activeQuestion++
			d.focusedOption = 0
		}
	case "tab":
		d.mode = modeSubmit
		d.focusedBtn = 0
	case "esc":
		return ActionDeny, nil // skip all = deny
	}
	return ActionNone, nil
}

func (d *QuestionDialog) handleCustomKey(key string) (Action, tea.Cmd) {
	switch key {
	case "enter":
		d.customActive[d.activeQuestion] = true
		return d.advance()
	case "esc":
		// Cancel custom input, go back to options.
		d.mode = modeOptions
		d.customTexts[d.activeQuestion] = ""
	case "backspace":
		t := d.customTexts[d.activeQuestion]
		if len(t) > 0 {
			d.customTexts[d.activeQuestion] = t[:len(t)-1]
		}
	default:
		if len(key) == 1 {
			d.customTexts[d.activeQuestion] += key
		}
	}
	return ActionNone, nil
}

func (d *QuestionDialog) handleSubmitKey(key string) (Action, tea.Cmd) {
	switch key {
	case "left", "right", "tab":
		d.focusedBtn = 1 - d.focusedBtn
	case "enter":
		if d.focusedBtn == 0 {
			return ActionConfirm, nil // submit answers
		}
		return ActionDeny, nil // skip
	case "esc":
		d.mode = modeOptions
	}
	return ActionNone, nil
}

// advance moves to the next unanswered question, or to the submit row if done.
func (d *QuestionDialog) advance() (Action, tea.Cmd) {
	d.mode = modeOptions
	d.focusedOption = 0
	for i := d.activeQuestion + 1; i < len(d.questions); i++ {
		if len(d.answers[i]) == 0 {
			d.activeQuestion = i
			return ActionNone, nil
		}
	}
	// All answered — move to submit row.
	d.mode = modeSubmit
	d.focusedBtn = 0
	return ActionNone, nil
}

// toggleOption toggles a multi-select option.
func (d *QuestionDialog) toggleOption(qIdx, optIdx int) {
	ans := d.answers[qIdx]
	for i, v := range ans {
		if v == optIdx {
			// Remove.
			d.answers[qIdx] = append(ans[:i], ans[i+1:]...)
			return
		}
	}
	d.answers[qIdx] = append(ans, optIdx)
}

// Answers returns the user's answers as a QuestionResponse (for bus publishing).
func (d *QuestionDialog) Answers(requestID string) agentbus.QuestionResponse {
	resp := agentbus.QuestionResponse{
		RequestID: requestID,
		Answers:   make(map[string]string, len(d.questions)),
	}
	for i, q := range d.questions {
		if d.customActive[i] {
			resp.Answers[q.Text] = d.customTexts[i]
			continue
		}
		if len(d.answers[i]) > 0 {
			var selected []string
			for _, idx := range d.answers[i] {
				if idx < len(q.Options) {
					selected = append(selected, q.Options[idx].Label)
				}
			}
			resp.Answers[q.Text] = strings.Join(selected, ", ")
		}
	}
	return resp
}

// View renders the question accordion dialog.
func (d *QuestionDialog) View(width, height int) string {
	boxWidth := width - 8
	if boxWidth < 30 {
		boxWidth = 30
	}

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(styles.Primary)
	headerStyle := lipgloss.NewStyle().Foreground(styles.Info)
	optionStyle := lipgloss.NewStyle().Foreground(styles.White)
	focusedStyle := lipgloss.NewStyle().Foreground(styles.Primary).Bold(true)
	dimStyle := lipgloss.NewStyle().Foreground(styles.Dim)
	selectedStyle := lipgloss.NewStyle().Foreground(styles.Success)

	var lines []string
	lines = append(lines, titleStyle.Render("Question"))
	lines = append(lines, strings.Repeat("─", boxWidth))
	lines = append(lines, "")

	for qi, q := range d.questions {
		// Progress indicator.
		progress := fmt.Sprintf("  %d of %d", qi+1, len(d.questions))
		expanded := qi == d.activeQuestion

		if expanded {
			lines = append(lines, headerStyle.Render("  ▾ "+q.Text))
			if q.Header != "" {
				lines = append(lines, dimStyle.Render("    "+q.Header))
			}
			lines = append(lines, dimStyle.Render(progress))
			lines = append(lines, "")

			if d.mode == modeCustom {
				// Custom text input.
				lines = append(lines, "  Enter your answer:")
				inputLine := "  › " + d.customTexts[qi] + "█"
				lines = append(lines, focusedStyle.Render(inputLine))
			} else {
				// Show options.
				for oi, opt := range q.Options {
					focused := oi == d.focusedOption
					selected := d.isSelected(qi, oi)

					prefix := "  ○ "
					if q.MultiSelect {
						prefix = "  ☐ "
						if selected {
							prefix = "  ☑ "
						}
					}

					label := opt.Label
					if opt.Description != "" {
						label += dimStyle.Render("  — "+opt.Description)
					}

					var rendered string
					if focused {
						if selected {
							rendered = selectedStyle.Render("  ▶ "+opt.Label) + dimStyle.Render(" — "+opt.Description)
						} else {
							rendered = focusedStyle.Render(prefix + label)
						}
					} else if selected {
						rendered = selectedStyle.Render(prefix + label)
					} else {
						rendered = optionStyle.Render(prefix + label)
					}
					lines = append(lines, rendered)
				}
			}
			lines = append(lines, "")

		} else {
			// Collapsed: show answered summary.
			summary := ""
			if len(d.answers[qi]) > 0 && len(q.Options) > 0 {
				idx := d.answers[qi][0]
				if idx < len(q.Options) {
					summary = " → " + q.Options[idx].Label
				}
			}
			lines = append(lines, dimStyle.Render("  ▸ "+q.Text+summary))
		}
	}

	// Submit row.
	lines = append(lines, strings.Repeat("─", boxWidth))
	if d.mode == modeSubmit {
		submitStyle := dimStyle
		skipStyle := dimStyle
		if d.focusedBtn == 0 {
			submitStyle = focusedStyle
		} else {
			skipStyle = focusedStyle
		}
		lines = append(lines, "  "+submitStyle.Render("[Submit]")+"  "+skipStyle.Render("[Skip]"))
	} else {
		lines = append(lines, dimStyle.Render("  Tab → submit  Esc → skip"))
	}

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.Primary).
		Padding(1, 2).
		Width(boxWidth)

	content := strings.Join(lines, "\n")
	return lipgloss.Place(width, height, lipgloss.Center, lipgloss.Center, box.Render(content))
}

// isSelected checks whether an option index is selected for a question.
func (d *QuestionDialog) isSelected(qi, oi int) bool {
	for _, v := range d.answers[qi] {
		if v == oi {
			return true
		}
	}
	return false
}

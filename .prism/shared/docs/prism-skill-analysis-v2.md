Prism Skills Through the Skill-Creator Lens
Here's how your 13 skills map to the two categories from the article:

Capability Uplift Skills (Claude can't do this well without them)
Skill	Why it's capability uplift
prism-research	Forces "documentarian, not critic" behavior — base Claude wants to suggest improvements
prism-plan	Enforces interactive iteration — base Claude dumps full plans in one shot
prism-spectrum	Fresh-context-per-story orchestration doesn't exist in base Claude at all
prism-debug	Parallel investigator pattern (log/state/git agents) is a structural technique
prism-verify	Browser verification workflow via playwright-cli is beyond base capabilities
These skills teach Claude techniques it doesn't have natively. The article says these may become less necessary as models improve — and evals would tell you exactly when that happens.

Encoded Preference Skills (Claude can do the pieces, but Prism sequences them)
Skill	Why it's encoded preference
prism (meta)	Routes to the right phase — Claude could do each phase, but your workflow demands this sequence
prism-implement	Phase-by-phase execution with verification checkpoints is your process
prism-iterate	"Get approval before changing the plan" is a team preference
prism-validate	Two-category success criteria (automated + manual) is your convention
prism-release	7-step release pipeline is entirely your process
prism-prd / prism-visual-docs / prism-docs-update	Document generation following your templates and formats
These are more durable — they encode your workflow, not a model limitation. But evals still verify fidelity to that workflow.

Now here's my first clarifying question before I propose approaches:

When you think about eval-ing the v2.4.8 → v2.4.9 change (token tracking + code-intelligence + spectrum enhancements), what does "better" look like to you?

For example, are you thinking:

A) Output quality — "Given the same task prompt, does the v2.4.9 skill produce better research/plans/implementations than v2.4.8?"
B) Behavioral compliance — "Does the agent actually use graph-first queries, include token metrics, follow the new spectrum patterns?"
C) Efficiency — "Does v2.4.9 use fewer tokens, complete faster, or require fewer iterations?"
D) Some combination — or something else entirely?
This will shape which eval/benchmark/comparator patterns make sense for Prism.
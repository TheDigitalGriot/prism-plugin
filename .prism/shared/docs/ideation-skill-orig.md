Ideation Team Skill — Analysis
Source: bladnman/ideation (MIT license)
Location: .prism/shared/ref/ideation_team_skill/

What It Is
A Claude Code skill that runs a multi-agent brainstorming session using the experimental Agent Teams feature (requires Opus 4.6 + CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1). It separates cognitive modes — generation, evaluation, synthesis, and research — across distinct agents to avoid the bias that happens when a single agent tries to do all of them.

Plugin Structure Assessment
From a plugin-structure perspective, this is a skill-only plugin (no commands, agents, hooks, or MCP servers):

Component	Status
SKILL.md	Present (76KB — very large, comprehensive orchestration prompt)
templates/	8 template files (idea-brief, idea-report, ideation-graph, lineage, prd, session-config, session-summary, vision-document)
.claude-plugin/	Missing — no plugin.json manifest
commands/	None
agents/	None (agents are defined inline in SKILL.md spawn prompts)
Notable: It doesn't use Claude Code's standard agent files in agents/. Instead, all 9 agent prompts are embedded directly in the SKILL.md as spawn prompt templates. This works but isn't the conventional plugin pattern.

The 4 Actions
Action	Trigger	What It Does
Plan	/ideation <concept>	Solo interview — asks about depth (Quick/Standard/Deep/Exhaustive) and desired outputs, creates session directory, writes session-config.yaml
Ideate	Auto after Plan	Spawns agent team, runs structured dialogue, depth-aware convergence, conditional production phase
Continue	/ideation continue <ref>	Smart discovery of previous sessions, versioned resumption (v2, v3, v2a branching), mini-interview, references parent materials
PRD	/ideation prd <ref>	Solo operation — reads completed session artifacts and generates a Product Requirements Document
The 9 Agents
Agent	Role	When Spawned
Arbiter (you)	Team lead — coordinates, evaluates idea reports, signals convergence	Always (the orchestrator)
Free Thinker	Divergent generation — creative leaps, "what if..."	Always
Grounder	Convergent editing — winnows ideas, keeps on brief	Always
Writer	Synthesis/memory — maintains ideation graph, snapshots, briefs, vision doc	Always
Explorer	Research — web search, citations, fact-finding	Conditional (based on research mode)
Image Agent	Infographic visuals via ChatGPT image gen (Chrome MCP)	Conditional (Tier 2 output)
Presentation Agent	PPTX deck via python-pptx	Conditional (Tier 2 output)
Web Page Agent	Self-contained HTML distribution page	Conditional (Tier 2 output)
Archivist	Results PDF + Session Capsule PDF via weasyprint	Conditional (Tier 2 output)
How The Dialogue Works
Free Thinker and Grounder converse via SendMessage broadcasts
Writer silently observes, maintains the ideation graph and snapshots
They produce idea reports sent to the Arbiter
Arbiter evaluates each report against 4 criteria (compelling, somewhat new, different take, substantive) with a depth-aware threshold (1-of-4 for Quick, all-4 for Exhaustive)
Arbiter either marks ideas "interesting" or sends them back for "needs more conversation"
Convergence is emergent — when min report threshold is met and further dialogue yields diminishing returns
Writer produces final briefs and vision document
Production agents (conditionally) create deliverables
Depth System
Quick	Standard	Deep	Exhaustive
Directions	2-3	3-5	5-8	8+
Time	~15-30 min	~45-90 min	~2-3 hrs	~3+ hrs
Min reports before convergence	1	3	5	8
"Interesting" bar	1/4 criteria	2/4	3/4	4/4
Output Structure
Each session creates a timestamped directory under ideations/:

Tier 1 (always): Vision doc, briefs, session summary, ideation graph, snapshots, idea reports
Tier 2 (selectable): index.html, Results PDF, Capsule PDF, PPTX presentation, infographic images
Requirements/Dependencies
Agent Teams experimental feature enabled
Opus 4.6 model
python-pptx and weasyprint for production artifacts
Chrome + Claude-in-Chrome extension for image generation via ChatGPT
The docs/requests/ File
Contains the original voice transcript from the author describing the design requirements — the Plan interview, depth levels, output selection, and Continue/versioning features were all born from this single design conversation.

Bottom line: This is a sophisticated prompt-engineering-only skill that orchestrates 9 specialized agents through Claude Code's Agent Teams API to run structured creative brainstorming sessions with configurable depth, versioned continuation, and multi-format deliverable production. It's well-designed but heavyweight — the 76KB SKILL.md is essentially an entire orchestration framework encoded as a prompt.
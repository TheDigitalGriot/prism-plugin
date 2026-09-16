# The nine layer roles â€” the output taxonomy

**Source of truth:** griot-suite-map.html LNAME array (artifact c389ca6c, The Griot Stack).
Locked verbatim in the stage contract
(.prism/shared/plans/djeli-uxui-harvest/djeli-uxui-harvest-CONTEXT.md, decision 2). These nine
strings are the **entire** output taxonomy for this skill â€” a finding gets exactly one, or
`unplaceable`. Never invent a tenth.

A UI pattern with no layer is unplaceable â€” that is the whole reason this skill could not be
written before the roles existed (see the contract's "Why this was parked" section).

| # | Layer role (verbatim) | Routing heuristic (working, not a source-verified definition) |
|---|---|---|
| 1 | Djeli · container | Shell-level chrome: window frame, top-level navigation, workspace switcher, the app-of-apps surface itself rather than any one app inside it. |
| 2 | Collaboration · GenTeam | Multi-user or multi-agent coordination surfaces: shared sessions, presence, hand-off between human and agent teammates, team/roster views. |
| 3 | Creation · build/content/3D | Authoring surfaces that produce an artifact: document/content editors, build tooling UI, 3D/scene composition, design canvases that output a deliverable. |
| 4 | Capture | Anything that ingests real-world or external input: recording, screen/video capture, transcription intake, file/asset import. |
| 5 | Intelligence · Super Agent | The agent-facing control surface: prompt/response panes, agent orchestration UI, tool-call visibility, the "talk to the agent" layer. |
| 6 | Governance · Governor | Model routing, permission gates, HITL confirm/deny modals, the model-governance-facing controls (ask/allow/deny/skip, downgrade chain, floor). |
| 7 | Model-making / data science | Training/eval UI, dataset curation, notebook-adjacent surfaces, anything shaping a model rather than using one. |
| 8 | Memory · foundation | Persistence-facing surfaces: history, search-your-own-past, the substrate views over the code graph / viz-engine layer itself. |
| 9 | Deployment | Publish/ship/release surfaces: build-and-deploy panels, environment/target pickers, release status. |

## When routing is not obvious

State the candidate layer **and the file:line evidence that suggests it**, then let the
orchestrator (or Gavin) confirm. If a screen genuinely straddles two roles (e.g. a Capture screen
that hands off into Creation), record **both** with the seam file:line â€” do not silently pick one.

If nothing fits, write `unplaceable` and say why. Per decision 5 in the contract: this never gates
or narrows what Gavin can fork, study, or remix â€” `unplaceable` is a routing gap to report, not a
reason to block the walk.

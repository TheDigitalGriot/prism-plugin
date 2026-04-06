---
description: Create ticket/issue and PR after experimental work is already done
model: sonnet
---

# Retroactive Documentation

You've been working on an experimental feature without the typical ticket/PR workflow. This command helps you retroactively create proper documentation after the fact.

## When to Use

- You've been experimenting and it worked
- Code is committed but there's no ticket/issue
- You need to create a PR for code review
- "Founder mode" - move fast, document after

## Process

### 1. Ensure Work is Committed

If you haven't committed yet, first run `/commit` to create a commit.

Get the SHA of your commit:
```bash
git rev-parse HEAD
```

### 2. Create the Ticket/Issue

Create a ticket in your issue tracker describing what you built:

**Required sections:**
- **Problem to solve**: What user problem does this address?
- **Solution implemented**: What did you build?

Put the ticket in "In Development" or equivalent state since work is already done.

### 3. Create a Feature Branch

Get the recommended branch name from your ticket, then:

```bash
git checkout main
git checkout -b [BRANCH_NAME]
git cherry-pick [COMMIT_SHA]
git push -u origin [BRANCH_NAME]
```

### 4. Create the Pull Request

```bash
gh pr create --fill
```

Then run `/describe_pr` to generate a proper PR description.

### 5. Link Everything

- Add a comment to the ticket with the PR link
- Update PR description to reference the ticket

## Example Flow

```
# You've been hacking and made something that works
git add . && git commit -m "Add widget caching for performance"

# Now formalize it
/retroactive

# Creates ticket, branches, cherry-picks, creates PR
# Links everything together
```

## Notes

- This workflow is for when you've already done the work
- The ticket documents what was built, not what will be built
- Keep the original commit on main if needed, or reset after cherry-pick
- Works with any issue tracker that has an MCP integration or CLI

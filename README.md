# Prism Plugin (marketplace)

Clean, self-contained plugin-only marketplace for Prism (https://github.com/TheDigitalGriot/prism) -
plugin dirs only, synced at **v4.13.0**. Plugin source is a github object pointing at
this repo, so Claude Desktop / Cowork can crawl it (unlike the multi-GB main repo).

Add in Claude Desktop / Cowork: Customize -> Plugins -> add marketplace TheDigitalGriot/prism-plugin.

Do not edit here: changes land in the main repo and are pushed by
scripts/sync-prism-plugin.sh (see prism-release Step 6.5).

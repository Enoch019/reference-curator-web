# Reference Curator Web — PUBLIC

This repository contains ONLY the frontend and shared non-secret topic settings.
The actual collector, API keys, Discord webhook and image history remain in the
PRIVATE repository Enoch019/reference-curator.

SETUP
1. Create a new PUBLIC repository called reference-curator-web under Enoch019.
2. Upload the contents of this ZIP to its main branch, preserving folder structure.
3. Open Settings > Pages; select Source: GitHub Actions.
4. Run Actions > Publish Reference Curator Web > Run workflow.
5. Open https://enoch019.github.io/reference-curator-web/
6. Add trusted friends under PUBLIC repository Settings > Collaborators (Write).

EDITING
Friends open the site, edit topics, and click Save to GitHub.
An authenticated GitHub Issue is created in this PUBLIC repository.
Only invited WRITE collaborators or the owner pass workflow authorization.
The public workflow saves config.json and site/bootstrap.js, then republishes Pages.
The PRIVATE collector downloads the validated public config on its next scheduled run.

No PAT, private repository access, new backend or Discord bot is required.
PUBLIC NOTICE: Topic descriptions, queries and issue contents are visible to everyone.
The website URL is not an access control mechanism.
Do not upload any API keys, webhook URLs, local state, images or secrets.

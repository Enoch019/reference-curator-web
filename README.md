# Reference Curator Web — PUBLIC

이런 귀한 곳에 이런 누추한 분이...


## Test actual Discord delivery from the dashboard

The dashboard has a **▶ TEST DISCORD** button in the header and Review screen.
It submits a prefilled public GitHub Issue using the selected topic ID. After an
invited collaborator submits the issue, the PRIVATE collector polls open test
requests about every 15 minutes (GitHub may delay scheduled workflow runs),
checks the GitHub-provided issue author association, and runs the existing
Serper → Vision → Discord pipeline using the last SAVED topic configuration.

- Test submissions can consume Serper/OpenAI API credits and send Discord messages.
- SAVE TO GITHUB must be completed before testing newly edited settings.
- Uninvited users cannot trigger tests; the private collector accepts only
  OWNER or COLLABORATOR GitHub issue associations.
- An issue is a queued request, not a synchronous API call. Check the
  Discord channel for its result. If no images pass the filters, the existing
  collector sends source/search links as a fallback.
- Requests are processed at most once; the private workflow records a
  processed issue cursor. Public test issues do not automatically close,
  because the private GitHub workflow intentionally has no credentials for
  writing to the public repository.
- The periodic private runner consumes GitHub Actions minutes even when idle;
  change its schedule in the private workflow if needed.

Source workflow: private repository .github/workflows/test-request.yml.

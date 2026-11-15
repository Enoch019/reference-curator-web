# Reference Curator Web — PUBLIC

이런 귀한 곳에 이런 누추한 분이...


## Test actual Discord delivery from the dashboard

The **▶ TEST DISCORD** button opens the PUBLIC GitHub workflow:
[Request Discord reference test](https://github.com/Enoch019/reference-curator-web/actions/workflows/request-test.yml).

1. Save any topic edits first (SAVE TO GITHUB still uses its authenticated issue form).
2. Select an existing saved topic, click TEST DISCORD. The dashboard attempts to copy its Topic ID.
3. In GitHub Actions select **Run workflow**, paste the Topic ID, then select **Run workflow**.
4. GitHub checks the authenticated caller's write permission and the saved topic. The successful public workflow run records a validated test request; no Issues are created.
5. Every ~15 minutes (best-effort GitHub schedule), the PRIVATE collector polls successful public workflow_dispatch runs, selects at most one unclaimed request, and triggers the Serper → Vision → Discord pipeline.
6. Check Discord for the selected images or source/search-link fallback; the public workflow's success only means the request was approved, not that the private delivery is complete.

The private collector never exposes Serper/OpenAI/Discord secrets to this repository. There is NO cross-repository PAT.
Duplicate execution is prevented with a private run-ID cursor committed before making paid API calls.
The test consumes API credits and may send an additional Discord message. Public workflow run details are visible to everyone.

The private request poller is in `Enoch019/reference-curator/.github/workflows/test-request.yml`.
Github may delay or skip scheduled poll cycles, and an Action may wait in a queue.

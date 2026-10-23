# Connect this environment to Cloudflare Pages

## Verified connection

- Existing Pages project: **mirror-me**, https://mirror-me.pages.dev . No duplicate project was created.
- GitHub source: **Skewernet/Mirror-Me---Shorty-Game-Jam**; production branch: **main**. GitHub integration and automatic production deployments are enabled in Cloudflare. The approved 0.8 push of `3d26ffb` produced successful automatic production deployment `24a9b009-81be-4acb-99bf-b7c97e88553d`; all 116 public runtime/credit hashes matched the tested package. Earlier pushes had been unreliable, so verify each release rather than assuming every push succeeds.
- This environment now has working CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID bindings. Authenticated project lookup and a production Direct Upload succeeded.
- First confirmed Direct Upload release: **11c84c7**. A subsequent Git-source build of **1b52651** also completed successfully and all 24 public runtime hashes matched. The current release is identified by the live build-id rather than by this historical documentation. The explicit Git-build command is verified; automatic push webhook delivery was subsequently proven for the owner-approved 0.5 gameplay revision `6473461`.
- Build command: `python3 tools/stage_pages.py --output-dir dist`; output: `dist`; root: repository root. The production artifact contains runtime files and a revision/hash manifest.
- Wrangler **4.152.0** is installed outside the checkout. Startup never publishes. Keep account access in secure environment settings.

## One-time secure connection

1. Open [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens), create a **Custom Token**, name it `MIRROR ME Codex`, and grant **Account → Cloudflare Pages → Edit**. Under account resources, include only the account that should host this game. Save the generated token securely.
2. Find that account's **Account ID** in Cloudflare's account/Workers & Pages dashboard or account overview. This is an account ID, not a zone ID or project name. Do not create a domain or zone for this; Pages provides a pages.dev address.
3. In this chat's **Edit environment** settings, enter the token securely as the declared secret **CLOUDFLARE_API_TOKEN**, destined for **api.cloudflare.com**. Enter the account ID as the runtime variable **CLOUDFLARE_ACCOUNT_ID**. Never paste the token into chat, source, commands or documentation.
4. Review the saved network additions: **api.cloudflare.com**, **mirror-me.pages.dev**, **\*.mirror-me.pages.dev**. Existing package-manager presets remain preserved. Save the environment changes and publish the environment configuration when prompted. This enables account access; it does not deploy the game.
5. Return to this conversation and say **“Cloudflare credentials are saved; create or reuse mirror-me and deploy the approved first slice.”** The assistant must recheck actual variable presence and authenticated API access rather than assume propagation has completed.

A Cloudflare Pages plugin is not required; the official Wrangler CLI can deploy directly. GitHub integration is optional for this route. Token/account settings belong in this cloud environment, not in Cloudflare Pages build variables or public repository files.

## Prepared commands

From `/workspace/Mirror-Me---Shorty-Game-Jam`:

```sh
node --test tests/*.test.mjs
python tools/stage_pages.py
python tools/deploy_pages.py --github-build
# Alternative approved Direct Upload: python tools/deploy_pages.py
# Read-only comparison: python tools/deploy_pages.py --verify-only
```

The staging command creates an immutable output folder outside the checkout, including a `build-id.json` revision and asset manifest. Only the runtime, license and attribution assets enter the upload. It refuses a dirty checkout or a conflicting existing output.

The Git build command asks Cloudflare to build the actual production branch HEAD, waits for success, checks the resulting commit and verifies public assets. The Direct Upload command checks the account for `mirror-me`. It reuses an existing project, or creates exactly `mirror-me` only after an authenticated lookup returns 404. It never treats an authorization/network error as evidence that the project is absent. It reads the actual production branch, uploads via Wrangler, then verifies the live revision and each runtime asset. It does not create extra projects or touch Morlins Quest / Skewer Signals. A receipt is saved outside the checkout after successful live verification.

If the account owns an existing `mirror-me`, keep its Pages address. For a newly created project, confirm the actual hostname returned by Cloudflare; do not assume a requested name guarantees the exact public hostname.

## Reusable environment prompt

> Work in the existing /workspace/Mirror-Me---Shorty-Game-Jam checkout. Do not create a worktree. Read PROJECT_STATUS.md, GAME_DIRECTION.md and CLOUDFLARE_SETUP.md. Use secure CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID bindings without printing their values. The existing Cloudflare Pages project mirror-me is connected to Skewernet/Mirror-Me---Shorty-Game-Jam on main; the owner-approved 0.8 Demonic Presence game is deployed. Further game changes need specific production approval. Verify the account and existing project; preserve it and other Cloudflare projects. Inspect GitHub and the live build-id before deciding whether anything needs deployment. Use the installed pinned Wrangler and the prepared staging/deployment scripts. Verify the production build-id and assets, then report the actual live URL and commit. If account access is unavailable, explain the exact missing setting and preserve all code. Never touch other Cloudflare projects. Future game changes require their own production approval. Do not claim success from a Git push alone.

## Official references

- [Cloudflare: Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare: CI upload and API token permissions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)

# Cloudflare automatic deployments

Both existing Workers use Cloudflare Workers Builds with the same repository:
`notpozzii/VeloraV2`. Production deployments follow pushes to `main`.
The separate S3 workflow continues to deploy stable GitHub releases or manual runs.

## Connect each Worker once

In Cloudflare, open Workers & Pages, select the existing Worker, then open
Settings → Builds → Connect. Select GitHub and `notpozzii/VeloraV2`.
Use these settings:

| Setting | clever-learning | ixl |
| --- | --- | --- |
| Production branch | `main` | `main` |
| Root directory | repository root | repository root |
| Build command | `bun run build` | `bun run build` |
| Deploy command | `bunx wrangler deploy --config wrangler.clever-learning.jsonc` | `bunx wrangler deploy --config wrangler.ixl.jsonc` |

Use the existing Cloudflare GitHub connection. Let Cloudflare create its normal
build token; no Cloudflare token needs to be copied into GitHub secrets.
The repository pins Node 24 and Bun 1.4.2, so no build-version variables are needed.
Disable builds for non-production branches for these two Workers.

The target-specific configuration prevents the default `galaxyv7` name from
being deployed accidentally. Existing runtime secrets and variables are kept;
the `ixl` domain-management secrets are not placed in source or build logs.

Save and run the first build for each Worker. Both build statuses must report
success before treating the setup as active. After that, commits merged into
`main` update both existing URLs automatically:

- https://clever-learning.pozzi-pozzi.workers.dev/
- https://ixl.pozzi-pozzi.workers.dev/

A local edit does not trigger deployment until it is committed and pushed to
this repository. The local Games/Apps redesign is not part of this setup.

Reference: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

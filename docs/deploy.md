# Deploying the PWA

The PWA is a static site (`pwa/build`, SvelteKit with `adapter-static`). It holds no
secret: the keys come from the passkey (or the 24 words) in the browser. It is served at
**https://paperless.le-space.de**, the way Belege is served at belege.le-space.de:
published to Aleph IPFS, and the domain pointed at that CID.

## Release

A published GitHub release runs `.github/workflows/pwa-deploy.yml`, one job:

1. unit tests, build, browser tests with a mocked Aleph;
2. pin the build on Aleph IPFS (the last three are kept);
3. point `paperless.le-space.de` at the new CID and note the CID on the release.

The job runs on a GitHub-hosted runner: the repository is public, so nothing has to be
started before a release. No workflow that a pull request can trigger runs on a
self-hosted runner.

A manual run without `link_domain` only publishes, for a look by CID.

## Passkeys stay with the origin

A passkey belongs to the address it was made on. A vault set up on `localhost` is not
seen on `paperless.le-space.de`: open the app there with the 24 words, then add a passkey
for it (**Add another passkey**). Every passkey opens the same vault.

**Not from a path-style gateway** (`https://<gateway>/ipfs/<cid>/`): there the origin is
the gateway's, shared by every CID it serves, storage and passkeys included. Under
`/ipfs/` or `/ipns/` the app opens no vault and shows where to open it instead
(`pwa/src/lib/shared-origin.js`). A subdomain gateway (`<cid>.ipfs.<host>`) is an origin
of its own.

## DNS (Cloudflare, once)

| Type  | Name                 | Value                                                   | Proxy    |
| ----- | -------------------- | ------------------------------------------------------- | -------- |
| CNAME | `paperless`          | `ipfs.public.aleph.sh`                                  | DNS only |
| CNAME | `_dnslink.paperless` | `_dnslink.paperless.le-space.de.static.public.aleph.sh` | DNS only |
| TXT   | `_control.paperless` | `0x28129bdDa64310221480d4eF903446b0cdFD4BEb`            | –        |

The `_control` address is the account that signs the publish; it must match the
repository secret `ALEPH_PRIVATE_KEY`. Check:

```bash
dig +short CNAME paperless.le-space.de            # ipfs.public.aleph.sh.
dig +short CNAME _dnslink.paperless.le-space.de   # _dnslink.paperless.le-space.de.static.public.aleph.sh.
dig +short TXT _control.paperless.le-space.de     # "0x28129bdDa64310221480d4eF903446b0cdFD4BEb"
```

### The parallel address for v0.2

`v2.paperless.le-space.de` serves the v0.2 interface beside the live app until the main
domain switches. It needs the same three records, one level down, with the same
`_control` address:

| Type  | Name                    | Value                                                      | Proxy    |
| ----- | ----------------------- | ---------------------------------------------------------- | -------- |
| CNAME | `v2.paperless`          | `ipfs.public.aleph.sh`                                     | DNS only |
| CNAME | `_dnslink.v2.paperless` | `_dnslink.v2.paperless.le-space.de.static.public.aleph.sh` | DNS only |
| TXT   | `_control.v2.paperless` | `0x28129bdDa64310221480d4eF903446b0cdFD4BEb`               | –        |

A release never touches it. It is linked by a manual run of the deploy workflow with
`site_domain: v2.paperless.le-space.de` and `link_domain` on (or with `item_hash` and
`ipfs_cid` of an upload that is on Aleph already). Aleph's gateway may need up to two
days for the certificate of a new domain.

## What the gateway sees

Aleph's IPFS gateway ends TLS for the site, as it does for Belege. It serves the PWA's
files, which are public anyway, and could in principle serve other ones; the release
notes name the CID, and `dig TXT _dnslink.paperless.le-space.de` shows which CID the domain
serves. The VMs are not behind it: the PWA reaches Paperless over `*.2n6.me`, where TLS
ends in the confidential VM, and checks the VM's attestation before it sends a key.

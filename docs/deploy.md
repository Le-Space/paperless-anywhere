# Deploying the PWA

The PWA is a static site (`pwa/build`, SvelteKit with `adapter-static`). It holds no
secret: the keys come from the passkey (or the 24 words) in the browser. It is served at
**https://paperless.le-space.de**, the way Belege is served at belege.le-space.de:
published to Aleph IPFS, and the domain pointed at that CID.

## Release

A published GitHub release runs `.github/workflows/pwa-deploy.yml`, in three jobs:

1. **build**, without any secret or write token: the places of the confidential nodes for
   the landing page (`scripts/crn-places.mjs`), unit tests, build, browser tests with a
   mocked Aleph;
2. **deploy**, with only the built site and the key that signs and pays: pin the build on
   Aleph IPFS (the last three are kept) and point `paperless.le-space.de` at the new CID;
3. **note**, the only one that may write to the release: note the CID on it.

The jobs run on GitHub-hosted runners: the repository is public, so nothing has to be
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

### v0.2 beside v0.1

The v0.2 interface is tested beside the live app under a path on the same domain,
`https://paperless.le-space.de/v0.2/`: a route of the same build, so the same origin, the
same passkey and the same vault record in the browser. It ships with every release and is
not linked from the app until the switch. A subdomain was tried first
(`v2.paperless.le-space.de`, linked once on 2026-11-17) and dropped: a passkey belongs to
its address, and a second address needs `rp.id` handling that a path does not. Its three
DNS records can be removed.

## What the gateway sees

Aleph's IPFS gateway ends TLS for the site, as it does for Belege. It serves the PWA's
files, which are public anyway, and could in principle serve other ones; the release
notes name the CID, and `dig TXT _dnslink.paperless.le-space.de` shows which CID the domain
serves. The VMs are not behind it: the PWA reaches Paperless over `*.2n6.me`, where TLS
ends in the confidential VM, and checks the VM's attestation before it sends a key.

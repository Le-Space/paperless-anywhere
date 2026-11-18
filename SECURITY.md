# Security

Paperless anywhere runs Paperless-ngx in a confidential VM (AMD SEV-SNP) on Aleph Cloud, opened and checked from the browser, with encrypted backups on Filecoin. What it protects and how: [docs/security-model.md](docs/security-model.md) and [docs/keys-and-recovery.md](docs/keys-and-recovery.md).

## Reporting a security issue

**Please report privately. Nothing public until it is fixed:** no issue, pull request, comment, discussion or social media post.

Two ways:

- E-mail to **[security@le-space.de](mailto:security@le-space.de)**
- GitHub's private reporting: [Report a vulnerability](https://github.com/Le-Space/paperless-anywhere/security/advisories/new)

The same addresses are in [`/.well-known/security.txt`](https://paperless.le-space.de/.well-known/security.txt) (RFC 9116).

### What to include

- what you found, and what it lets someone do (the impact);
- the affected version: the release (`v0.1.…`) or the IPFS CID shown at the foot of the app;
- the steps to reproduce it, **with made-up data only**: your own test vault, made-up documents, the Calibration test network.

Never send real customer data, real documents, keys, recovery phrases, passphrases or tokens, yours or anyone else's.

### What happens then (coordinated disclosure)

1. We confirm that the report arrived.
2. We assess it and tell you what we found, and ask if something is unclear.
3. The fix ships with the next release.
4. After it, we publish a security advisory on GitHub, naming and thanking you if you wish.

The usual time until publication is 90 days from the report, earlier once a fix is released. If a fix needs longer, we agree on it with you. We do not promise fixed response times.

### Good faith

We welcome research done in good faith within these rules, treat your report confidentially and work with you on it. This is how we intend to act; it is not a legal waiver, and it cannot speak for third parties such as Stripe, Aleph or Filecoin.

### Rules for research

- Use only your own accounts and vaults, and the Filecoin **Calibration** test network where you can.
- Do not look at, copy, change or delete anyone else's data. If you come across it by accident, stop, do not keep it, and tell us.
- No denial of service, no spam, no social engineering or phishing against Le Space, its staff or its customers.
- No attacks on infrastructure that is not ours: Aleph nodes, Filecoin storage providers, Stripe, GitHub.

## What is in scope

- the app and the landing page (`pwa/`), as served from paperless.le-space.de;
- the VM image (`rootfs/`) and what runs in the VM;
- the image builder (`builder/`);
- CI and the release and deploy chain of paperless.le-space.de (`.github/`).

**Out of scope**, please report there: Aleph Cloud (its nodes, network and API), Filecoin and its storage providers, Stripe, and Paperless-ngx itself ([its security policy](https://github.com/paperless-ngx/paperless-ngx/security/policy)). If the issue lies in how Paperless anywhere uses one of them, it is in scope here.

## Bug bounty

There is no bug bounty at the moment. We name and thank you in the advisory, if you wish.

## Supported versions

The latest release, which is what paperless.le-space.de serves.

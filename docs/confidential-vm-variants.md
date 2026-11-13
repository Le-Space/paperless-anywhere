# Confidential VMs: the variants we know, and what each one proves

A confidential VM encrypts its memory against the machine that hosts it, and
its processor signs a report about what was started in it. Everything else
differs from one design to the next: how much of the VM that report covers,
who holds the key that opens the disk, and what the person using it can check
without believing anyone.

This page compares the designs we know of. It says for each claim where it
comes from. A sentence marked **not verified by us** has no primary source we
could read; the list at the end collects them. What Paperless anywhere does
today is described from this repository
([security model](security-model.md), [workflow](workflow.md),
[keys and recovery](keys-and-recovery.md), [your own image](own-image.md)).

Status of this page: 2026-11-13.

## The question every design answers

1. **What is measured?** The report's measurement is a hash over what was
   loaded before the VM ran. Whatever is not in it, the hardware says nothing
   about.
2. **What opens the disk, and who has it?** A measured boot that then opens an
   unmeasured disk hands control to that disk. So either the disk's content is
   measured too, or a secret decides which disk can be opened.
3. **Who checks the report?** The person's own device, against the
   manufacturer's keys, or a service of the provider.

## What a launch measurement covers (AMD SEV-SNP)

- The report's `MEASUREMENT` is the measurement calculated at launch; it
  covers the initial guest memory and the initial vCPU state. `REPORT_DATA`
  is 64 bytes the guest chooses, `HOST_DATA` is set by the host at launch,
  and the report names the firmware levels (TCB) it was signed under.
  Sources: the [`sev` crate's report structure](https://docs.rs/sev/latest/sev/firmware/guest/struct.AttestationReport.html),
  [AWS on SNP attestation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/snp-attestation.html),
  [KVM's SEV documentation](https://docs.kernel.org/virt/kvm/x86/amd-memory-encryption.html).
  AMD's own specification (publication 56860) says the same in more detail;
  we could not fetch it while writing this, so its exact wording is **not
  verified by us**.
- The report is signed by a key of the processor (VCEK) or of the provider
  (VLEK, issued by AMD); both chain to AMD's root through certificates from
  AMD's key service
  ([AWS](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/snp-attestation.html)).
- With a direct kernel boot, QEMU can put the hashes of kernel, initrd and
  command line into a firmware page
  ([`kernel-hashes`](https://raw.githubusercontent.com/qemu/qemu/master/qapi/qom.json)),
  and the firmware (OVMF, AmdSev build) refuses a kernel, initrd or command
  line whose hash is not the one in that table
  ([edk2 source](https://raw.githubusercontent.com/tianocore/edk2/master/OvmfPkg/AmdSev/BlobVerifierLibSevHashes/BlobVerifierSevHashes.c)).
  That is how firmware, kernel, initrd and command line end up in one
  measurement; [`sev-snp-measure`](https://github.com/virtee/sev-snp-measure)
  recomputes it from those four and the vCPU count and type.

The root disk is not part of this. A measured initrd can extend the proof to
it, or not: that is where the variants part.

## Variant 1: a measured boot, a disk opened by one passphrase per image

**This is what Paperless anywhere runs today.**

- *Measured:* firmware, kernel, initrd, and a boot line that names the owner
  (the vault's app key). The app computes the measurement itself from a
  runtime whose hash is fixed in the app, writes it into the INSTANCE
  message, and checks the report against it, against AMD's keys, and against
  a fresh nonce bound to the VM's TLS key, in the browser
  ([workflow](workflow.md#3-attestation-and-unlock-in-detail)).
- *The disk:* the image is encrypted (LUKS). The measured initrd opens it with
  a passphrase the app hands over after the attestation, signed by the
  owner's key, and then starts what is on it. The image's content is **not**
  measured.
- *Who has the passphrase:* it is the same for every VM of an image version.
  Le Space has it (a release build puts it out encrypted to Le Space only),
  each app has it sealed in its profile, and each VM has it at boot. The
  node's operator does not.
- *What follows:* that a VM runs the published image rests on the disk opening
  only with that passphrase, not on a measurement by the hardware. Whoever
  holds the passphrase is, for this one question, trusted. The landing page
  and the [security model](security-model.md) say so.
- *What limits it today:*
  - The image holds nothing personal and no secret
    ([what the image contains](security-model.md#what-the-image-contains-and-what-it-does-not)).
  - Everything a VM writes (documents, database, certificate) goes to a data
    area encrypted with a random key the VM makes at each start and keeps in
    memory only. If that area cannot be made, Paperless does not start.
  - Secrets reach a VM only after the attestation, over the attested channel,
    signed by the owner; the VM's agent accepts no other signature.
  - Backups are encrypted inside the VM to the owner's key before they leave.

## Variant 2: an image per person, passphrase from the vault

**In preparation; not in operation.** Described in [your own image](own-image.md).

- *What changes:* the passphrase is derived from the person's vault and nobody
  else has it. A disk not sealed with it does not open, so the measured boot
  can only continue into the image that was sealed for that person.
- *How the image is sealed:* by a builder that itself runs as a confidential
  VM whose whole content is measured (variant 3), the plain image included.
  The app attests the builder before it sends the passphrase.
- *State, exactly:* the builder is built. It has run on Aleph as a
  measured VM, was verified by attestation there, and sealed the real image
  in a trial. It is not in operation: no builder is published at the moment,
  and the app names none. Fetching the sealed image by the app through the
  relay, and uploading it from the browser, have never run. Open before it
  can go live: how the relay reaches the builder, moving nearly 900 MiB
  through it, and fixing the builder in the app.
- *What it still does not give:* a measurement of the image's content at each
  start. The proof is indirect: measured builder, plus a secret only the
  vault has.

## Variant 3: a measured root filesystem (dm-verity)

- dm-verity checks every block of a read-only device against a hash tree; its
  root hash must come from somewhere trusted
  ([kernel documentation](https://docs.kernel.org/admin-guide/device-mapper/verity.html):
  "there is no other authenticity beyond this point").
- Put on the measured boot line (`roothash=`, see
  [systemd-veritysetup-generator](https://www.freedesktop.org/software/systemd/man/latest/systemd-veritysetup-generator.html)),
  the root hash becomes part of the launch measurement. The report then covers
  the root filesystem's content too, and anyone can recompute it from the
  published image.
- *Costs:* the root is read-only, so writable state needs its own encrypted
  area; dm-verity gives integrity, not secrecy, so the image is public (ours
  holds no secret, so that fits); every image change changes the measurement.
- *Where we use it:* the image builder of variant 2 runs this way on Aleph
  (a "V-PROGRAM": its root filesystem and its workload volume are on the boot
  line by their root hashes, see [`builder/vprogram/`](../builder/vprogram/README.md)).
  The Paperless VM does not; Aleph's documentation describes kernel, initrd
  and the attestation agent of a V-PROGRAM as measurement inputs
  ([aleph-vm](https://github.com/aleph-im/aleph-vm/blob/main/doc/confidential.md)).
- A V-PROGRAM is closed to the outside except for the attested port
  ([your own image](own-image.md#the-pieces)). Paperless fetches mail and
  uploads backups, so it cannot simply be moved there as it is; that is our
  reading, not something we have tried.

## Variant 4: a virtual TPM inside the guest

- With SEV-SNP's privilege levels, a small service module (SVSM) can run
  beside the guest's operating system and emulate devices the host must not
  control, a TPM among them
  ([kernel patch series](https://lkml.iu.edu/hypermail/linux/kernel/2504.1/05400.html),
  [Linux driver](https://raw.githubusercontent.com/torvalds/linux/master/drivers/char/tpm/tpm_svsm.c),
  [COCONUT-SVSM](https://github.com/coconut-svsm/svsm)).
- The launch measurement then covers firmware and SVSM; everything later
  (boot loader, kernel, initrd, root hash) is measured step by step into the
  TPM's registers, and a TPM quote is tied to the hardware report. This is
  the ordinary "measured boot", rooted in the processor instead of a chip on
  the board.
- *State:* in COCONUT-SVSM the TPM forgets its state at each start;
  keeping state across starts is experimental, and its documentation names
  an open point: nothing yet prevents starting two VMs from the same state
  ([persistence](https://coconut-svsm.github.io/svsm/developer/PERSISTENCE/)).
- How the SVSM specification binds the TPM's key to the report in detail is
  **not verified by us** (AMD publication 58019 not read).
- Aleph does not offer this, as far as its documentation says.

## Variant 5: Intel TDX

- TDX has one build-time measurement (MRTD, the virtual firmware) and four
  runtime registers: RTMR0 for firmware configuration, RTMR1 for what the
  firmware loads (the OS loader), RTMR2 for kernel, initrd and boot
  parameters, RTMR3 reserved for the guest
  ([Intel's virtual firmware design guide](https://cdrdv2-public.intel.com/733585/tdx-virtual-firmware-design-guide-rev-004-20231206.pdf)).
- The guest's report is only checkable on the same machine; a quoting enclave
  turns it into a quote that can be verified elsewhere, with Intel's
  certificates
  ([kernel documentation](https://docs.kernel.org/arch/x86/tdx.html),
  [Intel's enabling guide](https://cc-enabling.trustedservices.intel.com/intel-tdx-enabling-guide/02/infrastructure_setup/)).
- Compared with SEV-SNP's single launch measurement: the split into registers
  lets a verifier accept a firmware and a kernel separately, at the price of
  having to replay an event log. The question of the root disk is the same
  (variant 1, 2 or 3).
- Aleph's confidential nodes are AMD machines; we have not run anything on
  TDX.

## Variant 6: confidential VMs of the large clouds

What differs from the variants above is who supplies the firmware and who
checks the report.

| | Firmware | Report checked by | What the customer can measure |
|---|---|---|---|
| **Azure** | Microsoft's, with a paravisor (OpenHCL) between hardware and guest ([OpenVMM guide](https://openvmm.dev/guide/user_guide/openhcl.html)) | At boot, Microsoft's attestation service, which then releases the keys for the TPM's state and the OS disk ([overview](https://learn.microsoft.com/en-us/azure/attestation/overview)); the boot phase "is opaque to the user" ([FAQ](https://learn.microsoft.com/en-us/azure/confidential-computing/confidential-vm-faq)) | The raw SNP report is readable from the virtual TPM and can be verified against AMD's keys; it binds the TPM's key, so TPM quotes chain to the hardware ([how-to](https://learn.microsoft.com/en-us/azure/confidential-computing/how-to-leverage-virtual-tpms-in-azure-confidential-vms)) |
| **Google Cloud** | "The firmware is managed by Google" ([verify firmware](https://docs.cloud.google.com/confidential-computing/confidential-vm/docs/verify-firmware)) | The customer, with hardware-signed SNP reports or TDX quotes; the virtual TPM is Google's software ([attestation](https://docs.cloud.google.com/confidential-computing/confidential-vm/docs/attestation)) | The report's measurement against a launch endorsement signed by Google for its firmware |
| **AWS (EC2, SEV-SNP)** | Amazon's OVMF, published and reproducibly buildable ([aws/uefi](https://github.com/aws/uefi)) | The customer, against AMD's keys ([SNP attestation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/snp-attestation.html)) | The firmware: the measurement is recomputed from the firmware and the vCPU count. The kernel and the machine image are not inputs of that computation |

Not verified by us: whether a customer can replace the firmware or paravisor
on Azure or Google Cloud (the documents say who manages it, not that it
cannot be replaced), and an explicit statement by AWS that kernel and image
are outside the measurement (it follows from the inputs of the published
computation). AWS Nitro Enclaves are a different mechanism (a document signed
by Amazon's hypervisor, not by the processor) and not compared here.

In all three, the measurement the hardware signs covers the provider's
firmware. What runs above it is established by a virtual TPM (variant 4's
idea) or left to the customer. In variant 1 and 3 on Aleph, the person's own
device computes the measurement from a public runtime, down to the initrd and
the boot line.

## Aleph's two generations

- Aleph's documentation for confidential instances describes the older flow
  with AMD SEV: the owner checks the certificate chain and a launch
  measurement of the firmware (OVMF with GRUB built in), then injects the
  disk's key into the paused VM, and GRUB opens the disk
  ([aleph-vm](https://github.com/aleph-im/aleph-vm/blob/main/doc/confidential.md),
  [introduction](https://docs.aleph.cloud/devhub/compute-resources/confidential-instances/01-confidential-instance-introduction.html)).
  Whether that measurement covers more than firmware and GRUB is **not
  verified by us**.
- Paperless anywhere uses the SEV-SNP runtime instead: a published bundle of
  firmware, kernel and initrd, a measurement the client computes, and a
  report fetched from the running guest
  ([`runtime-pin.js`](../pwa/src/lib/runtime-pin.js), [workflow](workflow.md)).

## About the disk encryption itself

LUKS2 with AES-XTS, the default
([cryptsetup FAQ](https://gitlab.com/cryptsetup/cryptsetup/-/raw/main/FAQ.md)),
keeps content secret but does not authenticate it: length-preserving modes
"can provide only confidentiality protection, not cryptographically sound
data integrity protection"
([cryptsetup(8)](https://man7.org/linux/man-pages/man8/cryptsetup.8.html)).
A block changed on purpose decrypts to garbage, not to chosen content, and
without the key no chosen content can be written. Authenticated modes exist
(with dm-integrity: a changed block gives a read error,
[kernel documentation](https://docs.kernel.org/admin-guide/device-mapper/dm-integrity.html))
but are marked experimental and do not stop an old state from being replayed
([release notes](https://gitlab.com/cryptsetup/cryptsetup/-/raw/main/docs/v2.0.0-ReleaseNotes)).
dm-verity (variant 3) is the stronger answer for a disk that does not change.

## Side by side

| | Measured by the hardware | Opens the disk | Who holds that | Checked by | The person can verify |
|---|---|---|---|---|---|
| **1. One passphrase per image** (today) | firmware, kernel, initrd, owner | image passphrase | Le Space, every app, every VM of that image | the person's browser | the measurement, the report, the owner; not the image's content |
| **2. An image per person** (in preparation) | as 1; the builder as 3 | passphrase from the vault | that vault; the builder during a build; the VM at boot | the person's browser | as 1, and that only an image sealed with their passphrase can start |
| **3. Measured root** (our builder) | as 1, and the root filesystem by its root hash | nothing: the root is public and read-only | nobody | the person's browser | the whole content, by recomputing the measurement |
| **4. Virtual TPM** | firmware and service module; the rest step by step into the TPM | a key the TPM releases for the right measurements | the TPM in the guest | the person or a key service | depends on who verifies the quote |
| **5. Intel TDX** | firmware (MRTD); loader, kernel, initrd, boot line (RTMRs) | as 1, 2 or 3 | as there | the person, with Intel's certificates | as there |
| **6. Large clouds** | the provider's firmware | usually the virtual TPM, after the provider's or the customer's check | the provider's key service, or the customer's | the provider's service, the customer, or both | the report against the manufacturer's keys; the firmware as far as the provider publishes it |

## Not verified by us

- AMD's specifications (SEV-SNP ABI, key service, SVSM) could not be fetched
  while this page was written; what is said about report fields and the
  certificate chain comes from the documents linked above, which restate them.
- How QEMU measures the page with the kernel hashes for SEV-SNP in detail.
- How the SVSM specification binds the virtual TPM to the report.
- Whether customers can replace firmware or paravisor on Azure and Google
  Cloud.
- AWS: an explicit statement that kernel and machine image are not measured.
- Aleph's older SEV flow: what its launch measurement covers beyond firmware
  and GRUB.

Corrections with a source are welcome as an issue or a pull request. A
weakness in Paperless anywhere itself: please report it privately to the
maintainer, not in an issue.

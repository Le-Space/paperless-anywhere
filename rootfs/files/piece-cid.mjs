// node piece-cid.mjs <file>: the Filecoin piece CID of a file, read as a
// stream. paperless-restore compares it with the piece it asked for: the
// content address, checked without trusting the provider or a ledger.
// Bundled with esbuild into /opt/backup-filecoin/piece-cid.mjs by build-image.sh.
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { calculate } from '@filoz/synapse-core/piece'

const file = process.argv[2]
if (!file) {
  console.error('usage: node piece-cid.mjs <file>')
  process.exit(2)
}
console.log((await calculate(Readable.toWeb(createReadStream(file)))).toString())

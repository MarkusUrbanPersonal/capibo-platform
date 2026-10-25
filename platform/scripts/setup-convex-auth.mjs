// One-time setup for Convex Auth on the current deployment (the one in .env.local):
// generates the RS256 key pair that signs session tokens and stores it, plus SITE_URL,
// as Convex environment variables. Same values `npx @convex-dev/auth` would set.
//
//   npm run setup:auth            skip if keys already exist
//   npm run setup:auth -- --force rotate keys (signs everyone out)
//   npm run setup:auth -- --prod  target the production deployment instead
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:5173'
// `--prod` is passed through to every `convex env` call.
const target = process.argv.includes('--prod') ? ['--prod'] : []
const convexBin = fileURLToPath(new URL('../node_modules/convex/bin/main.js', import.meta.url))

// No shell, and values go through stdin, so the PEM (which starts with "-") and the
// JSON reach the CLI untouched.
const convex = (args, input) =>
  execFileSync(process.execPath, [convexBin, ...args], { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] })
const setEnv = (name, value) => convex(['env', 'set', ...target, name], value)

const existing = convex(['env', 'list', ...target])
// `env list` prints `NAME=value`, or just `NAME` when run by an agent.
if (/^JWT_PRIVATE_KEY(=|\s*$)/m.test(existing) && !process.argv.includes('--force')) {
  console.log('Convex Auth keys already set. Pass --force to rotate them.')
} else {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
  const jwks = JSON.stringify({ keys: [{ use: 'sig', ...publicKey.export({ format: 'jwk' }), alg: 'RS256' }] })
  setEnv('JWT_PRIVATE_KEY', pem.trimEnd().replace(/\n/g, ' '))
  setEnv('JWKS', jwks)
  console.log('Set JWT_PRIVATE_KEY and JWKS.')
}
setEnv('SITE_URL', SITE_URL)
console.log(`Set SITE_URL=${SITE_URL}.`)

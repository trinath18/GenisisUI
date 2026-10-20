import crypto from 'node:crypto'

/**
 * Signs a login token the way the API's TokenService does (HS256, issuer/audience "Genisis"), so the suite can drive the real UI
 * without anyone's password. Needs the same key the API instance under test was started with (Auth__JwtKey).
 */
const key = process.env.E2E_JWT_KEY
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')

export function mint(access = '1'.repeat(30), user = 'E2E') {
  if (!key || key.length < 32) throw new Error('Set E2E_JWT_KEY to the Auth__JwtKey (32+ characters) of the API instance under test.')
  const header = b64({ alg: 'HS256', typ: 'JWT' })
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600
  const payload = b64({
    sub: user,
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': user,
    name: 'E2E Tester',
    usr_access: access,
    exp,
    iss: 'Genisis',
    aud: 'Genisis',
  })
  return `${header}.${payload}.${crypto.createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url')}`
}

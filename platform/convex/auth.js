import { convexAuth } from '@convex-dev/auth/server'
import { Password } from '@convex-dev/auth/providers/Password'
import { ConvexError } from 'convex/values'
import { createOrganization } from './lib/orgs'

const EMAIL_RE = /^\S+@\S+\.\S+$/

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? '').trim().toLowerCase()
        if (!EMAIL_RE.test(email)) throw new ConvexError('Enter a valid email address')
        if (params.flow !== 'signUp') return { email }
        const name = String(params.name ?? '').trim()
        if (!name) throw new ConvexError('Enter your name')
        return { email, name, company: String(params.company ?? '').trim() || undefined }
      },
      validatePasswordRequirements(password) {
        if (!password || password.length < 8) throw new ConvexError('Password must be at least 8 characters')
      },
    }),
  ],
  callbacks: {
    // First sign-up for an email: join the organizations that invited it, or start a new one.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId, profile }) {
      if (existingUserId) return
      const email = profile.email
      const name = profile.name ?? email.split('@')[0]
      const invites = await ctx.db
        .query('members')
        .withIndex('by_email', (q) => q.eq('email', email))
        .filter((q) => q.eq(q.field('pending'), true))
        .collect()
      if (invites.length) {
        for (const m of invites) await ctx.db.patch(m._id, { userId, name, pending: false, lastActiveAt: Date.now() })
        return
      }
      await createOrganization(ctx, { userId, email, name, company: profile.company })
    },
  },
})

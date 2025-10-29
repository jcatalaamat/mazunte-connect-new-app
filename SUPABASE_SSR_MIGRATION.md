# Supabase SSR Migration - Fix for React 19 Hooks Error

## Problem

The application was experiencing React hooks errors when running the Next.js dev server:

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
TypeError: Cannot read properties of null (reading 'useState')
TypeError: Cannot read properties of null (reading 'useInsertionEffect')
```

## Root Cause

The issue was caused by **deprecated Supabase authentication packages** that are **not compatible with React 19**:

- `@supabase/auth-helpers-nextjs@0.10.0`
- `@supabase/auth-helpers-react@0.5.0`

These packages are officially deprecated by Supabase and have not been updated to support React 19, which is used in this monorepo.

## Solution: Migrate to @supabase/ssr

The correct fix was to migrate from the deprecated auth helpers to Supabase's modern SSR package.

### Package Changes

#### Removed:
```json
{
  "@supabase/auth-helpers-nextjs": "^0.10.0",
  "@supabase/auth-helpers-react": "^0.5.0"
}
```

#### Added:
```json
{
  "@supabase/ssr": "^0.7.0"
}
```

### Code Changes

#### 1. AuthProvider (`packages/app/provider/auth/AuthProvider.tsx`)

**Before** (using deprecated package):
```tsx
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'

export const AuthProvider = ({ initialSession, children }) => {
  const [supabaseClient] = useState(() => createPagesBrowserClient<Database>())

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={initialSession}>
      {children}
    </SessionContextProvider>
  )
}
```

**After** (using @supabase/ssr):
```tsx
import { createBrowserClient } from '@supabase/ssr'

const Context = createContext<SupabaseContext | undefined>(undefined)

export const AuthProvider = ({ children }) => {
  const [supabase] = useState(() =>
    createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  )

  return (
    <Context.Provider value={{ supabase }}>
      <AuthStateChangeHandler />
      {children}
    </Context.Provider>
  )
}

export const useSupabaseClient = () => {
  const context = useContext(Context)
  if (context === undefined) {
    throw new Error('useSupabaseClient must be used within AuthProvider')
  }
  return context.supabase
}
```

#### 2. Session Hook (`packages/app/utils/supabase/useSessionContext.ts`)

**Before**:
```tsx
export { useSessionContext } from '@supabase/auth-helpers-react'
```

**After**:
```tsx
import { useSupabaseClient } from '../../provider/auth/AuthProvider'

export const useSessionContext = () => {
  const supabase = useSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return { session, isLoading, supabaseClient: supabase }
}
```

#### 3. Middleware (`apps/next/middleware.ts`)

**Before**:
```tsx
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

const supabase = createMiddlewareClient({ req, res })
```

**After**:
```tsx
import { createServerClient } from '@supabase/ssr'

const supabase = createServerClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({
          request: { headers: req.headers },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        )
      },
    },
  }
)
```

#### 4. tRPC Context (`packages/api/src/trpc.ts`)

**Before**:
```tsx
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

let supabase = createRouteHandlerClient<Database>({
  cookies: () => cookiesStore as never,
})
```

**After**:
```tsx
import { createServerClient } from '@supabase/ssr'

let supabase = createServerClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        return cookiesStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookiesStore.set(name, value, options)
        })
      },
    },
  }
)
```

#### 5. useSupabase Hook (`packages/app/utils/supabase/useSupabase.ts`)

**Before**:
```tsx
import { useSupabaseClient } from '@supabase/auth-helpers-react'

export const useSupabase = () => {
  return useSupabaseClient<Database>()
}
```

**After**:
```tsx
import { useSupabaseClient } from '../../provider/auth/AuthProvider'

export const useSupabase = () => {
  return useSupabaseClient()
}
```

#### 6. Native AuthProvider (`packages/app/provider/auth/AuthProvider.native.tsx`)

**Before**:
```tsx
import type { Session, SessionContext as SessionContextHelper } from '@supabase/auth-helpers-react'
```

**After**:
```tsx
import { type Session } from '@supabase/supabase-js'

type SessionContextHelper = {
  session: Session | null
  error: AuthError | null
  isLoading: boolean
  supabaseClient: typeof supabase
}
```

## Migration Steps

If you need to replicate this migration:

1. **Remove deprecated packages**:
   ```bash
   yarn workspace next-app remove @supabase/auth-helpers-nextjs @supabase/auth-helpers-react
   yarn workspace app remove @supabase/auth-helpers-nextjs @supabase/auth-helpers-react
   cd packages/api && yarn remove @supabase/auth-helpers-nextjs @supabase/auth-helpers-react
   ```

2. **Add new package**:
   ```bash
   yarn workspace next-app add @supabase/ssr
   yarn workspace app add @supabase/ssr
   ```

3. **Update all files** as documented above in the "Code Changes" section.

4. **Test the application**:
   ```bash
   yarn build
   yarn web
   ```

## Key Takeaways

1. **The issue was incompatible Supabase packages** - The deprecated auth helpers don't support React 19.

2. **Migration is straightforward** - The new `@supabase/ssr` package provides clear APIs for browser and server contexts.

3. **Always check package compatibility** - When using bleeding-edge versions (like React 19), ensure all dependencies support it.

4. **Follow official migration guides** - Supabase has deprecated the auth helpers in favor of `@supabase/ssr`. See: https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers

## Resources

- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Migrating from Auth Helpers to SSR](https://supabase.com/docs/guides/auth/server-side/migrating-to-ssr-from-auth-helpers)
- [React 19 Release Notes](https://react.dev/blog/2024/04/25/react-19)

## Files Modified

- `packages/app/provider/auth/AuthProvider.tsx`
- `packages/app/provider/auth/AuthProvider.native.tsx`
- `packages/app/utils/supabase/useSessionContext.ts`
- `packages/app/utils/supabase/useSupabase.ts`
- `apps/next/middleware.ts`
- `packages/api/src/trpc.ts`
- `apps/next/package.json`
- `packages/app/package.json`
- `packages/api/package.json`

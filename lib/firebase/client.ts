"use client"

// FreshLink — Firebase client (dynamic imports — works without firebase installed)

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _app: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFirebaseApp(): Promise<any> {
  if (_app) return _app
  const { initializeApp, getApps } = await import("firebase/app" as never)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apps = (getApps as any)()
  _app = apps.length
    ? apps[0]
    : (initializeApp as (cfg: unknown) => unknown)({
        apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      })
  return _app
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFirestoreDb(): Promise<any> {
  if (_db) return _db
  const { getFirestore } = await import("firebase/firestore" as never)
  const app = await getFirebaseApp()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _db = (getFirestore as any)(app)
  return _db
}

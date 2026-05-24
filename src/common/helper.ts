export function getStoragePublicUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_BUCKET}/${path}`
}

export function resolveStoragePublicUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  if (path.startsWith('/uploads')) {
    const base = process.env.PUBLIC_URL || 'http://localhost:3002'
    return `${base}${path}`
  }
  return getStoragePublicUrl(path)
}
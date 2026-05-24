import { BadRequestException, Injectable } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { supabase } from '@/common/supabase/supabase.providers'
import { getStoragePublicUrl } from '@/common/helper'

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024
const LOGO_MAX_BYTES = 2 * 1024 * 1024

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const LOGO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/jpg',
])

export interface UploadImageParams {
  folder: string
  ownerId: string
  file: Express.Multer.File
  upsert?: boolean
}

@Injectable()
export class SupabaseStorageService {
  validateImage(
    file: Express.Multer.File | undefined,
    opts?: { maxBytes?: number; allowLogo?: boolean },
  ): void {
    if (!file) {
      throw new BadRequestException('File is required')
    }

    const allowed = opts?.allowLogo ? LOGO_MIME_TYPES : IMAGE_MIME_TYPES
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        opts?.allowLogo
          ? 'Logo must be PNG or JPG'
          : 'Only JPG, PNG, WEBP allowed',
      )
    }

    const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File must be under ${Math.round(maxBytes / (1024 * 1024))}MB`,
      )
    }
  }

  buildPath(folder: string, ownerId: string, file: Express.Multer.File): string {
    const ext = this.extensionFromMime(file.mimetype, file.originalname)
    return `${folder}/${ownerId}/${randomUUID()}.${ext}`
  }

  async upload(params: UploadImageParams): Promise<string> {
    const { folder, ownerId, file, upsert = false } = params
    const path = this.buildPath(folder, ownerId, file)

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET!)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert,
      })

    if (error) {
      throw new BadRequestException(error.message)
    }

    return path
  }

  async uploadMany(
    folder: string,
    ownerId: string,
    files: Express.Multer.File[],
  ): Promise<string[]> {
    if (!files?.length) {
      throw new BadRequestException('At least one file is required')
    }

    const paths: string[] = []
    for (const file of files) {
      this.validateImage(file)
      paths.push(await this.upload({ folder, ownerId, file }))
    }
    return paths
  }

  async remove(path: string | null | undefined): Promise<void> {
    if (!path || path.startsWith('http') || path.startsWith('/uploads')) {
      return
    }

    try {
      await supabase.storage
        .from(process.env.SUPABASE_BUCKET!)
        .remove([path])
    } catch (err) {
      console.error('Storage delete failed', err)
    }
  }

  async removeMany(paths: string[]): Promise<void> {
    const storagePaths = paths.filter(
      (p) => p && !p.startsWith('http') && !p.startsWith('/uploads'),
    )
    if (!storagePaths.length) return

    try {
      await supabase.storage
        .from(process.env.SUPABASE_BUCKET!)
        .remove(storagePaths)
    } catch (err) {
      console.error('Storage bulk delete failed', err)
    }
  }

  toPublicUrl(path?: string | null): string | null {
    if (!path) return null
    if (path.startsWith('http')) return path
    return getStoragePublicUrl(path)
  }

  toPublicUrls(paths: string[] | undefined | null): string[] {
    if (!paths?.length) return []
    return paths.map((p) => this.toPublicUrl(p) ?? p)
  }

  validateLogo(file?: Express.Multer.File): void {
    this.validateImage(file, { maxBytes: LOGO_MAX_BYTES, allowLogo: true })
  }

  private extensionFromMime(mimetype: string, originalname: string): string {
    if (mimetype === 'image/png') return 'png'
    if (mimetype === 'image/webp') return 'webp'
    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return 'jpg'
    const fromName = originalname.split('.').pop()?.toLowerCase()
    if (fromName && ['png', 'jpg', 'jpeg', 'webp'].includes(fromName)) {
      return fromName === 'jpeg' ? 'jpg' : fromName
    }
    return 'jpg'
  }
}

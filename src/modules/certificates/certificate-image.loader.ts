import { Injectable } from '@nestjs/common'
import * as fs from 'fs/promises'
import * as path from 'path'
import sharp = require('sharp')
import { resolveStoragePublicUrl } from '@/common/helper'

@Injectable()
export class CertificateImageLoader {
  private brandingDirs(): string[] {
    return [
      path.join(process.cwd(), 'src', 'assets', 'branding'),
      path.join(process.cwd(), 'dist', 'assets', 'branding'),
      path.join(process.cwd(), 'assets', 'branding'),
    ]
  }

  async loadFromUrlOrPath(urlOrPath?: string | null): Promise<Buffer | null> {
    if (!urlOrPath?.trim()) return null

    const trimmed = urlOrPath.trim()

    if (trimmed.startsWith('/uploads')) {
      const buf = await this.readLocal(path.join(process.cwd(), trimmed.replace(/^\//, '')))
      return this.ensurePdfSafeImage(buf)
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        const pathname = new URL(trimmed).pathname
        if (pathname.startsWith('/uploads')) {
          const local = await this.readLocal(
            path.join(process.cwd(), pathname.replace(/^\//, '')),
          )
          const safe = await this.ensurePdfSafeImage(local)
          if (safe) return safe
        }
      } catch {
        /* try fetch */
      }
      const fetched = await this.fetchUrl(trimmed)
      return this.ensurePdfSafeImage(fetched)
    }

    const publicUrl = resolveStoragePublicUrl(trimmed)
    if (publicUrl && publicUrl !== trimmed) {
      const fromStorage = await this.fetchUrl(publicUrl)
      const safe = await this.ensurePdfSafeImage(fromStorage)
      if (safe) return safe
    }

    const absolute = path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed)
    const buf = await this.readLocal(absolute)
    return this.ensurePdfSafeImage(buf)
  }

  async loadInternzaMark(): Promise<Buffer | null> {
    for (const dir of this.brandingDirs()) {
      const pngPath = path.join(dir, 'internza-mark.png')
      const svgPath = path.join(dir, 'internza-icon.svg')
      try {
        return await fs.readFile(pngPath)
      } catch {
        /* try svg */
      }
      try {
        const svg = await fs.readFile(svgPath)
        return await sharp(svg).resize(128, 128).png().toBuffer()
      } catch {
        /* try next dir */
      }
    }
    return null
  }

  private async readLocal(filePath: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(filePath)
    } catch {
      return null
    }
  }

  private async fetchUrl(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  /**
   * PDFKit supports PNG/JPEG best. College logos may be WEBP or even non-image bytes
   * (HTML error pages, etc). This normalizes to a safe PNG or returns null.
   */
  private async ensurePdfSafeImage(buffer: Buffer | null): Promise<Buffer | null> {
    if (!buffer || buffer.length < 16) return null
    try {
      const img = sharp(buffer, { failOnError: false })
      const meta = await img.metadata()
      if (!meta.format || !meta.width || !meta.height) return null

      // Always normalize to PNG to avoid WEBP/odd encodings causing PDFKit NaNs.
      return await img.png().toBuffer()
    } catch {
      return null
    }
  }
}

import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { randomUUID } from 'crypto'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg'])

@Injectable()
export class StorageService {
  private readonly uploadRoot: string
  private readonly publicBase: string

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = this.config.get<string>('UPLOAD_ROOT') || path.join(process.cwd(), 'uploads')
    this.publicBase = this.config.get<string>('PUBLIC_URL') || 'http://localhost:3002'
  }

  validateLogo(file?: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Logo file is required')
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG or JPG')
    }
    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo must be under 2MB')
    }
  }

  async saveCollegeLogo(collegeId: string, file: Express.Multer.File): Promise<string> {
    this.validateLogo(file)
    const ext = file.mimetype === 'image/png' ? 'png' : 'jpg'
    const dir = path.join(this.uploadRoot, 'colleges', collegeId)
    await fs.mkdir(dir, { recursive: true })
    const filename = `logo.${ext}`
    const fullPath = path.join(dir, filename)
    await fs.writeFile(fullPath, file.buffer)
    return `/uploads/colleges/${collegeId}/${filename}`
  }

  getPublicUrl(relativePath: string): string {
    return `${this.publicBase}${relativePath}`
  }
}

import { Global, Module } from '@nestjs/common'
import { SupabaseStorageService } from '@/common/services/supabase-storage.service'

@Global()
@Module({
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class StorageModule {}

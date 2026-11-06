import { Controller, HttpCode, Inject, Injectable, Module, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { perMinute } from '../../common/utils/rate-limit';
import { OptionalAuth } from '../../common/decorators/auth.decorators';
import { REPO, type IngredientsRepository } from '../../database/repositories';
import type { Ingredient } from '../../domain/types';
import { AiServiceClient } from '../../integrations/ai-service/ai.client';
import { validateImage, type UploadedImage } from '../../integrations/storage/image-validation';

export const SCAN_MAX_BYTES = 8 * 1024 * 1024;
export const LIKELY_THRESHOLD = 0.8;
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Maps a free-text AI label ("red onions", "Haldi") to a catalogue ingredient, or null. */
export function matchIngredient(label: string, catalogue: Ingredient[]): Ingredient | null {
  const l = norm(label);
  if (!l) return null;
  const sing = l.replace(/(es|s)$/, '');
  const names = (i: Ingredient) => [i.name, ...(i.aliases ?? [])].map(norm);
  return catalogue.find((i) => names(i).some((n) => n === l || n === sing))
    ?? catalogue.find((i) => names(i).some((n) => n.length > 3 && (l.includes(n) || (sing.length > 3 && n.includes(sing)))))
    ?? null;
}

@Injectable()
export class ScannerService {
  constructor(private readonly ai: AiServiceClient, @Inject(REPO.ingredients) private readonly ingredients: IngredientsRepository) {}

  /**
   * Validates the photo, asks the AI service what it sees, and maps labels to the catalogue.
   * Nothing is auto-confirmed: every detection needs the user's confirmation; low-confidence ones are flagged.
   */
  async scan(file: UploadedImage | undefined) {
    validateImage(file, { maxBytes: SCAN_MAX_BYTES, allowed: ['image/jpeg', 'image/png', 'image/webp'], label: 'ingredient photo' });
    const r = await this.ai.postImage<{ detections: { label: string; confidence: number }[]; model?: string }>('/v1/vision/ingredients', file!);
    const catalogue = await this.ingredients.all();
    const best = new Map<string, { ingredient: Ingredient; confidence: number; label: string }>();
    const unmatched: { label: string; confidence: number }[] = [];
    for (const d of Array.isArray(r?.detections) ? r.detections.slice(0, 40) : []) {
      const confidence = Math.min(1, Math.max(0, Number(d.confidence) || 0));
      const label = String(d.label ?? '').slice(0, 60);
      if (!label) continue;
      const ing = matchIngredient(label, catalogue);
      if (!ing) { unmatched.push({ label, confidence }); continue; }
      const prev = best.get(ing.id);
      if (!prev || prev.confidence < confidence) best.set(ing.id, { ingredient: ing, confidence, label });
    }
    const detections = [...best.values()].sort((a, b) => b.confidence - a.confidence).map((d) => ({
      ingredientId: d.ingredient.id, name: d.ingredient.name, emoji: d.ingredient.emoji, label: d.label,
      confidence: Math.round(d.confidence * 100) / 100, status: d.confidence >= LIKELY_THRESHOLD ? 'likely' : 'uncertain',
    }));
    return {
      detections, unmatched, requiresConfirmation: true,
      message: detections.length ? 'Check the list and confirm what you actually have.' : 'Nothing recognisable was found — try a clearer, well-lit photo, or add ingredients manually.',
    };
  }
}

@ApiTags('Scanner')
@Controller('scanner')
export class ScannerController {
  constructor(private readonly svc: ScannerService) {}
  @OptionalAuth() @Throttle(perMinute(10))
  @Post('ingredients') @HttpCode(200) @UseInterceptors(FileInterceptor('image', { limits: { fileSize: SCAN_MAX_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data') @ApiBody({ schema: { type: 'object', required: ['image'], properties: { image: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Detect ingredients in a photo (JPG/PNG/WebP, ≤ 8 MB). Results must be confirmed by the user.' })
  scan(@UploadedFile() image?: Express.Multer.File) { return this.svc.scan(image); }
}

@Module({ controllers: [ScannerController], providers: [ScannerService] })
export class ScannerModule {}

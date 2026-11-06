import { Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Query, Req, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Public, type AuthUser } from '../../common/decorators/auth.decorators';
import { ParseIdPipe } from '../../common/utils/id.pipe';
import { sniffImage } from '../../integrations/storage/image-validation';
import { StorageService } from '../../integrations/storage/storage.service';
import { CoverDto, CreateMemoryDto, FavouriteDto, MediaQuery, MemoryQueryDto, ReorderDto, UpdateMemoryDto } from './memories.dto';
import { MAX_PHOTO_BYTES, MAX_PHOTOS, MemoriesService } from './memories.service';

const uploads = () => FilesInterceptor('photos', MAX_PHOTOS, { limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_PHOTOS, fields: 20 } });

@ApiTags('Tastory memories') @ApiBearerAuth()
@Controller('memories')
export class MemoriesController {
  constructor(private readonly svc: MemoriesService) {}

  @Get() @ApiOperation({ summary: 'Your memories — search, filter, sort, paginate' })
  list(@CurrentUser() u: AuthUser, @Query() q: MemoryQueryDto) { return this.svc.list(u.id, q); }

  @Get('timeline') @ApiOperation({ summary: 'Memories grouped by month and year (same filters as the list)' })
  timeline(@CurrentUser() u: AuthUser, @Query() q: MemoryQueryDto) { return this.svc.timeline(u.id, q); }

  @Get('statistics') @ApiOperation({ summary: 'Totals for the Tastory header, computed from your memories' })
  statistics(@CurrentUser() u: AuthUser) { return this.svc.statistics(u.id); }

  @Post() @UseInterceptors(uploads()) @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['dish', 'photos'], properties: { dish: { type: 'string' }, date: { type: 'string', example: '2026-10-30' }, caption: { type: 'string' }, notes: { type: 'string' }, rating: { type: 'integer' }, tags: { type: 'string', example: '["comfort","weeknight"]' }, favourite: { type: 'boolean' }, recipeId: { type: 'string' }, photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Create a memory with 1–12 photos (multipart: fields + "photos" files; first photo is the cover)' })
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateMemoryDto, @UploadedFiles() files: Express.Multer.File[] = []) { return this.svc.create(u.id, dto, files); }

  @Get(':id') @ApiOperation({ summary: 'One memory' }) get(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string) { return this.svc.get(u.id, id); }

  @Patch(':id') @ApiOperation({ summary: 'Edit dish, date, caption, notes, rating, tags, favourite or linked recipe' })
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string, @Body() dto: UpdateMemoryDto) { return this.svc.update(u.id, id, dto); }

  @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Delete a memory and its photos' })
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string) { return this.svc.remove(u.id, id); }

  @Patch(':id/favourite') @ApiOperation({ summary: 'Set or toggle favourite' })
  favourite(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string, @Body() dto: FavouriteDto) { return this.svc.setFavourite(u.id, id, dto.favourite); }

  @Post(':id/photos') @UseInterceptors(uploads()) @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({ summary: 'Add photos (up to 12 in total)' })
  addPhotos(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string, @UploadedFiles() files: Express.Multer.File[] = []) { return this.svc.addPhotos(u.id, id, files); }

  @Delete(':id/photos/:photoId') @ApiOperation({ summary: 'Remove a photo (a memory keeps at least one)' })
  removePhoto(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string, @Param('photoId', ParseIdPipe) photoId: string) { return this.svc.removePhoto(u.id, id, photoId); }

  @Patch(':id/cover') @ApiOperation({ summary: 'Choose the cover photo' })
  cover(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string, @Body() dto: CoverDto) { return this.svc.setCover(u.id, id, dto.photoId); }

  @Patch(':id/photos/order') @ApiOperation({ summary: 'Reorder photos (first = cover)' })
  reorder(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: string, @Body() dto: ReorderDto) { return this.svc.reorder(u.id, id, dto.photoIds); }
}

/** Serves a private photo only for a valid, unexpired signed link. */
@ApiTags('Tastory memories')
@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Public() @Get('*key') @Header('Cache-Control', 'private, max-age=300') @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({ summary: 'Photo bytes for a signed URL issued by the memories API' })
  async get(@Req() req: Request, @Query() q: MediaQuery) {
    const key = decodeURIComponent(req.path.replace(/^.*?\/media\//, ''));
    this.storage.verify(key, q.exp, q.sig);
    const buf = await this.storage.get(key);
    return new StreamableFile(buf, { type: sniffImage(buf) ?? 'application/octet-stream', disposition: 'inline' });
  }
}

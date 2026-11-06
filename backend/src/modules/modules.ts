import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AiServiceClient } from '../integrations/ai-service/ai.client';
import { StorageService } from '../integrations/storage/storage.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CsrfGuard } from './auth/auth.cookies';
import { MailService } from '../integrations/mail/mail.service';
import { GoogleOAuthClient } from '../integrations/google/google-oauth.client';
import { CookAndChillModule } from './cook-and-chill/cook-and-chill.module';
import { CookingMateModule } from './cooking-mate/cooking-mate.module';
import { CookingSessionsModule } from './cooking-sessions/cooking-sessions.module';
import { FavouritesModule } from './favourites/favourites.module';
import { IngredientsController } from './ingredients/ingredients.controller';
import { InventoryModule } from './inventory/inventory.module';
import { MediaController, MemoriesController } from './memories/memories.controller';
import { MemoriesService } from './memories/memories.service';
import { RecipesController } from './recipes/recipes.controller';
import { RecipesService } from './recipes/recipes.service';
import { RecommendationsController } from './recommendations/recommendations.controller';
import { RecommendationsService } from './recommendations/recommendations.service';
import { ScannerModule } from './scanner/scanner.module';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

/** Shared integrations every feature module can use. */
@Global()
@Module({ imports: [JwtModule.register({})], providers: [AiServiceClient, StorageService, UsersService, MailService, GoogleOAuthClient], exports: [AiServiceClient, StorageService, UsersService, MailService, GoogleOAuthClient, JwtModule] })
export class SharedModule {}

@Module({ controllers: [AuthController], providers: [AuthService, CsrfGuard] })
export class AuthModule {}
@Module({ controllers: [UsersController] })
export class UsersModule {}
@Module({ controllers: [RecipesController, IngredientsController], providers: [RecipesService], exports: [RecipesService] })
export class CatalogModule {}
@Module({ controllers: [RecommendationsController], providers: [RecommendationsService] })
export class RecommendationsModule {}
@Module({ controllers: [MemoriesController, MediaController], providers: [MemoriesService] })
export class MemoriesModule {}

export const FEATURE_MODULES = [
  AuthModule, UsersModule, CatalogModule, InventoryModule, RecommendationsModule, FavouritesModule,
  ScannerModule, CookingSessionsModule, CookingMateModule, CookAndChillModule, MemoriesModule,
];

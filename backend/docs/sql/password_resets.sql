-- OPTIONAL — only if the database owner wants password reset by email.
-- The ranna_mate_updated schema has no table for reset tokens. The backend never runs DDL, so a person with
-- admin rights runs this once, then sets DB_PASSWORD_RESETS_TABLE=password_resets in backend/.env.
-- Only a SHA-256 of each token is stored; tokens are single-use and expire (PASSWORD_RESET_TTL_MINUTES).
CREATE TABLE `password_resets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_resets_token` (`token_hash`),
  KEY `idx_password_resets_user` (`user_id`, `created_at`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

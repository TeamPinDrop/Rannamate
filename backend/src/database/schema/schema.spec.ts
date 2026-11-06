import { parseDump, toMarkdown } from './schema';

const DUMP = `
-- MySQL dump
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`user_id\` int unsigned NOT NULL AUTO_INCREMENT,
  \`email\` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`password_hash\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`created_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`deleted_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`user_id\`),
  UNIQUE KEY \`uq_users_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE \`favourites\` (
  \`user_id\` int unsigned NOT NULL,
  \`recipe_id\` int unsigned NOT NULL,
  PRIMARY KEY (\`user_id\`,\`recipe_id\`),
  KEY \`fk_fav_recipe\` (\`recipe_id\`),
  CONSTRAINT \`fk_fav_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`user_id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

describe('schema dump parser (read-only)', () => {
  const [fav, users] = parseDump(DUMP);
  it('reads columns, nullability, defaults and extras', () => {
    expect(users.name).toBe('users');
    expect(users.columns.map((c) => c.name)).toEqual(['user_id', 'email', 'password_hash', 'created_at', 'deleted_at']);
    expect(users.columns[0]).toMatchObject({ type: 'int unsigned', nullable: false, extra: 'auto_increment' });
    expect(users.columns[4]).toMatchObject({ nullable: true, default: 'NULL' });
    expect(users.collation).toBe('utf8mb4_unicode_ci');
  });
  it('reads keys, indexes and foreign keys', () => {
    expect(users.primaryKey).toEqual(['user_id']);
    expect(users.indexes).toEqual([{ name: 'uq_users_email', columns: ['email'], unique: true }]);
    expect(fav.primaryKey).toEqual(['user_id', 'recipe_id']);
    expect(fav.foreignKeys[0]).toMatchObject({ columns: ['user_id'], refTable: 'users', refColumns: ['user_id'], onDelete: 'CASCADE' });
  });
  it('reports which needed tables are missing', () => {
    const md = toMarkdown([fav, users], 'test');
    expect(md).toContain('| Auth & profile | `users` | ✅ |');
    expect(md).toContain('| Auth & profile | `user_profiles` | ❌ missing |');
  });
});

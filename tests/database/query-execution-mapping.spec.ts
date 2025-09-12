import { createPool, DatabasePool, sql } from 'slonik';
import { z } from 'zod';
import { buildTestConnectionUri } from '../utils/database-test.utils';

describe('Query Execution and Result Mapping', () => {
  let pool: DatabasePool;

  beforeAll(async () => {
    pool = await createPool(buildTestConnectionUri());

    // Create test tables for query testing
    await pool.query(sql.unsafe`
      CREATE TABLE IF NOT EXISTS query_test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(sql.unsafe`
      CREATE TABLE IF NOT EXISTS query_test_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES query_test_users(id),
        title VARCHAR(500) NOT NULL,
        content TEXT,
        tags VARCHAR(50)[],
        view_count INTEGER DEFAULT 0,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  });

  afterAll(async () => {
    await pool.query(sql.unsafe`DROP TABLE IF EXISTS query_test_posts`);
    await pool.query(sql.unsafe`DROP TABLE IF EXISTS query_test_users`);
    await pool.end();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query(
      sql.unsafe`TRUNCATE query_test_posts, query_test_users CASCADE`,
    );
  });

  describe('Basic Query Types', () => {
    it('should execute simple SELECT queries', async () => {
      // Insert test data
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age) 
        VALUES ('John Doe', 'john@example.com', 30)
      `);

      const result = await pool.query(sql.unsafe`
        SELECT name, email, age FROM query_test_users WHERE email = 'john@example.com'
      `);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
      });
    });

    it('should execute parameterized queries safely', async () => {
      const userName = 'Alice Smith';
      const userEmail = 'alice@example.com';
      const userAge = 25;

      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age) 
        VALUES (${userName}, ${userEmail}, ${userAge})
      `);

      const result = await pool.query(sql.unsafe`
        SELECT * FROM query_test_users WHERE email = ${userEmail}
      `);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe(userName);
      expect(result.rows[0].age).toBe(userAge);
    });

    it('should handle INSERT queries with RETURNING', async () => {
      const result = await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age, metadata) 
        VALUES ('Bob Wilson', 'bob@example.com', 35, '{"role": "admin", "preferences": {"theme": "dark"}}')
        RETURNING id, name, email, metadata
      `);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('Bob Wilson');
      expect(result.rows[0].email).toBe('bob@example.com');
      expect(result.rows[0].metadata).toEqual({
        role: 'admin',
        preferences: { theme: 'dark' },
      });
      expect(result.rows[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should handle UPDATE queries', async () => {
      // Insert initial data
      const insertResult = await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age) 
        VALUES ('Charlie Brown', 'charlie@example.com', 28)
        RETURNING id
      `);

      const userId = insertResult.rows[0].id;

      // Update the user
      const updateResult = await pool.query(sql.unsafe`
        UPDATE query_test_users 
        SET age = 29, updated_at = NOW()
        WHERE id = ${userId}
        RETURNING age, updated_at
      `);

      expect(updateResult.rowCount).toBe(1);
      expect(updateResult.rows[0].age).toBe(29);
      expect(updateResult.rows[0].updated_at).toBeInstanceOf(Date);
    });

    it('should handle DELETE queries', async () => {
      // Insert test data
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email) 
        VALUES ('Delete Me', 'delete@example.com')
      `);

      const deleteResult = await pool.query(sql.unsafe`
        DELETE FROM query_test_users WHERE email = 'delete@example.com'
      `);

      expect(deleteResult.rowCount).toBe(1);

      // Verify deletion
      const checkResult = await pool.query(sql.unsafe`
        SELECT COUNT(*) as count FROM query_test_users WHERE email = 'delete@example.com'
      `);
      expect(checkResult.rows[0].count).toBe(0);
    });
  });

  describe('Type Safety and Schema Validation', () => {
    const userSchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      age: z.number().nullable(),
      is_active: z.boolean(),
      metadata: z.record(z.string(), z.any()).nullable(),
      created_at: z.date(),
      updated_at: z.date(),
    });

    it('should validate query results against schema', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age, metadata) 
        VALUES ('Schema Test', 'schema@example.com', 30, '{"test": true}')
      `);

      const result = await pool.query(
        sql.unsafe`SELECT * FROM query_test_users WHERE email = 'schema@example.com'`,
      );

      expect(result.rowCount).toBe(1);
      const user = result.rows[0] as any;

      // Schema validation should pass
      expect(() => userSchema.parse(user)).not.toThrow();
      expect(user.name).toBe('Schema Test');
      expect(user.age).toBe(30);
      expect(user.metadata).toEqual({ test: true });
    });

    it('should handle schema validation errors', async () => {
      // Insert data that violates schema expectations
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (id, name, email) 
        VALUES ('invalid-uuid', 'Invalid User', 'invalid-email')
      `);

      // Schema validation should catch the invalid data
      await expect(
        pool.query(
          sql.type(
            userSchema,
          )`SELECT * FROM query_test_users WHERE name = 'Invalid User'`,
        ),
      ).rejects.toThrow();
    });

    it('should handle nullable fields correctly', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age, metadata) 
        VALUES ('Null Test', 'null@example.com', NULL, NULL)
      `);

      const result = await pool.query(
        sql.type(
          userSchema,
        )`SELECT * FROM query_test_users WHERE email = 'null@example.com'`,
      );

      expect(result.rows[0].age).toBeNull();
      expect(result.rows[0].metadata).toBeNull();
    });
  });

  describe('Complex Query Operations', () => {
    beforeEach(async () => {
      // Insert test data for complex queries
      const userResult = await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age) 
        VALUES 
          ('Author One', 'author1@example.com', 30),
          ('Author Two', 'author2@example.com', 25)
        RETURNING id, name
      `);

      const userId1 = userResult.rows[0].id;
      const userId2 = userResult.rows[1].id;

      await pool.query(sql.unsafe`
        INSERT INTO query_test_posts (user_id, title, content, tags, view_count, published_at) 
        VALUES 
          (${userId1}, 'First Post', 'Content of first post', ARRAY['tech', 'programming'], 100, NOW()),
          (${userId1}, 'Second Post', 'Content of second post', ARRAY['tech', 'javascript'], 50, NOW()),
          (${userId2}, 'Third Post', 'Content of third post', ARRAY['lifestyle'], 25, NULL)
      `);
    });

    it('should execute JOIN queries correctly', async () => {
      const result = await pool.query(sql.unsafe`
        SELECT 
          u.name as author_name,
          p.title,
          p.view_count
        FROM query_test_users u
        INNER JOIN query_test_posts p ON u.id = p.user_id
        WHERE p.published_at IS NOT NULL
        ORDER BY p.view_count DESC
      `);

      expect(result.rowCount).toBe(2);
      expect(result.rows[0].view_count).toBe(100);
      expect(result.rows[1].view_count).toBe(50);
      expect(result.rows[0].author_name).toBe('Author One');
    });

    it('should handle aggregate functions', async () => {
      const result = await pool.query(sql.unsafe`
        SELECT 
          u.name as author_name,
          COUNT(p.id) as post_count,
          COALESCE(SUM(p.view_count), 0) as total_views,
          AVG(p.view_count) as avg_views
        FROM query_test_users u
        LEFT JOIN query_test_posts p ON u.id = p.user_id
        GROUP BY u.id, u.name
        ORDER BY total_views DESC
      `);

      expect(result.rowCount).toBe(2);

      const author1 = result.rows.find(
        (row) => row.author_name === 'Author One',
      );
      expect(author1.post_count).toBe(2);
      expect(author1.total_views).toBe(150);
      expect(author1.avg_views).toBe(75);
    });

    it('should handle array operations', async () => {
      const result = await pool.query(sql.unsafe`
        SELECT title, tags
        FROM query_test_posts
        WHERE 'tech' = ANY(tags)
        ORDER BY title
      `);

      expect(result.rowCount).toBe(2);
      expect(result.rows[0].title).toBe('First Post');
      expect(result.rows[0].tags).toEqual(['tech', 'programming']);
      expect(result.rows[1].title).toBe('Second Post');
      expect(result.rows[1].tags).toEqual(['tech', 'javascript']);
    });

    it('should handle JSON operations', async () => {
      await pool.query(sql.unsafe`
        UPDATE query_test_users 
        SET metadata = '{"role": "admin", "settings": {"notifications": true, "theme": "dark"}}'
        WHERE email = 'author1@example.com'
      `);

      const result = await pool.query(sql.unsafe`
        SELECT 
          name,
          metadata->>'role' as role,
          metadata->'settings'->>'theme' as theme,
          (metadata->'settings'->>'notifications')::boolean as notifications
        FROM query_test_users
        WHERE metadata->>'role' = 'admin'
      `);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].role).toBe('admin');
      expect(result.rows[0].theme).toBe('dark');
      expect(result.rows[0].notifications).toBe(true);
    });
  });

  describe('Pagination and Limiting', () => {
    beforeEach(async () => {
      // Insert multiple users for pagination testing
      const users = Array.from({ length: 15 }, (_, i) => ({
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        age: 20 + i,
      }));

      for (const user of users) {
        await pool.query(sql.unsafe`
          INSERT INTO query_test_users (name, email, age) 
          VALUES (${user.name}, ${user.email}, ${user.age})
        `);
      }
    });

    it('should handle LIMIT and OFFSET correctly', async () => {
      const pageSize = 5;
      const offset = 5;

      const result = await pool.query(sql.unsafe`
        SELECT name, email, age
        FROM query_test_users
        ORDER BY age
        LIMIT ${pageSize} OFFSET ${offset}
      `);

      expect(result.rowCount).toBe(pageSize);
      expect(result.rows[0].age).toBe(25); // 20 + 5 (offset)
      expect(result.rows[4].age).toBe(29); // 20 + 5 + 4
    });

    it('should implement cursor-based pagination', async () => {
      // Get first page
      const firstPage = await pool.query(sql.unsafe`
        SELECT id, name, created_at
        FROM query_test_users
        ORDER BY created_at, id
        LIMIT 5
      `);

      expect(firstPage.rowCount).toBe(5);
      const lastCreatedAt = firstPage.rows[4].created_at;
      const lastId = firstPage.rows[4].id;

      // Get next page using cursor
      const nextPage = await pool.query(sql.unsafe`
        SELECT id, name, created_at
        FROM query_test_users
        WHERE (created_at, id) > (${lastCreatedAt}, ${lastId})
        ORDER BY created_at, id
        LIMIT 5
      `);

      expect(nextPage.rowCount).toBe(5);

      // Ensure no overlap
      const firstPageIds = firstPage.rows.map((row) => row.id);
      const nextPageIds = nextPage.rows.map((row) => row.id);
      const overlap = firstPageIds.filter((id) => nextPageIds.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('Query Performance and Optimization', () => {
    it('should handle large result sets efficiently', async () => {
      // Insert a moderate amount of test data
      const batchSize = 100;
      const users = Array.from({ length: batchSize }, (_, i) => ({
        name: `Batch User ${i + 1}`,
        email: `batch${i + 1}@example.com`,
        age: 20 + (i % 50),
      }));

      // Batch insert
      for (const user of users) {
        await pool.query(sql.unsafe`
          INSERT INTO query_test_users (name, email, age) 
          VALUES (${user.name}, ${user.email}, ${user.age})
        `);
      }

      const startTime = Date.now();

      const result = await pool.query(sql.unsafe`
        SELECT COUNT(*) as total_count, AVG(age) as avg_age
        FROM query_test_users
      `);

      const executionTime = Date.now() - startTime;

      expect(result.rows[0].total_count).toBe(batchSize);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle prepared statement-like behavior', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age) 
        VALUES ('Prep User 1', 'prep1@example.com', 25)
      `);

      // Execute similar queries multiple times
      const emails = ['prep1@example.com', 'nonexistent@example.com'];
      const results: any[] = [];

      for (const email of emails) {
        const result = await pool.query(sql.unsafe`
          SELECT name, age FROM query_test_users WHERE email = ${email}
        `);
        results.push(result);
      }

      expect(results[0].rowCount).toBe(1);
      expect(results[1].rowCount).toBe(0);
    });
  });

  describe('Data Type Handling', () => {
    it('should handle various PostgreSQL data types correctly', async () => {
      const testData = {
        name: 'Type Test User',
        email: 'types@example.com',
        age: 30,
        isActive: true,
        metadata: {
          settings: { theme: 'light' },
          preferences: ['email', 'sms'],
        },
        createdAt: new Date(),
      };

      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age, is_active, metadata, created_at) 
        VALUES (
          ${testData.name}, 
          ${testData.email}, 
          ${testData.age}, 
          ${testData.isActive}, 
          ${JSON.stringify(testData.metadata)}, 
          ${sql.timestamp(testData.createdAt)}
        )
      `);

      const result = await pool.query(sql.unsafe`
        SELECT name, email, age, is_active, metadata, created_at
        FROM query_test_users
        WHERE email = ${testData.email}
      `);

      const row = result.rows[0];
      expect(row.name).toBe(testData.name);
      expect(row.age).toBe(testData.age);
      expect(row.is_active).toBe(testData.isActive);
      expect(row.metadata).toEqual(testData.metadata);
      expect(row.created_at).toBeInstanceOf(Date);
    });

    it('should handle NULL values appropriately', async () => {
      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, age, metadata) 
        VALUES ('Null User', 'null@example.com', NULL, NULL)
      `);

      const result = await pool.query(sql.unsafe`
        SELECT age, metadata FROM query_test_users WHERE email = 'null@example.com'
      `);

      expect(result.rows[0].age).toBeNull();
      expect(result.rows[0].metadata).toBeNull();
    });

    it('should handle date and timestamp operations', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await pool.query(sql.unsafe`
        INSERT INTO query_test_users (name, email, created_at, updated_at) 
        VALUES 
          ('Recent User', 'recent@example.com', ${sql.timestamp(now)}, ${sql.timestamp(now)}),
          ('Old User', 'old@example.com', ${sql.timestamp(yesterday)}, ${sql.timestamp(yesterday)})
      `);

      const result = await pool.query(sql.unsafe`
        SELECT name, created_at
        FROM query_test_users
        WHERE created_at > ${sql.timestamp(yesterday)} + INTERVAL '12 hours'
        ORDER BY created_at DESC
      `);

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('Recent User');
    });
  });
});

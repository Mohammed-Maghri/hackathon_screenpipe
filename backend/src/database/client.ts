import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
// One instance per application, shared by every service; disconnect on app.close().
export function createDatabase(url: string) {
  const schema = new URL(url).searchParams.get('schema') ?? 'public'
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, connectionTimeoutMillis: 5000, max: 10 }, { schema }) })
}
export type Database = ReturnType<typeof createDatabase>

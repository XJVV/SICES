import { PrismaClient } from '@prisma/client'
import { join } from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * URL de la base de datos SIEMPRE portable.
 *
 * Motivo: si el proyecto se copia/descarga a otra máquina, un .env con una
 * ruta absoluta de la máquina original (p. ej. file:/home/z/my-project/db/custom.db)
 * rompería Prisma con "Error code 14: Unable to open the database file".
 *
 * Reglas:
 *  - Se acepta DATABASE_URL solo si es relativa (file:./... file:../...) o si su
 *    ruta absoluta existe dentro del directorio actual del proyecto.
 *  - En cualquier otro caso se calcula una ruta absoluta basada en process.cwd(),
 *    que en `next dev` / `npm start` es siempre la raíz del proyecto.
 */
export function databaseUrl(): string {
  const env = process.env.DATABASE_URL
  if (env && env.startsWith('file:')) {
    const p = env.slice('file:'.length)
    const isRelative = !p.startsWith('/')
    const isInsideProject = p.startsWith(process.cwd())
    if (isRelative || isInsideProject) return env
  }
  return 'file:' + join(process.cwd(), 'db', 'custom.db').replace(/\\/g, '/')
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: databaseUrl() } },
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

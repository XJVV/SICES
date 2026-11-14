// Prueba que la ruta relativa de DATABASE_URL funciona (para el paquete local)
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const invs = await prisma.investigation.findMany();
  const pubs = await prisma.publication.findMany();
  console.log(
    `OK - Investigaciones: ${invs.length}, Publicaciones: ${pubs.length}`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("FALLO:", e.message);
  process.exit(1);
});

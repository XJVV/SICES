# Procedencia y limpieza científica

La base anterior conservaba datos DEMO y tablas sin cabeceras útiles, incluidos ZIP de JAXA. Se remueven de la base curada. Los archivos NASA originales quedan intactos para futuras conversiones manualmente verificadas.

Los resúmenes en español se derivan de los objetivos/descripciones locales de SICES (semillas NASA-PSI). Las asignaciones de hardware se basan en la plataforma existente o la descripción del reto. **No se inventan mediciones**.

Escenarios: `prisma/data/curated_scenarios.csv` es **documentación de referencia**, no datos de experimento. Los valores 21%/14.7psi; 30%/10.2psi; y 100%/4.3psi se citan del reto NASA de 2026. La presión y O2 por sí solas no permiten predecir riesgo real de incendio. El valor lunar es un ejemplo de frontera; no es el estándar único de 2026.

Migración/curación (no automatizar en producción sin copia de seguridad):

```bash
npm run db:setup
PYTHONPATH=python python3 -m sices.ingestion.curate --db db/custom.db --apply --vacuum
```

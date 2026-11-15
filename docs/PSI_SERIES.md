# NASA PSI: analyzed curves

La ingesta de fuentes NASA PSI con investigación ya registrada ahora intenta utilizar el parser del proyecto para recuperar series de tablas experimentales o datos analizados, y las guarda en Dataset/DataSeries con sourceAssetId y rawPointCount.

Se conservan los puntos completos y se genera una copia de presentación; no se infiere combustión ni eventos físicos a partir de nombres ambiguos. Si el parser no reconoce las curvas, el archivo queda en SourceAsset/NormalizedObservation con aviso, sin inventar datos.

El motor de curvas depende de Node.js y de scripts/.parser-build/import-parser.js, que forma parte de este repositorio.

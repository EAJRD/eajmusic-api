import { imageSize } from 'image-size';
import fs from 'fs';

// Same principle as audioValidation.js: read the actual pixel dimensions
// out of the file, don't trust the extension. DSPs (Spotify, Apple Music,
// etc.) reject non-square or low-res artwork at their own ingestion step,
// so this catches it before the artist wastes a submission cycle.
const MIN_DIMENSION_PX = 3000;

export function validateCoverArt(filePath, originalFilename) {
  let dimensions;
  try {
    dimensions = imageSize(fs.readFileSync(filePath));
  } catch {
    return {
      valid: false,
      message: `No pudimos leer "${originalFilename}". El archivo parece estar dañado o no es una imagen válida.`,
    };
  }

  const { width, height, type } = dimensions;
  if (!['jpg', 'jpeg', 'png'].includes((type || '').toLowerCase())) {
    return {
      valid: false,
      message: `"${originalFilename}" no es JPG ni PNG. Solo aceptamos esos dos formatos para la portada.`,
    };
  }

  if (width !== height) {
    return {
      valid: false,
      message: `La portada debe ser perfectamente cuadrada (relación 1:1). "${originalFilename}" mide ${width}x${height}px.`,
    };
  }

  if (width < MIN_DIMENSION_PX) {
    return {
      valid: false,
      message: `La portada es demasiado pequeña (${width}x${height}px). El mínimo es ${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px.`,
    };
  }

  return { valid: true, meta: { width, height, type } };
}

import { parseFile } from 'music-metadata';

// Real technical inspection, not filename/mimetype whitelisting - a .wav
// extension proves nothing about what's actually inside it. Distribution
// platforms require lossless masters, so this rejects lossy formats and
// out-of-range specs outright rather than transcoding server-side (a
// server-side MP3->WAV "fix" would just re-encode a lossy file into a
// lossless container without recovering any real fidelity).
const MIN_SAMPLE_RATE_HZ = 44100;
const MIN_BIT_DEPTH = 16;
const MAX_BIT_DEPTH = 24;

export async function validateAudioFile(filePath, originalFilename) {
  let metadata;
  try {
    metadata = await parseFile(filePath);
  } catch {
    return {
      valid: false,
      message: `No pudimos leer "${originalFilename}". El archivo parece estar dañado o no es un audio válido.`,
    };
  }

  const { container, bitsPerSample, sampleRate, lossless, numberOfChannels } = metadata.format;
  const containerName = (container || '').toUpperCase();
  const isWavOrFlac = containerName.includes('WAV') || containerName.includes('FLAC');

  if (!isWavOrFlac || lossless === false) {
    return {
      valid: false,
      message: `"${originalFilename}" no es un formato profesional sin pérdida. Solo aceptamos WAV o FLAC - sube el archivo maestro original, no una conversión desde MP3.`,
    };
  }

  if (!bitsPerSample || bitsPerSample < MIN_BIT_DEPTH || bitsPerSample > MAX_BIT_DEPTH) {
    return {
      valid: false,
      message: `"${originalFilename}" tiene una profundidad de ${bitsPerSample || 'desconocida'} bits. Debe estar entre 16 y 24 bits.`,
    };
  }

  if (!sampleRate || sampleRate < MIN_SAMPLE_RATE_HZ) {
    return {
      valid: false,
      message: `"${originalFilename}" tiene una frecuencia de muestreo de ${sampleRate ? `${(sampleRate / 1000).toFixed(1)}kHz` : 'desconocida'}. Debe ser de al menos 44.1kHz.`,
    };
  }

  return {
    valid: true,
    meta: {
      container: containerName,
      bitsPerSample,
      sampleRate,
      // Uncompressed PCM bitrate (kbps) - not a "quality" number the way MP3
      // bitrate is, but it's what Track.audioBitrate exists to hold.
      bitrateKbps: Math.round((sampleRate * bitsPerSample * (numberOfChannels || 2)) / 1000),
      durationMs: metadata.format.duration ? Math.round(metadata.format.duration * 1000) : null,
    },
  };
}

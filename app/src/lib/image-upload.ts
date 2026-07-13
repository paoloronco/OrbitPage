import { isAllowedRasterImageFile } from "./media-validation";

const MB = 1024 * 1024;

export const MAX_SOURCE_IMAGE_BYTES = 10 * MB;

const VARIANT_LIMITS = {
  icon: { maxDimension: 256, maxOutputBytes: 256 * 1024 },
  profile: { maxDimension: 512, maxOutputBytes: 512 * 1024 },
  cover: { maxDimension: 1600, maxOutputBytes: Math.floor(1.5 * MB) },
} as const;

export type ImageUploadVariant = keyof typeof VARIANT_LIMITS;

type ImageFileLike = Pick<File, "name" | "type" | "size">;

export function formatFileSize(bytes: number) {
  if (bytes >= MB) return `${Number((bytes / MB).toFixed(1))} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

export function imageSourceValidationError(file: ImageFileLike): string | null {
  if (!isAllowedRasterImageFile(file)) return "Unsupported image type. Use PNG, JPG, GIF, or WebP.";
  if (file.size <= 0) return "The selected image is empty.";
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return `This image is ${formatFileSize(file.size)}. Choose a file up to ${formatFileSize(MAX_SOURCE_IMAGE_BYTES)}; OrbitPage optimizes it automatically.`;
  }
  return null;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("This browser could not optimize the selected image."));
    }, type, quality);
  });
}

function loadImage(file: File) {
  return new Promise<{ image: HTMLImageElement; objectUrl: string }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be decoded."));
    };
    image.src = objectUrl;
  });
}

function outputName(filename: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "image";
  return `${base.slice(0, 80)}.webp`;
}

export async function optimizeImageForUpload(file: File, variant: ImageUploadVariant): Promise<File> {
  const validationError = imageSourceValidationError(file);
  if (validationError) throw new Error(validationError);

  const limits = VARIANT_LIMITS[variant];
  if (file.type === "image/gif") {
    if (file.size > limits.maxOutputBytes) {
      throw new Error(`Animated GIFs cannot be compressed safely. Use one up to ${formatFileSize(limits.maxOutputBytes)}.`);
    }
    return file;
  }

  const { image, objectUrl } = await loadImage(file);
  try {
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("The selected image has invalid dimensions.");
    if (image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("The selected image has too many pixels. Resize it below 40 megapixels first.");
    }

    const baseScale = Math.min(1, limits.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const attempts = [
      { scale: 1, quality: 0.86 },
      { scale: 0.82, quality: 0.76 },
      { scale: 0.68, quality: 0.66 },
    ];

    for (const attempt of attempts) {
      const width = Math.max(1, Math.round(image.naturalWidth * baseScale * attempt.scale));
      const height = Math.max(1, Math.round(image.naturalHeight * baseScale * attempt.scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot optimize images.");
      context.drawImage(image, 0, 0, width, height);
      const blob = await canvasBlob(canvas, "image/webp", attempt.quality);
      if (blob.size <= limits.maxOutputBytes) {
        return new File([blob], outputName(file.name), { type: blob.type || "image/webp" });
      }
    }

    throw new Error(`The optimized image is still too large. Use a simpler image under ${formatFileSize(limits.maxOutputBytes)}.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

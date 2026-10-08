export function validateShopFile(input: { filename: string; contentType: string; sizeBytes: number; maximumBytes: number }): void;
export function matchesMediaSignature(contentType: string, header: Uint8Array): boolean;
export function matchesShopFileSignature(contentType: string, header: Uint8Array): boolean;

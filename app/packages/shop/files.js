export function validateShopFile(input) {
    if (!input.filename.trim() || /[\\/\x00-\x1f]/.test(input.filename))
        throw new Error("Enter a valid filename.");
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(input.contentType))
        throw new Error("Enter a valid file type.");
    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > input.maximumBytes) {
        throw new Error(`Shop files must be ${Math.floor(input.maximumBytes / (1024 * 1024))} MB or smaller.`);
    }
}
export function matchesMediaSignature(contentType, header) {
    if (contentType === "image/avif") {
        if (header.length < 12 || header.toString("ascii", 4, 8) !== "ftyp")
            return false;
        if (["avif", "avis"].includes(header.toString("ascii", 8, 12)))
            return true;
        for (let offset = 16; offset + 4 <= header.length; offset += 4)
            if (["avif", "avis"].includes(header.toString("ascii", offset, offset + 4)))
                return true;
        return false;
    }
    if (contentType === "video/mp4")
        return header.length >= 12 && header.toString("ascii", 4, 8) === "ftyp";
    if (contentType === "video/webm")
        return header.length >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (contentType === "image/gif") {
        const signature = header.toString("ascii", 0, 6);
        return signature === "GIF87a" || signature === "GIF89a";
    }
    return true;
}
export function matchesShopFileSignature(contentType, header) {
    if (contentType === "application/pdf")
        return header.subarray(0, 5).toString("ascii") === "%PDF-";
    if (contentType === "application/zip" || contentType === "application/x-zip-compressed") {
        return header.length >= 4 && header[0] === 0x50 && header[1] === 0x4b && [0x03, 0x05, 0x07].includes(header[2]);
    }
    if (contentType === "image/jpeg")
        return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    if (contentType === "image/png")
        return header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (contentType === "image/webp")
        return header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP";
    return matchesMediaSignature(contentType, header);
}

const zlib = require('zlib');

/**
 * Lightweight, zero-dependency PKZIP archive generator for Node.js.
 * Supports store (uncompressed) or raw deflate compression with standard PKZIP formatting.
 */
class SimpleZipGenerator {
  constructor() {
    this.files = [];
  }

  /**
   * Adds a file entry to the zip archive
   * @param {string} filename - Path or filename in zip archive
   * @param {Buffer|string} content - Binary buffer or UTF-8 text string
   */
  addFile(filename, content) {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    this.files.push({
      filename: filename.replace(/\\/g, '/'),
      data: buffer
    });
  }

  /**
   * Calculates 32-bit CRC checksum
   */
  static calculateCrc32(buffer) {
    if (typeof zlib.crc32 === 'function') {
      return zlib.crc32(buffer);
    }
    let crc = -1;
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      crc = (crc >>> 8) ^ SimpleZipGenerator.crcTable[(crc ^ byte) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  /**
   * Generates and returns binary ZIP archive Buffer
   * @returns {Buffer}
   */
  generate() {
    const localHeaders = [];
    const centralDirs = [];
    let currentOffset = 0;

    for (const file of this.files) {
      const filenameBuf = Buffer.from(file.filename, 'utf-8');
      const uncompressedSize = file.data.length;
      const crc32Val = SimpleZipGenerator.calculateCrc32(file.data);

      let compressedData = file.data;
      let compressionMethod = 0; // Store

      try {
        const deflated = zlib.deflateRawSync(file.data);
        if (deflated.length < uncompressedSize) {
          compressedData = deflated;
          compressionMethod = 8; // Deflate
        }
      } catch (e) {
        compressedData = file.data;
        compressionMethod = 0;
      }

      const compressedSize = compressedData.length;

      // Local Header (30 bytes + filename length)
      const localHeader = Buffer.alloc(30 + filenameBuf.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
      localHeader.writeUInt16LE(20, 4);         // Version needed (2.0)
      localHeader.writeUInt16LE(0x0800, 6);     // General flag (UTF-8 encoding)
      localHeader.writeUInt16LE(compressionMethod, 8); // Compression method
      localHeader.writeUInt16LE(0, 10);         // Mod time (00:00:00)
      localHeader.writeUInt16LE(0x54a1, 12);     // Mod date (2026-05-01)
      localHeader.writeUInt32LE(crc32Val, 14);  // CRC-32
      localHeader.writeUInt32LE(compressedSize, 18); // Compressed size
      localHeader.writeUInt32LE(uncompressedSize, 22); // Uncompressed size
      localHeader.writeUInt16LE(filenameBuf.length, 26); // Filename length
      localHeader.writeUInt16LE(0, 28);         // Extra field length
      filenameBuf.copy(localHeader, 30);

      const localRecord = Buffer.concat([localHeader, compressedData]);
      localHeaders.push(localRecord);

      // Central Directory Header (46 bytes + filename length)
      const cdHeader = Buffer.alloc(46 + filenameBuf.length);
      cdHeader.writeUInt32LE(0x02014b50, 0);   // Central directory signature
      cdHeader.writeUInt16LE(20, 4);           // Version made by
      cdHeader.writeUInt16LE(20, 6);           // Version needed
      cdHeader.writeUInt16LE(0x0800, 8);       // General flag (UTF-8)
      cdHeader.writeUInt16LE(compressionMethod, 10); // Compression method
      cdHeader.writeUInt16LE(0, 12);           // Mod time
      cdHeader.writeUInt16LE(0x54a1, 14);       // Mod date
      cdHeader.writeUInt32LE(crc32Val, 16);    // CRC-32
      cdHeader.writeUInt32LE(compressedSize, 20); // Compressed size
      cdHeader.writeUInt32LE(uncompressedSize, 24); // Uncompressed size
      cdHeader.writeUInt16LE(filenameBuf.length, 28); // Filename length
      cdHeader.writeUInt16LE(0, 30);           // Extra field length
      cdHeader.writeUInt16LE(0, 32);           // File comment length
      cdHeader.writeUInt16LE(0, 34);           // Disk number start
      cdHeader.writeUInt16LE(0, 36);           // Internal file attributes
      cdHeader.writeUInt32LE(0, 38);           // External file attributes
      cdHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header
      filenameBuf.copy(cdHeader, 46);

      centralDirs.push(cdHeader);

      currentOffset += localRecord.length;
    }

    const centralDirBuffer = Buffer.concat(centralDirs);
    const localHeadersBuffer = Buffer.concat(localHeaders);

    // End of Central Directory (EOCD) Header (22 bytes)
    const eocdHeader = Buffer.alloc(22);
    eocdHeader.writeUInt32LE(0x06054b50, 0);  // EOCD signature
    eocdHeader.writeUInt16LE(0, 4);          // Disk number
    eocdHeader.writeUInt16LE(0, 6);          // Start disk
    eocdHeader.writeUInt16LE(this.files.length, 8); // Entries on disk
    eocdHeader.writeUInt16LE(this.files.length, 10); // Total entries
    eocdHeader.writeUInt32LE(centralDirBuffer.length, 12); // Central directory size
    eocdHeader.writeUInt32LE(localHeadersBuffer.length, 16); // Central directory offset
    eocdHeader.writeUInt16LE(0, 20);         // Comment length

    return Buffer.concat([localHeadersBuffer, centralDirBuffer, eocdHeader]);
  }
}

// Precompute CRC32 lookup table
SimpleZipGenerator.crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();

module.exports = SimpleZipGenerator;

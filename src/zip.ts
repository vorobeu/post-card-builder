type ZipEntry = {
  name: string;
  data: Uint8Array;
  crc: number;
  localHeaderOffset: number;
};

const encoder = new TextEncoder();
const CRC_TABLE = makeCrcTable();

export async function makeZip(files: Array<{ name: string; blob: Blob }>) {
  const entries: ZipEntry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(data);
    const localHeader = createLocalHeader(nameBytes, data, crc);

    entries.push({ name: file.name, data, crc, localHeaderOffset: offset });
    chunks.push(localHeader, data);
    offset += localHeader.length + data.length;
  }

  const centralDirectoryOffset = offset;

  for (const entry of entries) {
    const centralHeader = createCentralHeader(entry);
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  chunks.push(createEndRecord(entries.length, offset - centralDirectoryOffset, centralDirectoryOffset));

  return new Blob(chunks.map(toBlobPart), { type: 'application/zip' });
}

function toBlobPart(bytes: Uint8Array): BlobPart {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function createLocalHeader(nameBytes: Uint8Array, data: Uint8Array, crc: number) {
  const buffer = new ArrayBuffer(30 + nameBytes.length);
  const view = new DataView(buffer);
  writeHeaderBase(view, 0x04034b50, crc, data.length);
  view.setUint16(26, nameBytes.length, true);
  new Uint8Array(buffer, 30).set(nameBytes);
  return new Uint8Array(buffer);
}

function createCentralHeader(entry: ZipEntry) {
  const nameBytes = encoder.encode(entry.name);
  const buffer = new ArrayBuffer(46 + nameBytes.length);
  const view = new DataView(buffer);
  writeHeaderBase(view, 0x02014b50, entry.crc, entry.data.length);
  view.setUint16(4, 20, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint32(42, entry.localHeaderOffset, true);
  new Uint8Array(buffer, 46).set(nameBytes);
  return new Uint8Array(buffer);
}

function writeHeaderBase(view: DataView, signature: number, crc: number, size: number) {
  view.setUint32(0, signature, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
}

function createEndRecord(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const buffer = new ArrayBuffer(22);
  const view = new DataView(buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  return new Uint8Array(buffer);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

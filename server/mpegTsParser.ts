export async function streamToString(stream: any): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export function parseMpegTsCodecs(buffer: Buffer): string[] {
  const packetSize = 188;
  let pmtPid = -1;
  const codecs: string[] = [];

  for (let i = 0; i < buffer.length - packetSize; i++) {
    if (buffer[i] === 0x47 && buffer[i + packetSize] === 0x47) {
      const pid = ((buffer[i + 1] & 0x1f) << 8) | buffer[i + 2];
      
      // Parse PAT (PID 0)
      if (pid === 0) {
        const hasAdaptation = (buffer[i + 3] & 0x20) !== 0;
        let payloadOffset = 4;
        if (hasAdaptation) {
          payloadOffset += 1 + buffer[i + 4];
        }
        const pusi = (buffer[i + 1] & 0x40) !== 0;
        if (pusi) {
          payloadOffset += 1 + buffer[i + payloadOffset];
        }
        if (buffer[i + payloadOffset] === 0x00) {
          pmtPid = ((buffer[i + payloadOffset + 10] & 0x1f) << 8) | buffer[i + payloadOffset + 11];
        }
      }

      // Parse PMT (PID = pmtPid)
      if (pmtPid !== -1 && pid === pmtPid) {
        const hasAdaptation = (buffer[i + 3] & 0x20) !== 0;
        let payloadOffset = 4;
        if (hasAdaptation) {
          payloadOffset += 1 + buffer[i + 4];
        }
        const pusi = (buffer[i + 1] & 0x40) !== 0;
        if (pusi) {
          payloadOffset += 1 + buffer[i + payloadOffset];
        }
        if (buffer[i + payloadOffset] === 0x02) {
          const sectionLength = ((buffer[i + payloadOffset + 1] & 0x0f) << 8) | buffer[i + payloadOffset + 2];
          const programInfoLength = ((buffer[i + payloadOffset + 10] & 0x0f) << 8) | buffer[i + payloadOffset + 11];
          let streamOffset = payloadOffset + 12 + programInfoLength;
          const endOffset = payloadOffset + 3 + sectionLength - 4;

          while (streamOffset < endOffset) {
            const streamType = buffer[i + streamOffset];
            const elementaryPid = ((buffer[i + streamOffset + 1] & 0x1f) << 8) | buffer[i + streamOffset + 2];
            const esInfoLength = ((buffer[i + streamOffset + 3] & 0x0f) << 8) | buffer[i + streamOffset + 4];
            
            let codecName = `Unknown (0x${streamType.toString(16)})`;
            if (streamType === 0x1b) codecName = "H.264 Video (0x1b)";
            else if (streamType === 0x24) codecName = "H.265/HEVC Video (0x24)";
            else if (streamType === 0x02) codecName = "MPEG-2 Audio (0x02)";
            else if (streamType === 0x03 || streamType === 0x04) codecName = "MP3 Audio (0x03/0x04)";
            else if (streamType === 0x0f) codecName = "AAC Audio (0x0f)";
            else if (streamType === 0x11) codecName = "LATM AAC Audio (0x11)";
            else if (streamType === 0x80) codecName = "G.711 PCMA/LPCM (0x80)";
            else if (streamType === 0x81 || streamType === 0x85) codecName = "AC-3 Audio (0x81/0x85)";
            else if (streamType === 0x82) codecName = "SCTE-35 (0x82)";
            else if (streamType === 0x83) codecName = "LPCM/PCMU Audio (0x83)";
            else if (streamType === 0x86 || streamType === 0x87) codecName = "E-AC-3 Audio (0x86/0x87)";
            else if (streamType === 0x8a) codecName = "DTS Audio (0x8a)";
            else if (streamType === 0x06) codecName = "AC-3/Subtitle/Private (0x06)";
            
            codecs.push(`PID ${elementaryPid}: ${codecName}`);
            streamOffset += 5 + esInfoLength;
          }
          break;
        }
      }
    }
  }
  return codecs;
}

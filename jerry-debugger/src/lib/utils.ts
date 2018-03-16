// Copyright JS Foundation and other contributors, http://js.foundation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export interface ByteConfig {
  cpointerSize: number;
  littleEndian: boolean;
}

/**
 * Calculates expected byte length given a format string
 */
export function getFormatSize(config: ByteConfig, format: string) {
  let length = 0;
  for (let i = 0; i < format.length; i++) {
    switch (format[i]) {
      case 'B':
        length++;
        break;

      case 'C':
        length += config.cpointerSize;
        break;

      case 'I':
        length += 4;
        break;

      default:
        throw new Error('unsupported message format');
    }
  }
  return length;
}

export function decodeMessage(config: ByteConfig, format: string, message: Uint8Array, offset = 0) {
  // Format: B=byte I=int32 C=cpointer
  // Returns an array of decoded numbers

  const result = [];
  let value;

  if (offset + getFormatSize(config, format) > message.byteLength) {
    throw new Error('received message too short');
  }

  for (let i = 0; i < format.length; i++) {
    if (format[i] === 'B') {
      result.push(message[offset]);
      offset++;
      continue;
    }

    if (format[i] === 'C' && config.cpointerSize === 2) {
      if (config.littleEndian) {
        value = message[offset] | (message[offset + 1] << 8);
      } else {
        value = (message[offset] << 8) | message[offset + 1];
      }

      result.push(value);
      offset += 2;
      continue;
    }

    if (format[i] !== 'I' && (format[i] !== 'C' || config.cpointerSize !== 4)) {
      throw new Error('unexpected decode request');
    }

    if (config.littleEndian) {
      value = (message[offset] | (message[offset + 1] << 8)
               | (message[offset + 2] << 16) | (message[offset + 3] << 24));
    } else {
      value = ((message[offset] << 24) | (message[offset + 1] << 16)
               | (message[offset + 2] << 8) | message[offset + 3]);
    }

    result.push(value);
    offset += 4;
  }

  return result;
}

export function cesu8ToString(array: Uint8Array | undefined) {
  if (!array) {
    return '';
  }

  const length = array.byteLength;

  let i = 0;
  let result = '';

  while (i < length) {
    let chr = array[i++];

    if (chr >= 0x7f) {
      if (chr & 0x20) {
        // Three byte long character
        chr = ((chr & 0xf) << 12) | ((array[i] & 0x3f) << 6) | (array[i + 1] & 0x3f);
        i += 2;
      } else {
        // Two byte long character
        chr = ((chr & 0x1f) << 6) | (array[i] & 0x3f);
        ++i;
      }
    }

    result += String.fromCharCode(chr);
  }

  return result;
}

// Concat the two arrays. The first byte (opcode) of nextArray is ignored.
export function assembleUint8Arrays(baseArray: Uint8Array | undefined, nextArray: Uint8Array) {
  if (!baseArray) {
    // Cut the first byte (opcode)
    return nextArray.slice(1);
  }

  if (nextArray.byteLength <= 1) {
    // Nothing to append
    return baseArray;
  }

  const baseLength = baseArray.byteLength;
  const nextLength = nextArray.byteLength - 1;

  const result = new Uint8Array(baseLength + nextLength);
  result.set(nextArray, baseLength - 1);

  // This set operation overwrites the opcode
  result.set(baseArray);

  return result;
}

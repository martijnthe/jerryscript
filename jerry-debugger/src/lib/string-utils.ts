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
export function concatUint8Arrays(baseArray: Uint8Array | undefined, nextArray: Uint8Array) {
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

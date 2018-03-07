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

import { getFormatSize, decodeMessage } from '../utils';

const defConfig = {
  cpointerSize: 2,
  littleEndian: true,
};
const altConfig = {
  cpointerSize: 4,
  littleEndian: true,
};

describe('getFormatSize', () => {
  it('returns 0 for an empty string', () => {
    expect(getFormatSize(defConfig, '')).toEqual(0);
  });

  it('throws on unexpected format character', () => {
    expect(() => {
      getFormatSize(defConfig, 'Q');
    }).toThrow();
  });

  it('returns 1 for B', () => {
    expect(getFormatSize(defConfig, 'B')).toEqual(1);
  });

  it('returns 2 for C with default configuration', () => {
    expect(getFormatSize(defConfig, 'C')).toEqual(2);
  });

  it('returns 4 for C with alternate configuration', () => {
    expect(getFormatSize(altConfig, 'C')).toEqual(4);
  });

  it('returns 4 for I', () => {
    expect(getFormatSize(defConfig, 'I')).toEqual(4);
  });

  it('returns sum for longer format', () => {
    expect(getFormatSize(defConfig, 'BCIIIBBCC')).toEqual(21);
  });

  it('returns sum for longer format', () => {
    expect(getFormatSize(altConfig, 'BCIIIBBCC')).toEqual(27);
  });
});

describe('decodeMessage', () => {
  it('throws if message too short', () => {
    const array = Uint8Array.from([0, 1, 2]);
    expect(() => {
      decodeMessage(defConfig, 'I', array);
    }).toThrow();
  });

  it('throws on unexpected format character', () => {
    const array = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(() => {
      decodeMessage(defConfig, 'Q', array);
    }).toThrow();
  });

  it('returns a byte with B character', () => {
    const array = Uint8Array.from([42]);
    expect(decodeMessage(defConfig, 'B', array)).toEqual([42]);
  });

  it('returns two bytes for C with default config', () => {
    const array = Uint8Array.from([1, 2, 3]);  // 3 ignored
    expect(decodeMessage(defConfig, 'C', array)).toEqual([1 + (2 << 8)]);
  });

  it('returns two bytes for C with big endian', () => {
    const array = Uint8Array.from([1, 2, 3]);  // 3 ignored
    expect(decodeMessage({
      cpointerSize: 2,
      littleEndian: false,
    }, 'C', array)).toEqual([(1 << 8) + 2]);
  });

  it('returns four bytes for C with default config', () => {
    const array = Uint8Array.from([1, 2, 3, 4, 5]);  // 5 ignored
    expect(decodeMessage(altConfig, 'C', array)).toEqual(
      [1 + (2 << 8) + (3 << 16) + (4 << 24)],
    );
  });

  it('returns four bytes for C with big endian', () => {
    const array = Uint8Array.from([1, 2, 3, 4, 5]);  // 5 ignored
    expect(decodeMessage({
      cpointerSize: 4,
      littleEndian: false,
    }, 'C', array)).toEqual(
      [(1 << 24) + (2 << 16) + (3 << 8) + 4],
    );
  });

  it('handles multiple format characters', () => {
    const array = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);  // 8 ignored
    expect(decodeMessage(defConfig, 'IBC', array)).toEqual([
      1 + (2 << 8) + (3 << 16) + (4 << 24),
      5,
      6 + (7 << 8),
    ]);
  });

  it('throws on unexpected pointer size', () => {
    const array = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(() => {
      decodeMessage({
        cpointerSize: 6,
        littleEndian: true,
      }, 'C', array);
    }).toThrow();
  });
});

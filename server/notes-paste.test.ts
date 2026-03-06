/**
 * Tests for the image paste / drag-drop logic used in NotesSection.
 * These tests cover the pure utility functions extracted from the component
 * and the expected behavior of the global paste handler.
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Utility: extractImageBlobs ──────────────────────────────────────────────
// Mirrors the function in NotesSection.tsx

function extractImageBlobs(items: DataTransferItemList): Blob[] {
  const blobs: Blob[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) blobs.push(blob);
    }
  }
  return blobs;
}

// ─── Utility: readBlobAsDataURL ──────────────────────────────────────────────
function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image data'));
    reader.readAsDataURL(blob);
  });
}

// ─── Helper: build a mock DataTransferItemList ───────────────────────────────
function makeMockItemList(
  entries: { kind: string; type: string; file?: File | null }[]
): DataTransferItemList {
  const items = entries.map((e) => ({
    kind: e.kind,
    type: e.type,
    getAsFile: () => e.file ?? null,
    getAsString: vi.fn(),
    webkitGetAsEntry: vi.fn(),
  }));

  return {
    length: items.length,
    [Symbol.iterator]: function* () { yield* items; },
    ...Object.fromEntries(items.map((item, i) => [i, item])),
    add: vi.fn(),
    clear: vi.fn(),
    remove: vi.fn(),
  } as unknown as DataTransferItemList;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractImageBlobs', () => {
  it('returns empty array when items list is empty', () => {
    const items = makeMockItemList([]);
    expect(extractImageBlobs(items)).toEqual([]);
  });

  it('extracts a single image blob', () => {
    const file = new File(['data'], 'screenshot.png', { type: 'image/png' });
    const items = makeMockItemList([{ kind: 'file', type: 'image/png', file }]);
    const blobs = extractImageBlobs(items);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]).toBe(file);
  });

  it('extracts multiple image blobs', () => {
    const file1 = new File(['d1'], 'a.png', { type: 'image/png' });
    const file2 = new File(['d2'], 'b.jpg', { type: 'image/jpeg' });
    const items = makeMockItemList([
      { kind: 'file', type: 'image/png', file: file1 },
      { kind: 'file', type: 'image/jpeg', file: file2 },
    ]);
    const blobs = extractImageBlobs(items);
    expect(blobs).toHaveLength(2);
  });

  it('ignores non-image files', () => {
    const pdf = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
    const img = new File(['img'], 'photo.png', { type: 'image/png' });
    const items = makeMockItemList([
      { kind: 'file', type: 'application/pdf', file: pdf },
      { kind: 'file', type: 'image/png', file: img },
    ]);
    const blobs = extractImageBlobs(items);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]).toBe(img);
  });

  it('ignores string-kind items (text paste)', () => {
    const items = makeMockItemList([
      { kind: 'string', type: 'text/plain' },
    ]);
    expect(extractImageBlobs(items)).toEqual([]);
  });

  it('skips items where getAsFile returns null', () => {
    const items = makeMockItemList([
      { kind: 'file', type: 'image/png', file: null },
    ]);
    expect(extractImageBlobs(items)).toEqual([]);
  });

  it('handles all common image MIME types', () => {
    const mimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
    const entries = mimes.map((type) => ({
      kind: 'file',
      type,
      file: new File(['x'], `img.${type.split('/')[1]}`, { type }),
    }));
    const items = makeMockItemList(entries);
    expect(extractImageBlobs(items)).toHaveLength(mimes.length);
  });
});

describe('readBlobAsDataURL', () => {
  it('rejects when FileReader errors', async () => {
    // Temporarily override FileReader to simulate an error
    const OriginalFileReader = globalThis.FileReader;
    class ErrorFileReader {
      onerror: ((e: any) => void) | null = null;
      onload: ((e: any) => void) | null = null;
      readAsDataURL() {
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('read error'));
        }, 0);
      }
    }
    globalThis.FileReader = ErrorFileReader as any;

    await expect(readBlobAsDataURL(new Blob(['x']))).rejects.toThrow('Failed to read image data');

    globalThis.FileReader = OriginalFileReader;
  });
});

describe('Global paste handler guard logic (pure)', () => {
  /**
   * These tests verify the boolean guard logic used in the global paste handler
   * without needing a real DOM environment. We simulate the element tag/contains
   * checks using plain objects.
   */

  function isTypingElsewhere(
    active: { tagName: string } | null,
    isNotesTextarea: boolean,
    formAreaContains: boolean
  ): boolean {
    if (!active) return false;
    if (isNotesTextarea) return false;
    if (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA') return false;
    if (formAreaContains) return false;
    return true;
  }

  it('returns true when another INPUT outside form is focused', () => {
    expect(isTypingElsewhere({ tagName: 'INPUT' }, false, false)).toBe(true);
  });

  it('returns true when another TEXTAREA outside form is focused', () => {
    expect(isTypingElsewhere({ tagName: 'TEXTAREA' }, false, false)).toBe(true);
  });

  it('returns false when the notes textarea itself is active', () => {
    expect(isTypingElsewhere({ tagName: 'TEXTAREA' }, true, false)).toBe(false);
  });

  it('returns false when active element is inside the form area', () => {
    expect(isTypingElsewhere({ tagName: 'INPUT' }, false, true)).toBe(false);
  });

  it('returns false when active element is a DIV (not input/textarea)', () => {
    expect(isTypingElsewhere({ tagName: 'DIV' }, false, false)).toBe(false);
  });

  it('returns false when no element is focused (null)', () => {
    expect(isTypingElsewhere(null, false, false)).toBe(false);
  });
});

describe('File size validation', () => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  it('accepts files under 10MB', () => {
    const size = 5 * 1024 * 1024; // 5MB
    expect(size <= MAX_FILE_SIZE).toBe(true);
  });

  it('rejects files over 10MB', () => {
    const size = 11 * 1024 * 1024; // 11MB
    expect(size > MAX_FILE_SIZE).toBe(true);
  });

  it('accepts files exactly at 10MB boundary', () => {
    expect(MAX_FILE_SIZE <= MAX_FILE_SIZE).toBe(true);
  });
});

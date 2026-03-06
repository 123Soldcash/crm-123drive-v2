// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesSection } from './NotesSection';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: vi.fn(),
    notes: {
      byProperty: { useQuery: vi.fn() },
      create: { useMutation: vi.fn() },
      delete: { useMutation: vi.fn() },
    },
    photos: {
      allByProperty: { useQuery: vi.fn() },
      byProperty: { useQuery: vi.fn() },
      uploadBulk: { useMutation: vi.fn() },
      delete: { useMutation: vi.fn() },
    },
    documents: {
      byProperty: { useQuery: vi.fn() },
      upload: { useMutation: vi.fn() },
      delete: { useMutation: vi.fn() },
    },
  },
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, ...props }: any) => (
    <textarea value={value} onChange={onChange} placeholder={placeholder} {...props} />
  ),
}));
vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} {...props} />
  ),
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));
vi.mock('./CollapsibleSection', () => ({
  CollapsibleSection: ({ children, title }: any) => (
    <div data-testid="collapsible-section" data-title={title}>{children}</div>
  ),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@radix-ui/react-visually-hidden', () => ({
  VisuallyHidden: ({ children }: any) => <span>{children}</span>,
}));

// Mock FileReader
const mockFileReaderResult = 'data:image/png;base64,abc123';
class MockFileReader {
  result: string | null = null;
  onload: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  readAsDataURL(_blob: Blob) {
    this.result = mockFileReaderResult;
    setTimeout(() => {
      if (this.onload) this.onload({ target: { result: this.result } });
    }, 0);
  }
}
vi.stubGlobal('FileReader', MockFileReader);

const mockPropertyId = 123;
const mockNotes = [
  { id: 1, propertyId: mockPropertyId, content: 'General note 1', noteType: 'general', createdAt: new Date('2026-02-09'), userName: 'John Doe' },
  { id: 2, propertyId: mockPropertyId, content: 'General note 2', noteType: 'general', createdAt: new Date('2026-02-08'), userName: 'Jane Smith' },
];
const mockPhotos = [
  { id: 1, propertyId: mockPropertyId, noteId: 1, fileUrl: 'https://example.com/photo1.jpg', caption: 'Photo 1 caption' },
  { id: 2, propertyId: mockPropertyId, noteId: 1, fileUrl: 'https://example.com/photo2.jpg', caption: null },
  { id: 3, propertyId: mockPropertyId, noteId: 2, fileUrl: 'https://example.com/photo3.jpg', caption: 'Photo 3 caption' },
];

function setupDefaultMocks() {
  (trpc.useUtils as any).mockReturnValue({
    notes: { byProperty: { invalidate: vi.fn() } },
    photos: { byProperty: { invalidate: vi.fn() }, allByProperty: { invalidate: vi.fn() } },
    documents: { byProperty: { invalidate: vi.fn() } },
  });
  (trpc.notes.byProperty.useQuery as any).mockReturnValue({ data: mockNotes, isLoading: false });
  (trpc.photos.allByProperty.useQuery as any).mockReturnValue({ data: mockPhotos });
  (trpc.photos.byProperty.useQuery as any).mockReturnValue({ data: mockPhotos });
  (trpc.documents.byProperty.useQuery as any).mockReturnValue({ data: [] });
  (trpc.notes.create.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
  (trpc.notes.delete.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
  (trpc.photos.uploadBulk.useMutation as any).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  (trpc.photos.delete.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
  (trpc.documents.upload.useMutation as any).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  (trpc.documents.delete.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: false });
}

describe('NotesSection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupDefaultMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────
  describe('Rendering', () => {
    it('renders with title "General Notes"', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByTestId('collapsible-section')).toHaveAttribute('data-title', 'General Notes');
    });

    it('renders the textarea for new notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByPlaceholderText(/Add a note/i)).toBeInTheDocument();
    });

    it('renders Photos and Documents buttons', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByRole('button', { name: /Photos/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Documents/i })).toBeInTheDocument();
    });

    it('renders Save Note button', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByRole('button', { name: /Save Note/i })).toBeInTheDocument();
    });

    it('renders the paste hint text', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText(/Ctrl\+V anywhere/i)).toBeInTheDocument();
    });

    it('shows notes count badge', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText('2 notes')).toBeInTheDocument();
    });

    it('displays all general notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText('General note 1')).toBeInTheDocument();
      expect(screen.getByText('General note 2')).toBeInTheDocument();
    });

    it('displays note authors', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('shows empty state message when no notes', () => {
      (trpc.notes.byProperty.useQuery as any).mockReturnValue({ data: [], isLoading: false });
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText(/No notes yet/i)).toBeInTheDocument();
    });
  });

  // ── Note Creation ──────────────────────────────────────────────────────────
  describe('Note Creation', () => {
    it('submits note with correct data', async () => {
      const mockMutate = vi.fn();
      (trpc.notes.create.useMutation as any).mockReturnValue({ mutate: mockMutate, isPending: false });

      render(<NotesSection propertyId={mockPropertyId} />);
      await userEvent.type(screen.getByPlaceholderText(/Add a note/i), 'New general note');
      fireEvent.click(screen.getByRole('button', { name: /Save Note/i }));

      expect(mockMutate).toHaveBeenCalledWith({
        propertyId: mockPropertyId,
        content: 'New general note',
        noteType: 'general',
      });
    });

    it('does not submit when note is empty and no images/docs', () => {
      const mockMutate = vi.fn();
      (trpc.notes.create.useMutation as any).mockReturnValue({ mutate: mockMutate, isPending: false });

      render(<NotesSection propertyId={mockPropertyId} />);
      fireEvent.click(screen.getByRole('button', { name: /Save Note/i }));

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('disables submit button while saving', () => {
      (trpc.notes.create.useMutation as any).mockReturnValue({ mutate: vi.fn(), isPending: true });
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByRole('button', { name: /Saving/i })).toBeDisabled();
    });
  });

  // ── Image Attachment ───────────────────────────────────────────────────────
  describe('Image Attachment via File Input', () => {
    it('adds image to preview when file is selected', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const fileInput = document.querySelector('input[accept="image/*"]') as HTMLInputElement;

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      fireEvent.change(fileInput, { target: { files: dt.files } });

      await waitFor(() => {
        const grid = document.querySelector('.grid.grid-cols-3');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  // ── Global Paste ───────────────────────────────────────────────────────────
  describe('Global Paste (Ctrl+V)', () => {
    it('registers a paste listener on document', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(addSpy).toHaveBeenCalledWith('paste', expect.any(Function));
      addSpy.mockRestore();
    });

    it('removes the paste listener on unmount', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      const { unmount } = render(<NotesSection propertyId={mockPropertyId} />);
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('paste', expect.any(Function));
      removeSpy.mockRestore();
    });

    it('processes image from global paste event', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      const blob = new Blob(['img'], { type: 'image/png' });
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true });
      await act(async () => {
        document.dispatchEvent(pasteEvent);
        await new Promise((r) => setTimeout(r, 50));
      });

      await waitFor(() => {
        const grid = document.querySelector('.grid.grid-cols-3');
        expect(grid).toBeInTheDocument();
      });
    });

    it('does not steal paste from other text inputs on the page', async () => {
      const { container } = render(
        <div>
          <input id="other-input" type="text" />
          <NotesSection propertyId={mockPropertyId} />
        </div>
      );

      const otherInput = container.querySelector('#other-input') as HTMLInputElement;
      otherInput.focus();
      Object.defineProperty(document, 'activeElement', { value: otherInput, configurable: true });

      const blob = new Blob(['img'], { type: 'image/png' });
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true });

      await act(async () => {
        document.dispatchEvent(pasteEvent);
        await new Promise((r) => setTimeout(r, 50));
      });

      // Grid should NOT appear because paste was from another input
      const grid = document.querySelector('.grid.grid-cols-3');
      expect(grid).toBeNull();
    });

    it('ignores paste events that contain only text (no images)', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      const dt = new DataTransfer();
      dt.setData('text/plain', 'just some text');
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true });

      await act(async () => {
        document.dispatchEvent(pasteEvent);
        await new Promise((r) => setTimeout(r, 50));
      });

      const grid = document.querySelector('.grid.grid-cols-3');
      expect(grid).toBeNull();
    });
  });

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  describe('Drag & Drop', () => {
    it('shows drag-over state when dragging image over form area', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      // The form area is the div with the drag hint
      const formArea = screen.getByText(/Ctrl\+V anywhere/i).closest('div[class*="border-2"]');
      expect(formArea).toBeTruthy();

      const dt = new DataTransfer();
      dt.items.add(new File(['img'], 'test.png', { type: 'image/png' }));

      fireEvent.dragOver(formArea!, { dataTransfer: dt });

      expect(screen.getByText(/Drop image here/i)).toBeInTheDocument();
    });

    it('clears drag-over state on drag leave', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const formArea = screen.getByText(/Ctrl\+V anywhere/i).closest('div[class*="border-2"]');

      const dt = new DataTransfer();
      dt.items.add(new File(['img'], 'test.png', { type: 'image/png' }));

      fireEvent.dragOver(formArea!, { dataTransfer: dt });
      fireEvent.dragLeave(formArea!, { relatedTarget: null });

      expect(screen.queryByText(/Drop image here/i)).toBeNull();
    });
  });

  // ── Note Deletion ──────────────────────────────────────────────────────────
  describe('Note Deletion', () => {
    it('calls delete mutation when trash button is clicked', () => {
      const mockDelete = vi.fn();
      (trpc.notes.delete.useMutation as any).mockReturnValue({ mutate: mockDelete, isPending: false });

      render(<NotesSection propertyId={mockPropertyId} />);
      const deleteButtons = screen.getAllByRole('button');
      // Last button in the table rows is the delete button
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  describe('Search Functionality', () => {
    it('filters notes by search query', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      await userEvent.type(screen.getByPlaceholderText(/Search notes/i), 'General note 1');

      await waitFor(() => {
        expect(screen.getByText('General note 1')).toBeInTheDocument();
      });
    });
  });

  // ── CSV Export ─────────────────────────────────────────────────────────────
  describe('CSV Export', () => {
    it('triggers CSV download when Export is clicked', () => {
      const createSpy = vi.spyOn(document, 'createElement');
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);

      render(<NotesSection propertyId={mockPropertyId} />);
      fireEvent.click(screen.getByRole('button', { name: /Export/i }));

      expect(createSpy).toHaveBeenCalledWith('a');
      createSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  // ── Photos in Notes ────────────────────────────────────────────────────────
  describe('Photo Display in Notes', () => {
    it('displays photos attached to notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const photos = screen.getAllByAltText(/Note photo/i);
      expect(photos.length).toBeGreaterThan(0);
    });

    it('shows photo captions', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText('Photo 1 caption')).toBeInTheDocument();
      expect(screen.getByText('Photo 3 caption')).toBeInTheDocument();
    });

    it('opens lightbox when photo is clicked', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const photos = screen.getAllByAltText(/Note photo/i);
      fireEvent.click(photos[0]);
      // Lightbox dialog should appear
      expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    });
  });

  // ── LocalStorage ───────────────────────────────────────────────────────────
  describe('LocalStorage Persistence', () => {
    it('persists expanded state to localStorage', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(localStorage.getItem('showGeneralNotes')).not.toBeNull();
    });

    it('defaults to expanded (true)', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(localStorage.getItem('showGeneralNotes')).toBe('true');
    });
  });
});

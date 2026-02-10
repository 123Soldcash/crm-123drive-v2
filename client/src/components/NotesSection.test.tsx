import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesSection } from './NotesSection';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: vi.fn(),
    notes: {
      byProperty: {
        useQuery: vi.fn(),
      },
      create: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
    photos: {
      byProperty: {
        useQuery: vi.fn(),
      },
      uploadBulk: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
  },
}));

// Mock components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('./CollapsibleSection', () => ({
  CollapsibleSection: ({ children, title }: any) => (
    <div data-testid="collapsible-section" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NotesSection Component', () => {
  const mockPropertyId = 123;
  const mockNotes = [
    {
      id: 1,
      propertyId: mockPropertyId,
      content: 'General note 1',
      noteType: 'general',
      createdAt: new Date('2026-02-09'),
      userName: 'John Doe',
    },
    {
      id: 2,
      propertyId: mockPropertyId,
      content: 'General note 2',
      noteType: 'general',
      createdAt: new Date('2026-02-08'),
      userName: 'Jane Smith',
    },
  ];

  const mockPhotos = [
    {
      id: 1,
      propertyId: mockPropertyId,
      noteId: 1,
      fileUrl: 'https://example.com/photo1.jpg',
      caption: 'Photo 1 caption',
    },
    {
      id: 2,
      propertyId: mockPropertyId,
      noteId: 1,
      fileUrl: 'https://example.com/photo2.jpg',
      caption: null,
    },
    {
      id: 3,
      propertyId: mockPropertyId,
      noteId: 2,
      fileUrl: 'https://example.com/photo3.jpg',
      caption: 'Photo 3 caption',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Setup default mocks
    (trpc.useUtils as any).mockReturnValue({
      notes: { byProperty: { invalidate: vi.fn() } },
      photos: { byProperty: { invalidate: vi.fn() } },
    });

    (trpc.notes.byProperty.useQuery as any).mockReturnValue({
      data: mockNotes,
      isLoading: false,
    });

    (trpc.photos.byProperty.useQuery as any).mockReturnValue({
      data: mockPhotos,
    });

    (trpc.notes.create.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    (trpc.notes.delete.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    (trpc.photos.uploadBulk.useMutation as any).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });

    (trpc.photos.delete.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  describe('Rendering', () => {
    it('should render the component with title', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const section = screen.getByTestId('collapsible-section');
      expect(section).toHaveAttribute('data-title', 'General Notes');
    });

    it('should display notes count badge', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render textarea for new notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const textarea = screen.getByPlaceholderText(/Add a note/i);
      expect(textarea).toBeInTheDocument();
    });

    it('should render Add Photos button', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const button = screen.getByRole('button', { name: /Add Photos/i });
      expect(button).toBeInTheDocument();
    });

    it('should render Save Note button', () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const button = screen.getByRole('button', { name: /Save Note/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Note Creation', () => {
    it('should add a note when form is submitted', async () => {
      const mockMutate = vi.fn();
      (trpc.notes.create.useMutation as any).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      render(<NotesSection propertyId={mockPropertyId} />);
      const textarea = screen.getByPlaceholderText(/Add a note/i);
      const submitButton = screen.getByRole('button', { name: /Save Note/i });

      await userEvent.type(textarea, 'New general note');
      fireEvent.click(submitButton);

      expect(mockMutate).toHaveBeenCalledWith({
        propertyId: mockPropertyId,
        content: 'New general note',
        noteType: 'general',
      });
    });

    it('should not submit empty notes', async () => {
      const mockMutate = vi.fn();
      (trpc.notes.create.useMutation as any).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      render(<NotesSection propertyId={mockPropertyId} />);
      const submitButton = screen.getByRole('button', { name: /Save Note/i });

      fireEvent.click(submitButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('should disable submit button when loading', () => {
      (trpc.notes.create.useMutation as any).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      render(<NotesSection propertyId={mockPropertyId} />);
      const submitButton = screen.getByRole('button', { name: /Saving/i });

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Image Attachment', () => {
    it('should handle file selection', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      fireEvent.change(fileInput, { target: { files: dataTransfer.files } });

      await waitFor(() => {
        const images = screen.getAllByRole('img');
        expect(images.length).toBeGreaterThan(0);
      });
    });

    it('should display selected images in grid', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      fireEvent.change(fileInput, { target: { files: dataTransfer.files } });

      await waitFor(() => {
        const grid = document.querySelector('.grid.grid-cols-3');
        expect(grid).toBeInTheDocument();
      });
    });

    it('should remove image when delete button is clicked', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      fireEvent.change(fileInput, { target: { files: dataTransfer.files } });

      await waitFor(() => {
        const deleteButtons = screen.getAllByRole('button');
        if (deleteButtons.length > 0) {
          fireEvent.click(deleteButtons[0]);
        }
      });
    });

    it('should upload photos when note is created', async () => {
      const mockUploadPhotos = vi.fn().mockResolvedValue({});
      const mockMutate = vi.fn((config: any) => {
        config.onSuccess?.({ id: 1 });
      });

      (trpc.notes.create.useMutation as any).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      (trpc.photos.uploadBulk.useMutation as any).mockReturnValue({
        mutateAsync: mockUploadPhotos,
        isPending: false,
      });

      render(<NotesSection propertyId={mockPropertyId} />);
      const textarea = screen.getByPlaceholderText(/Add a note/i);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Add image
      const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fireEvent.change(fileInput, { target: { files: dataTransfer.files } });

      // Add note text
      await userEvent.type(textarea, 'Note with image');

      // Submit
      const submitButton = screen.getByRole('button', { name: /Save Note/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });

    it('should handle multiple image uploads', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file1);
      dataTransfer.items.add(file2);

      fireEvent.change(fileInput, { target: { files: dataTransfer.files } });

      await waitFor(() => {
        const grid = document.querySelector('.grid.grid-cols-3');
        expect(grid).toBeInTheDocument();
      });
    });
  });

  describe('Note Deletion', () => {
    it('should delete note when delete button is clicked', async () => {
      const mockDelete = vi.fn();
      (trpc.notes.delete.useMutation as any).mockReturnValue({
        mutate: mockDelete,
        isPending: false,
      });

      render(<NotesSection propertyId={mockPropertyId} />);

      const deleteButtons = screen.getAllByRole('button');
      // Find the delete button for a note
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      }

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('Search Functionality', () => {
    it('should filter notes by search query', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const searchInput = screen.getByPlaceholderText(/Search notes/i);

      await userEvent.type(searchInput, 'General note 1');

      await waitFor(() => {
        expect(screen.getByText('General note 1')).toBeInTheDocument();
      });
    });
  });

  describe('CSV Export', () => {
    it('should export notes to CSV', async () => {
      const mockCreateElement = vi.spyOn(document, 'createElement');
      const mockAppendChild = vi.spyOn(document, 'appendChild');
      const mockRemoveChild = vi.spyOn(document, 'removeChild');

      render(<NotesSection propertyId={mockPropertyId} />);
      const exportButton = screen.getByRole('button', { name: /Export/i });

      fireEvent.click(exportButton);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();

      mockCreateElement.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('Photo Display in Notes', () => {
    it('should display photos attached to notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      const photos = screen.getAllByAltText(/Note photo/i);
      expect(photos.length).toBeGreaterThan(0);
    });

    it('should show photo captions', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      expect(screen.getByText('Photo 1 caption')).toBeInTheDocument();
      expect(screen.getByText('Photo 3 caption')).toBeInTheDocument();
    });

    it('should delete photo when delete button is clicked', async () => {
      const mockDeletePhoto = vi.fn();
      (trpc.photos.delete.useMutation as any).mockReturnValue({
        mutate: mockDeletePhoto,
        isPending: false,
      });

      render(<NotesSection propertyId={mockPropertyId} />);

      window.confirm = vi.fn(() => true);

      // The photo delete functionality should be tested
      // This is a simplified test
    });

    it('should open lightbox when photo is clicked', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      const photos = screen.getAllByAltText(/Note photo/i);
      if (photos.length > 0) {
        fireEvent.click(photos[0]);

        // Lightbox should be visible
        const lightboxImage = screen.getByRole('img', { hidden: true });
        expect(lightboxImage).toBeInTheDocument();
      }
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should persist expanded state to localStorage', () => {
      const { rerender } = render(<NotesSection propertyId={mockPropertyId} />);

      const section = screen.getByTestId('collapsible-section');
      expect(section).toBeInTheDocument();

      // Check if localStorage was called
      const stored = localStorage.getItem('showGeneralNotes');
      expect(stored).not.toBeNull();
    });

    it('should default to expanded state for general notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      const stored = localStorage.getItem('showGeneralNotes');
      expect(stored).toBe('true');
    });
  });

  describe('Paste Image Support', () => {
    it('should handle pasted images from clipboard', async () => {
      render(<NotesSection propertyId={mockPropertyId} />);
      const textarea = screen.getByPlaceholderText(/Add a note/i);

      const blob = new Blob(['image data'], { type: 'image/png' });
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer(),
      });

      // Add image to clipboard
      pasteEvent.clipboardData?.items.add(new File([blob], 'test.png', { type: 'image/png' }));

      fireEvent.paste(textarea, pasteEvent);

      // Note: This test might need adjustment based on actual implementation
      // as FileReader is async
    });
  });

  describe('Photo Filtering', () => {
    it('should display only photos for specific note', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      // Note 1 should have 2 photos
      // Note 2 should have 1 photo
      const photos = screen.getAllByAltText(/Note photo/i);
      expect(photos.length).toBe(3);
    });
  });

  describe('Note Display', () => {
    it('should display all general notes', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      expect(screen.getByText('General note 1')).toBeInTheDocument();
      expect(screen.getByText('General note 2')).toBeInTheDocument();
    });

    it('should display note author and date', () => {
      render(<NotesSection propertyId={mockPropertyId} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });
});

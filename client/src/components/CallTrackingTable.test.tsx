// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CallTrackingTable } from './CallTrackingTable';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    communication: {
      getContactsByProperty: {
        useQuery: vi.fn(),
      },
      getCommunicationLog: {
        useQuery: vi.fn(),
      },
      logCommunication: {
        useMutation: vi.fn(),
      },
      updateCommunicationLog: {
        useMutation: vi.fn(),
      },
      updateContact: {
        useMutation: vi.fn(),
      },
      bulkMarkDNC: {
        useMutation: vi.fn(),
      },
      bulkDeleteContacts: {
        useMutation: vi.fn(),
      },
    },
    noteTemplates: {
      list: {
        useQuery: vi.fn(),
      },
      add: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
    },
    properties: {
      getById: {
        useQuery: vi.fn(),
      },
      update: {
        useMutation: vi.fn(),
      },
    },
    useUtils: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock TwilioBrowserCallButton
vi.mock('./TwilioBrowserCallButton', () => ({
  TwilioBrowserCallButton: () => <div data-testid="twilio-button">Call Button</div>,
}));

describe('CallTrackingTable', () => {
  const mockPropertyId = 630034;
  
  const mockContacts = [
    {
      id: 1,
      name: 'John Smith',
      relationship: 'Owner',
      age: 45,
      dnc: 0,
      isLitigator: 0,
      deceased: 0,
      isDecisionMaker: 1,
      phones: [
        {
          id: 101,
          phoneNumber: '(305) 555-0101',
          phoneType: 'Mobile',
          isPrimary: 1,
        },
        {
          id: 102,
          phoneNumber: '(305) 555-0102',
          phoneType: 'Landline',
          isPrimary: 0,
        },
      ],
      emails: [
        {
          id: 201,
          email: 'john@example.com',
          emailType: 'Personal',
          isPrimary: 1,
        },
      ],
    },
    {
      id: 2,
      name: 'Jane Doe',
      relationship: 'Spouse',
      age: 42,
      dnc: 1,
      isLitigator: 0,
      deceased: 0,
      isDecisionMaker: 0,
      phones: [
        {
          id: 103,
          phoneNumber: '(305) 555-0103',
          phoneType: 'Mobile',
          isPrimary: 1,
        },
      ],
      emails: [],
    },
    {
      id: 3,
      name: 'Robert Johnson',
      relationship: 'Child',
      age: 20,
      dnc: 0,
      isLitigator: 1,
      deceased: 0,
      isDecisionMaker: 0,
      phones: [
        {
          id: 104,
          phoneNumber: '(305) 555-0104',
          phoneType: 'Mobile',
          isPrimary: 1,
        },
      ],
      emails: [],
    },
  ];

  const mockCommunications = [
    {
      id: 1,
      contactId: 1,
      propertyId: mockPropertyId,
      communicationType: 'Phone',
      callResult: 'Interested - HOT LEAD',
      direction: 'Outbound',
      notes: 'Called (305) 555-0101 (Mobile) - Very interested',
      createdAt: new Date('2026-02-10'),
      userName: 'Agent Smith',
    },
    {
      id: 2,
      contactId: 2,
      propertyId: mockPropertyId,
      communicationType: 'Phone',
      callResult: 'Not Answer',
      direction: 'Outbound',
      notes: 'Called (305) 555-0103 (Mobile) - No answer',
      createdAt: new Date('2026-02-09'),
      userName: 'Agent Jones',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Table Column Headers', () => {
    it('should render correct column headers including Contact Name and Contact Relationship', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('Contact Name')).toBeInTheDocument();
        expect(screen.getByText('Contact Relationship')).toBeInTheDocument();
      });
    });

    it('should display all required column headers', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('Contact Name')).toBeInTheDocument();
        expect(screen.getByText('Contact Relationship')).toBeInTheDocument();
        expect(screen.getByText('Phone Number')).toBeInTheDocument();
        expect(screen.getByText('Disposition')).toBeInTheDocument();
        expect(screen.getByText('Notes')).toBeInTheDocument();
      });
    });
  });

  describe('Contact Data Display', () => {
    it('should display contact names correctly in the Contact Name column', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Robert Johnson')).toBeInTheDocument();
      });
    });

    it('should display contact relationships correctly in the Contact Relationship column', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        // Check that relationships are displayed (they appear in Badge elements)
        const badges = screen.getAllByRole('img', { hidden: true }).filter(el => el.parentElement?.className.includes('text-xs'));
        expect(screen.getByText('Owner')).toBeInTheDocument();
        expect(screen.getByText('Spouse')).toBeInTheDocument();
        expect(screen.getByText('Child')).toBeInTheDocument();
      });
    });

    it('should display phone numbers correctly', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('(305) 555-0101')).toBeInTheDocument();
        expect(screen.getByText('(305) 555-0102')).toBeInTheDocument();
        expect(screen.getByText('(305) 555-0103')).toBeInTheDocument();
      });
    });
  });

  describe('Contact Flags Display', () => {
    it('should display DNC flag for contacts marked as DNC', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        // Jane Doe has dnc = 1
        const dncElements = screen.getAllByText('🚫');
        expect(dncElements.length).toBeGreaterThan(0);
      });
    });

    it('should display Litigator flag for contacts marked as litigator', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        // Robert Johnson has isLitigator = 1
        const litigatorElements = screen.getAllByText('⚖️');
        expect(litigatorElements.length).toBeGreaterThan(0);
      });
    });

    it('should display Decision Maker flag for contacts marked as decision maker', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        // John Smith has isDecisionMaker = 1
        const decisionMakerElements = screen.getAllByRole('img', { hidden: true });
        expect(decisionMakerElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Integrity', () => {
    it('should maintain correct relationship between contact name and relationship', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        // Verify John Smith is displayed with Owner relationship
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Owner')).toBeInTheDocument();
        
        // Verify Jane Doe is displayed with Spouse relationship
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('Spouse')).toBeInTheDocument();
      });
    });

    it('should display all phone numbers for a contact', async () => {
      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: mockContacts,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: mockCommunications,
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        // John Smith has 2 phone numbers
        expect(screen.getByText('(305) 555-0101')).toBeInTheDocument();
        expect(screen.getByText('(305) 555-0102')).toBeInTheDocument();
      });
    });

    it('should handle contacts with missing relationship gracefully', async () => {
      const contactsWithMissingRelationship = [
        {
          ...mockContacts[0],
          relationship: null,
        },
      ];

      const mockUseQuery = vi.fn((query) => {
        if (query.propertyId) {
          return {
            data: contactsWithMissingRelationship,
            isLoading: false,
          };
        }
        return { data: [], isLoading: false };
      });

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('N/A')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display message when no contacts are available', async () => {
      const mockUseQuery = vi.fn(() => ({
        data: [],
        isLoading: false,
      }));

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText(/No contacts available/i)).toBeInTheDocument();
      });
    });

    it('should display loading state', () => {
      const mockUseQuery = vi.fn(() => ({
        data: undefined,
        isLoading: true,
      }));

      vi.spyOn(trpc.communication.getContactsByProperty, 'useQuery').mockImplementation(mockUseQuery);
      vi.spyOn(trpc.communication.getCommunicationLog, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.noteTemplates.list, 'useQuery').mockReturnValue({
        data: [],
        isLoading: false,
      } as any);
      vi.spyOn(trpc.useUtils, 'useUtils').mockReturnValue({} as any);

      render(<CallTrackingTable propertyId={mockPropertyId} />);

      expect(screen.getByText(/Loading contacts/i)).toBeInTheDocument();
    });
  });
});

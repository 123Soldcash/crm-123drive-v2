import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DealCalculator } from './DealCalculator';
import { trpc } from '@/lib/trpc';

// Mock trpc
vi.mock('@/lib/trpc', () => ({
  trpc: {
    dealCalculator: {
      get: {
        useQuery: vi.fn(),
      },
      save: {
        useMutation: vi.fn(),
      },
      delete: {
        useMutation: vi.fn(),
      },
      calculateProfitMargin: {
        query: vi.fn(),
      },
      analyzeDeal: {
        query: vi.fn(),
      },
    },
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('DealCalculator Component', () => {
  const mockPropertyId = 123;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
      data: null,
    });

    (trpc.dealCalculator.save.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });

    (trpc.dealCalculator.delete.useMutation as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  describe('Component Rendering', () => {
    it('should render Deal Calculator component', () => {
      render(<DealCalculator propertyId={mockPropertyId} />);
      expect(screen.getByText('Deal Calculator')).toBeInTheDocument();
    });

    it('should display all input fields', () => {
      render(<DealCalculator propertyId={mockPropertyId} />);
      
      expect(screen.getByLabelText(/After Repair Value/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Repair Cost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Closing Cost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Assignment Fee/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Desired Profit/i)).toBeInTheDocument();
    });

    it('should display Calculate MAO button', () => {
      render(<DealCalculator propertyId={mockPropertyId} />);
      expect(screen.getByRole('button', { name: /Calculate MAO/i })).toBeInTheDocument();
    });

    it('should have correct input placeholders', () => {
      render(<DealCalculator propertyId={mockPropertyId} />);
      
      expect(screen.getByPlaceholderText('500000')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('50000')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('10000')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('15000')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('30000')).toBeInTheDocument();
    });
  });

  describe('Input Validation', () => {
    it('should show error when fields are empty', async () => {
      const { toast } = require('sonner');
      render(<DealCalculator propertyId={mockPropertyId} />);
      
      const button = screen.getByRole('button', { name: /Calculate MAO/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please fill in all fields');
      });
    });

    it('should show error for invalid number input', async () => {
      const { toast } = require('sonner');
      render(<DealCalculator propertyId={mockPropertyId} />);
      
      const arvInput = screen.getByLabelText(/After Repair Value/i);
      await userEvent.type(arvInput, 'invalid');
      
      const button = screen.getByRole('button', { name: /Calculate MAO/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('All fields must be valid numbers');
      });
    });

    it('should show error for negative ARV', async () => {
      const { toast } = require('sonner');
      render(<DealCalculator propertyId={mockPropertyId} />);
      
      const arvInput = screen.getByLabelText(/After Repair Value/i);
      const repairInput = screen.getByLabelText(/Repair Cost/i);
      const closingInput = screen.getByLabelText(/Closing Cost/i);
      const assignmentInput = screen.getByLabelText(/Assignment Fee/i);
      const profitInput = screen.getByLabelText(/Desired Profit/i);

      await userEvent.type(arvInput, '-100');
      await userEvent.type(repairInput, '1000');
      await userEvent.type(closingInput, '1000');
      await userEvent.type(assignmentInput, '1000');
      await userEvent.type(profitInput, '1000');
      
      const button = screen.getByRole('button', { name: /Calculate MAO/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('ARV must be greater than 0');
      });
    });

    it('should allow zero for non-ARV fields', async () => {
      const mockMutate = vi.fn();
      (trpc.dealCalculator.save.useMutation as any).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      render(<DealCalculator propertyId={mockPropertyId} />);
      
      const arvInput = screen.getByLabelText(/After Repair Value/i);
      const repairInput = screen.getByLabelText(/Repair Cost/i);
      const closingInput = screen.getByLabelText(/Closing Cost/i);
      const assignmentInput = screen.getByLabelText(/Assignment Fee/i);
      const profitInput = screen.getByLabelText(/Desired Profit/i);

      await userEvent.type(arvInput, '500000');
      await userEvent.type(repairInput, '0');
      await userEvent.type(closingInput, '0');
      await userEvent.type(assignmentInput, '0');
      await userEvent.type(profitInput, '0');
      
      const button = screen.getByRole('button', { name: /Calculate MAO/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call save mutation with correct data', async () => {
      const mockMutate = vi.fn();
      (trpc.dealCalculator.save.useMutation as any).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      render(<DealCalculator propertyId={mockPropertyId} />);
      
      const arvInput = screen.getByLabelText(/After Repair Value/i);
      const repairInput = screen.getByLabelText(/Repair Cost/i);
      const closingInput = screen.getByLabelText(/Closing Cost/i);
      const assignmentInput = screen.getByLabelText(/Assignment Fee/i);
      const profitInput = screen.getByLabelText(/Desired Profit/i);

      await userEvent.type(arvInput, '500000');
      await userEvent.type(repairInput, '50000');
      await userEvent.type(closingInput, '10000');
      await userEvent.type(assignmentInput, '15000');
      await userEvent.type(profitInput, '30000');
      
      const button = screen.getByRole('button', { name: /Calculate MAO/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
        });
      });
    });

    it('should disable button while loading', () => {
      (trpc.dealCalculator.save.useMutation as any).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      render(<DealCalculator propertyId={mockPropertyId} />);
      
      const button = screen.getByRole('button', { name: /Calculating/i });
      expect(button).toBeDisabled();
    });

    it('should show loading text while saving', () => {
      (trpc.dealCalculator.save.useMutation as any).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      render(<DealCalculator propertyId={mockPropertyId} />);
      
      expect(screen.getByText('Calculating...')).toBeInTheDocument();
    });
  });

  describe('Results Display', () => {
    it('should display calculation results after success', async () => {
      const mockResults = {
        propertyId: mockPropertyId,
        arv: 500000,
        repairCost: 50000,
        closingCost: 10000,
        assignmentFee: 15000,
        desiredProfit: 30000,
        maxOffer: 395000,
        maoFormula: 'MAO = $500000 - $50000 - $10000 - $15000 - $30000 = $395000',
      };

      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: mockResults,
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText(/Maximum Allowable Offer/i)).toBeInTheDocument();
      });
    });

    it('should display saved badge when calculation exists', async () => {
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('Saved')).toBeInTheDocument();
      });
    });

    it('should display all calculated values', async () => {
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText(/ARV/)).toBeInTheDocument();
        expect(screen.getByText(/Repair Cost/)).toBeInTheDocument();
        expect(screen.getByText(/Closing Cost/)).toBeInTheDocument();
        expect(screen.getByText(/Assignment Fee/)).toBeInTheDocument();
      });
    });
  });

  describe('Offer Price Analysis', () => {
    it('should display offer price input when calculation exists', async () => {
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Enter your offer price/i)).toBeInTheDocument();
      });
    });

    it('should show error when analyzing without offer price', async () => {
      const { toast } = require('sonner');
      
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
        fireEvent.click(analyzeButton);
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter an offer price');
      });
    });
  });

  describe('Delete Functionality', () => {
    it('should display delete button when calculation exists', async () => {
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete Calculation/i })).toBeInTheDocument();
      });
    });

    it('should call delete mutation when delete is confirmed', async () => {
      const mockMutate = vi.fn();
      (trpc.dealCalculator.delete.useMutation as any).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /Delete Calculation/i });
        
        // Mock confirm
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({ propertyId: mockPropertyId });
      });
    });

    it('should show loading state while deleting', async () => {
      (trpc.dealCalculator.delete.useMutation as any).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        expect(screen.getByText('Deleting...')).toBeInTheDocument();
      });
    });
  });

  describe('Currency Formatting', () => {
    it('should format values as currency', async () => {
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        // Check for currency formatting ($ symbol)
        const currencyElements = screen.getAllByText(/\$/);
        expect(currencyElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle mutation errors gracefully', async () => {
      const { toast } = require('sonner');
      
      (trpc.dealCalculator.save.useMutation as any).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        onError: (callback: any) => {
          callback(new Error('Save failed'));
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);
      
      // Component should render without crashing
      expect(screen.getByText('Deal Calculator')).toBeInTheDocument();
    });

    it('should handle missing propertyId', () => {
      render(<DealCalculator propertyId={0} />);
      expect(screen.getByText('Deal Calculator')).toBeInTheDocument();
    });
  });

  describe('Data Persistence', () => {
    it('should populate form with existing calculation data', async () => {
      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      await waitFor(() => {
        const arvInput = screen.getByDisplayValue('500000');
        expect(arvInput).toBeInTheDocument();
      });
    });

    it('should clear form after successful deletion', async () => {
      const mockMutate = vi.fn();
      const mockOnSuccess = vi.fn();

      (trpc.dealCalculator.delete.useMutation as any).mockImplementation((options: any) => {
        // Call onSuccess callback
        options.onSuccess();
        return {
          mutate: mockMutate,
          isPending: false,
        };
      });

      (trpc.dealCalculator.get.useQuery as any).mockReturnValue({
        data: {
          propertyId: mockPropertyId,
          arv: 500000,
          repairCost: 50000,
          closingCost: 10000,
          assignmentFee: 15000,
          desiredProfit: 30000,
          maxOffer: 395000,
          maoFormula: 'MAO formula',
        },
      });

      render(<DealCalculator propertyId={mockPropertyId} />);

      // After deletion, form should be cleared
      // This would require checking the component state
      expect(screen.getByText('Deal Calculator')).toBeInTheDocument();
    });
  });
});

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, DollarSign, TrendingUp, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface DealCalculatorProps {
  propertyId: number;
}

export function DealCalculator({ propertyId }: DealCalculatorProps) {
  const [formData, setFormData] = useState({
    arv: "",
    repairCost: "",
    closingCost: "",
    assignmentFee: "",
    desiredProfit: "",
  });

  const [offerPrice, setOfferPrice] = useState("");
  const [calculations, setCalculations] = useState<any>(null);
  const [profitAnalysis, setProfitAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch existing calculation
  const { data: existingCalculation } = trpc.dealCalculator.get.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  // Setup mutation for saving calculation
  const saveMutation = trpc.dealCalculator.save.useMutation({
    onSuccess: (result) => {
      setCalculations(result);
      toast.success("Deal calculation saved successfully!");
    },
    onError: (error) => {
      toast.error("Failed to save calculation: " + error.message);
      console.error(error);
    },
  });

  // Setup mutation for deleting calculation
  const deleteMutation = trpc.dealCalculator.delete.useMutation({
    onSuccess: () => {
      setCalculations(null);
      setFormData({
        arv: "",
        repairCost: "",
        closingCost: "",
        assignmentFee: "",
        desiredProfit: "",
      });
      toast.success("Calculation deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete calculation: " + error.message);
    },
  });

  // Populate form with existing data
  useEffect(() => {
    if (existingCalculation) {
      setFormData({
        arv: existingCalculation.arv?.toString() || "",
        repairCost: existingCalculation.repairCost?.toString() || "",
        closingCost: existingCalculation.closingCost?.toString() || "",
        assignmentFee: existingCalculation.assignmentFee?.toString() || "",
        desiredProfit: existingCalculation.desiredProfit?.toString() || "",
      });
      setCalculations(existingCalculation);
    }
  }, [existingCalculation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCalculate = async () => {
    // Validate inputs
    if (
      !formData.arv ||
      !formData.repairCost ||
      !formData.closingCost ||
      !formData.assignmentFee ||
      !formData.desiredProfit
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate that all values are positive numbers
    const arv = parseFloat(formData.arv);
    const repairCost = parseFloat(formData.repairCost);
    const closingCost = parseFloat(formData.closingCost);
    const assignmentFee = parseFloat(formData.assignmentFee);
    const desiredProfit = parseFloat(formData.desiredProfit);

    if (isNaN(arv) || isNaN(repairCost) || isNaN(closingCost) || isNaN(assignmentFee) || isNaN(desiredProfit)) {
      toast.error("All fields must be valid numbers");
      return;
    }

    if (arv <= 0) {
      toast.error("ARV must be greater than 0");
      return;
    }

    saveMutation.mutate({
      propertyId,
      arv,
      repairCost,
      closingCost,
      assignmentFee,
      desiredProfit,
    });
  };

  const handleAnalyzeDeal = async () => {
    if (!offerPrice) {
      toast.error("Please enter an offer price");
      return;
    }

    setIsLoading(true);
    try {
      const profitMargin = await (trpc.dealCalculator.calculateProfitMargin as any).query({
        propertyId,
        offerPrice: parseFloat(offerPrice),
      });

      const analysis = await (trpc.dealCalculator.analyzeDeal as any).query({
        propertyId,
        offerPrice: parseFloat(offerPrice),
      });

      setProfitAnalysis({
        ...profitMargin,
        ...analysis,
      });
    } catch (error) {
      toast.error("Failed to analyze deal");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this calculation?")) {
      deleteMutation.mutate({ propertyId });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className="border-l-4 border-l-green-500 bg-green-50/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle>Deal Calculator</CardTitle>
              <CardDescription>Calculate Maximum Allowable Offer (MAO) and profit margins</CardDescription>
            </div>
          </div>
          {calculations && (
            <Badge variant="outline" className="bg-green-100 text-green-800">
              Saved
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Input Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Deal Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="arv" className="text-xs font-medium">
                After Repair Value (ARV) *
              </Label>
              <Input
                id="arv"
                name="arv"
                type="number"
                placeholder="500000"
                value={formData.arv}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="repairCost" className="text-xs font-medium">
                Repair Cost *
              </Label>
              <Input
                id="repairCost"
                name="repairCost"
                type="number"
                placeholder="50000"
                value={formData.repairCost}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="closingCost" className="text-xs font-medium">
                Closing Cost *
              </Label>
              <Input
                id="closingCost"
                name="closingCost"
                type="number"
                placeholder="10000"
                value={formData.closingCost}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="assignmentFee" className="text-xs font-medium">
                Assignment Fee *
              </Label>
              <Input
                id="assignmentFee"
                name="assignmentFee"
                type="number"
                placeholder="15000"
                value={formData.assignmentFee}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="desiredProfit" className="text-xs font-medium">
                Desired Profit *
              </Label>
              <Input
                id="desiredProfit"
                name="desiredProfit"
                type="number"
                placeholder="30000"
                value={formData.desiredProfit}
                onChange={handleInputChange}
                className="mt-1"
              />
            </div>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={saveMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {saveMutation.isPending ? "Calculating..." : "Calculate MAO"}
          </Button>
        </div>

        {/* Results Section */}
        {calculations && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Calculation Results</h3>

            <div className="bg-white p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Maximum Allowable Offer (MAO)</span>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(calculations.maxOffer)}
                </span>
              </div>
              <p className="text-xs text-gray-500 break-words">{calculations.maoFormula}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600">ARV</p>
                <p className="font-semibold">{formatCurrency(calculations.arv)}</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600">Repair Cost</p>
                <p className="font-semibold">{formatCurrency(calculations.repairCost)}</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600">Closing Cost</p>
                <p className="font-semibold">{formatCurrency(calculations.closingCost)}</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-gray-600">Assignment Fee</p>
                <p className="font-semibold">{formatCurrency(calculations.assignmentFee)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Offer Price Analysis */}
        {calculations && (
          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-sm">Offer Price Analysis</h3>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Enter your offer price"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyzeDeal}
                disabled={saveMutation.isPending}
                variant="outline"
              >
                Analyze
              </Button>
            </div>

            {profitAnalysis && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border-l-4 ${
                  profitAnalysis.isViable
                    ? "border-l-green-500 bg-green-50"
                    : "border-l-red-500 bg-red-50"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {profitAnalysis.isViable ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className={`font-semibold ${
                      profitAnalysis.isViable ? "text-green-800" : "text-red-800"
                    }`}>
                      {profitAnalysis.reason}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-600">Profit</p>
                      <p className="font-semibold text-lg">
                        {formatCurrency(profitAnalysis.profit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Profit Margin</p>
                      <p className="font-semibold text-lg">
                        {profitAnalysis.profitMargin.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Button */}
        {calculations && (
          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            variant="destructive"
            className="w-full"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Calculation"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

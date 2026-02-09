import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  DollarSign, 
  Phone, 
  User, 
  Home,
  Flame,
  Snowflake,
  ThermometerSun,
  Skull,
  CheckCircle2,
  XCircle,
  Calendar,
  TrendingUp,
  FileText,
  Search,
  AlertCircle,
  Download,
  HelpCircle,
  Building,
  Users,
  Scale,
  Wrench,
  ClipboardList
} from "lucide-react";
import { SkiptracingTable } from "./SkiptracingTable";
import { OutreachTable } from "./OutreachTable";


interface LeadSummaryProps {
  propertyId: number;
}

export function LeadSummary({ propertyId }: LeadSummaryProps) {
  const { data: property, isLoading } = trpc.properties.getById.useQuery({ id: propertyId });
  const { data: deepSearchData } = trpc.properties.getDeepSearch.useQuery({ propertyId });
  
  // Safe JSON parse helper
  const safeJsonParse = <T,>(str: string | null | undefined, fallback: T): T => {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  };

  // Merge property data with deep search data
  const propertyData = { ...property, ...deepSearchData } as any;

  if (isLoading) {
    return <div className="p-8 text-center">Loading summary...</div>;
  }

  if (!property) {
    return <div className="p-8 text-center text-muted-foreground">Property not found</div>;
  }

  // Calculate key metrics
  const zillowEstimate = propertyData.zillowEstimate || 0;
  const dealMachineEstimate = propertyData.dealMachineEstimate || 0;
  const ourEstimate = propertyData.ourEstimate || 0;
  const mortgageAmount = propertyData.mortgageAmount || 0;
  const estimatedValue = ourEstimate || dealMachineEstimate || zillowEstimate || property.estimatedValue || 0;
  const equityPercent = estimatedValue > 0 && mortgageAmount > 0
    ? Math.round(((estimatedValue - mortgageAmount) / estimatedValue) * 100)
    : propertyData.equityPercent || 0;
  const equityAmount = estimatedValue - mortgageAmount;

  // Lead temperature styling
  const leadTempIcon = 
    property.leadTemperature === "SUPER HOT" ? <><Flame className="h-5 w-5 text-blue-600" /><Flame className="h-5 w-5 text-blue-600 -ml-3" /></> :
    property.leadTemperature === "HOT" ? <Flame className="h-5 w-5 text-red-600" /> :
    property.leadTemperature === "DEEP SEARCH" ? <Search className="h-5 w-5 text-purple-600" /> :
    property.leadTemperature === "WARM" ? <ThermometerSun className="h-5 w-5 text-yellow-600" /> :
    property.leadTemperature === "COLD" ? <Snowflake className="h-5 w-5 text-blue-400" /> :
    property.leadTemperature === "TBD" ? <HelpCircle className="h-5 w-5 text-gray-400" /> :
    <Skull className="h-5 w-5 text-gray-500" />;

  const leadTempColor =
    property.leadTemperature === "SUPER HOT" ? "bg-blue-700 border-blue-800 text-white" :
    property.leadTemperature === "HOT" ? "bg-green-700 border-green-800 text-white" :
    property.leadTemperature === "DEEP SEARCH" ? "bg-purple-700 border-purple-800 text-white" :
    property.leadTemperature === "WARM" ? "bg-amber-600 border-amber-700 text-white" :
    property.leadTemperature === "COLD" ? "bg-gray-600 border-gray-700 text-white" :
    property.leadTemperature === "TBD" ? "bg-white border-gray-400 text-gray-700" :
    property.leadTemperature === "DEAD" ? "bg-purple-800 border-purple-900 text-white" :
    "bg-gray-100 border-gray-300 text-gray-700";

  // Parse JSON fields
  const parsedCondition = safeJsonParse<{ rating?: string; tags?: string[] } | string[]>(propertyData.propertyCondition, {});
  const conditionRating = !Array.isArray(parsedCondition) ? (parsedCondition as { rating?: string }).rating : null;
  const conditionTags = Array.isArray(parsedCondition) ? parsedCondition : ((parsedCondition as { tags?: string[] }).tags || []);
  
  const parsedPropertyType = safeJsonParse<{ type?: string; tags?: string[] }>(propertyData.propertyType, {});
  const propertyTypeValue = parsedPropertyType.type || property.propertyType || "N/A";
  const propertyTypeTags = parsedPropertyType.tags || [];
  
  const sellerIssues = safeJsonParse<string[]>(propertyData.issues, []);
  const probateFinds = safeJsonParse<string[]>(propertyData.probateFinds, []);
  const familyMembers = safeJsonParse<any[]>(propertyData.familyTree, []);
  const recordsChecked = safeJsonParse<string[]>(propertyData.recordsChecked, []);
  const deedEntries = safeJsonParse<any[]>(propertyData.deedType, []);
  const repairTypes = safeJsonParse<string[]>(propertyData.repairTypes, []);
  const skiptracingDone = safeJsonParse<Record<string, string | null>>(propertyData.skiptracingDone, {});
  const outreachDone = safeJsonParse<Record<string, string | null>>(propertyData.outreachDone, {});

  // Calculate delinquent taxes
  const tax2025 = propertyData.delinquentTax2025 || 0;
  const tax2024 = propertyData.delinquentTax2024 || 0;
  const tax2023 = propertyData.delinquentTax2023 || 0;
  const tax2022 = propertyData.delinquentTax2022 || 0;
  const tax2021 = propertyData.delinquentTax2021 || 0;
  const tax2020 = propertyData.delinquentTax2020 || 0;
  const totalTax = tax2025 + tax2024 + tax2023 + tax2022 + tax2021 + tax2020;

  // Format currency
  const formatCurrency = (value: number) => {
    if (!value) return "$0";
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Export Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export to PDF
        </Button>
      </div>

      {/* ===== HEADER: Key Metrics ===== */}
      <div className="grid grid-cols-5 gap-3">
        {/* Lead Status */}
        <Card className="border shadow-sm bg-white">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {leadTempIcon}
            </div>
            <div className="text-lg font-bold text-slate-900">{property.leadTemperature || "TBD"}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Lead Status</div>
          </CardContent>
        </Card>

        {/* Our Estimate */}
        <Card className="border shadow-sm bg-white border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3 text-center">
            <DollarSign className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-900">{formatCurrency(ourEstimate)}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Our Estimate</div>
          </CardContent>
        </Card>

        {/* Equity */}
        <Card className="border shadow-sm bg-white border-l-4 border-l-purple-500">
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-900">{equityPercent}%</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Equity</div>
          </CardContent>
        </Card>

        {/* MLS Status */}
        <Card className="border shadow-sm bg-white border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3 text-center">
            <Home className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <div className="text-lg font-bold text-slate-900">{propertyData.mlsStatus || "Off Market"}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">MLS Status</div>
          </CardContent>
        </Card>

        {/* Owner Verified */}
        <Card className={`border shadow-sm bg-white ${property.ownerVerified === 1 ? "border-l-4 border-l-emerald-500" : ""}`}>
          <CardContent className="pt-4 pb-3 text-center">
            {property.ownerVerified === 1 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            ) : (
              <User className="h-5 w-5 text-slate-300 mx-auto mb-1" />
            )}
            <div className={`text-lg font-bold ${property.ownerVerified === 1 ? "text-slate-900" : "text-slate-400"}`}>
              {property.ownerVerified === 1 ? "Verified" : "Pending"}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Owner</div>
          </CardContent>
        </Card>
      </div>

      {/* ===== PROPERTY & OWNER INFO ===== */}
      <div className="grid grid-cols-2 gap-4">
        {/* Property Info */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building className="h-4 w-4 text-indigo-600" />
              Property Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">{property.addressLine1}</div>
                <div className="text-sm text-muted-foreground">
                  {property.city}, {property.state} {property.zipcode}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="font-medium">{propertyTypeValue}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Year Built</div>
                <div className="font-medium">{property.yearBuilt || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Occupancy</div>
                <div className="font-medium">{propertyData.occupancy || "Unknown"}</div>
              </div>
            </div>
            {propertyTypeTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {propertyTypeTags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Owner Info */}
        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-amber-600" />
              Owner Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Owner 1</div>
                <div className="font-semibold">{property.owner1Name || "Unknown"}</div>
              </div>
              {property.owner2Name && (
                <div>
                  <div className="text-xs text-muted-foreground">Owner 2</div>
                  <div className="font-medium">{property.owner2Name}</div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Location</div>
                <Badge variant={property.ownerLocation === "Owner Occupied" ? "default" : "secondary"}>
                  {property.ownerLocation || "Unknown"}
                </Badge>
              </div>
              {property.ownerVerified === 1 && (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Verified</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== OVERVIEW SECTION ===== */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="pb-2 bg-blue-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Property Condition */}
          {(conditionRating || conditionTags.length > 0) && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Property Condition</div>
              <div className="flex flex-wrap gap-2">
                {conditionRating && (
                  <Badge 
                    className={
                      conditionRating === "Poor" ? "bg-red-100 text-red-700 border-red-300" :
                      conditionRating === "Fair" || conditionRating === "Average" ? "bg-orange-100 text-orange-700 border-orange-300" :
                      "bg-green-100 text-green-700 border-green-300"
                    }
                  >
                    {conditionRating}
                  </Badge>
                )}
                {conditionTags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Seller Issues */}
          {sellerIssues.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Seller Issues</div>
              <div className="flex flex-wrap gap-2">
                {sellerIssues.map((issue: string) => (
                  <Badge key={issue} variant="outline" className="bg-amber-50 border-amber-300 text-amber-700">
                    ⚠️ {issue}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Probate Finds */}
          {probateFinds.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Probate Findings</div>
              <div className="flex flex-wrap gap-2">
                {probateFinds.map((find: string) => (
                  <Badge key={find} variant="secondary">{find}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Family Tree */}
          {familyMembers.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Family Tree
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-3 font-semibold">Name</th>
                      <th className="text-left py-2 px-3 font-semibold">Relationship</th>
                      <th className="text-center py-2 px-3 font-semibold">Representative</th>
                      <th className="text-center py-2 px-3 font-semibold">Deceased</th>
                      <th className="text-center py-2 px-3 font-semibold">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMembers.map((member: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2 px-3">{member.name || "-"}</td>
                        <td className="py-2 px-3">{member.relationship || "-"}</td>
                        <td className="py-2 px-3 text-center">{member.isRepresentative ? "✓" : "-"}</td>
                        <td className="py-2 px-3 text-center">{member.isDeceased ? "✓" : "-"}</td>
                        <td className="py-2 px-3 text-center">{member.hasContact ? "✓" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overview Notes */}
          {propertyData.overviewNotes && (
            <div className="pt-2 border-t">
              <div className="text-sm font-semibold text-gray-700 mb-1">Notes</div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{propertyData.overviewNotes}</p>
            </div>
          )}

          {/* Probate Notes */}
          {propertyData.probateNotes && (
            <div className="pt-2 border-t">
              <div className="text-sm font-semibold text-gray-700 mb-1">Probate Notes</div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{propertyData.probateNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== FINANCIAL SECTION ===== */}
      <Card className="border-2 border-green-200">
        <CardHeader className="pb-2 bg-green-50">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Financial
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Property Value Estimates */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-3">Property Value Estimates</div>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Zillow</div>
                <div className="text-lg font-bold">{formatCurrency(zillowEstimate)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">DealMachine</div>
                <div className="text-lg font-bold">{formatCurrency(dealMachineEstimate)}</div>
              </div>
              <div className="bg-green-100 rounded-lg p-3 text-center border-2 border-green-300">
                <div className="text-xs text-green-700 font-semibold mb-1">OUR ESTIMATE</div>
                <div className="text-lg font-bold text-green-700">{formatCurrency(ourEstimate)}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Equity</div>
                <div className="text-lg font-bold text-purple-700">{equityPercent}%</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(equityAmount)}</div>
              </div>
            </div>
          </div>

          {/* Estimate Notes */}
          {propertyData.estimateNotes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Estimate Notes</div>
              <p className="text-sm">{propertyData.estimateNotes}</p>
            </div>
          )}

          {/* Rent & Lease */}
          {(propertyData.monthlyRent || propertyData.annualRent || propertyData.leaseType) && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Rent Information</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Monthly Rent</div>
                  <div className="font-semibold">{formatCurrency(propertyData.monthlyRent || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Annual Rent</div>
                  <div className="font-semibold">{formatCurrency(propertyData.annualRent || 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Lease Type</div>
                  <div className="font-semibold">{propertyData.leaseType || "-"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Delinquent Taxes */}
          {totalTax > 0 && (
            <div>
              <div className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Delinquent Taxes
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-red-50">
                      <th className="py-2 px-3 text-center">2025</th>
                      <th className="py-2 px-3 text-center">2024</th>
                      <th className="py-2 px-3 text-center">2023</th>
                      <th className="py-2 px-3 text-center">2022</th>
                      <th className="py-2 px-3 text-center">2021</th>
                      <th className="py-2 px-3 text-center">2020</th>
                      <th className="py-2 px-3 text-center font-bold text-red-700">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="py-2 px-3 text-center">{formatCurrency(tax2025)}</td>
                      <td className="py-2 px-3 text-center">{formatCurrency(tax2024)}</td>
                      <td className="py-2 px-3 text-center">{formatCurrency(tax2023)}</td>
                      <td className="py-2 px-3 text-center">{formatCurrency(tax2022)}</td>
                      <td className="py-2 px-3 text-center">{formatCurrency(tax2021)}</td>
                      <td className="py-2 px-3 text-center">{formatCurrency(tax2020)}</td>
                      <td className="py-2 px-3 text-center font-bold text-red-700">{formatCurrency(totalTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mortgage */}
          {propertyData.hasMortgage === 1 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Mortgage</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Mortgage Amount</div>
                  <div className="font-semibold">{formatCurrency(mortgageAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Equity %</div>
                  <div className="font-semibold">{equityPercent}%</div>
                </div>
              </div>
              {propertyData.mortgageNotes && (
                <div className="mt-2 bg-gray-50 rounded p-2">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <p className="text-sm">{propertyData.mortgageNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Repairs */}
          {propertyData.needsRepairs === 1 && (
            <div>
              <div className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Needs Repairs
              </div>
              {repairTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {repairTypes.map((type: string) => (
                    <Badge key={type} variant="outline" className="bg-orange-50 border-orange-300">{type}</Badge>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Estimated Repair Cost</div>
                  <div className="font-semibold text-orange-700">{formatCurrency(propertyData.estimatedRepairCost || 0)}</div>
                </div>
              </div>
              {propertyData.repairNotes && (
                <div className="mt-2 bg-orange-50 rounded p-2">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <p className="text-sm">{propertyData.repairNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Code Violations & Liens */}
          <div className="grid grid-cols-2 gap-4">
            {propertyData.hasCodeViolation === 1 && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="flex items-center gap-2 text-red-700 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  Has Code Violations
                </div>
                {propertyData.codeViolationNotes && (
                  <p className="text-sm text-red-600 mt-1">{propertyData.codeViolationNotes}</p>
                )}
              </div>
            )}
            {propertyData.hasLiens === 1 && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <div className="flex items-center gap-2 text-red-700 font-semibold">
                  <Scale className="h-4 w-4" />
                  Has Liens
                </div>
                {propertyData.liensNotes && (
                  <p className="text-sm text-red-600 mt-1">{propertyData.liensNotes}</p>
                )}
              </div>
            )}
          </div>

          {/* Deed Type */}
          {deedEntries.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Deed Records
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left py-2 px-3 font-semibold">Type</th>
                      <th className="text-left py-2 px-3 font-semibold">Date</th>
                      <th className="text-left py-2 px-3 font-semibold">Amount</th>
                      <th className="text-left py-2 px-3 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deedEntries.map((entry: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2 px-3">{entry.type || "-"}</td>
                        <td className="py-2 px-3">{entry.deedDate ? new Date(entry.deedDate).toLocaleDateString() : "-"}</td>
                        <td className="py-2 px-3">{formatCurrency(Number(entry.amount) || 0)}</td>
                        <td className="py-2 px-3">{entry.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== RESEARCH SECTION ===== */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="pb-2 bg-purple-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" />
            Research
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Records Checked */}
          {recordsChecked.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Records Checked</div>
              <div className="flex flex-wrap gap-2">
                {recordsChecked.map((record: string) => (
                  <Badge key={record} variant="secondary" className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    {record}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Research Notes */}
          {propertyData.recordsCheckedNotes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Research Notes</div>
              <p className="text-sm">{propertyData.recordsCheckedNotes}</p>
            </div>
          )}

          {/* Skiptracing Notes */}
          {propertyData.skiptracingNotes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Skiptracing Notes</div>
              <p className="text-sm">{propertyData.skiptracingNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== OUTREACH SECTION ===== */}
      <Card className="border-2 border-orange-200">
        <CardHeader className="pb-2 bg-orange-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-5 w-5 text-orange-600" />
            Outreach
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          <SkiptracingTable propertyId={propertyId} />
          <Separator />
          <OutreachTable propertyId={propertyId} />
        </CardContent>
      </Card>
    </div>
  );
}

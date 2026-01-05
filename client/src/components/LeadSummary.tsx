import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  Settings,
  HelpCircle
} from "lucide-react";
import { SkiptracingTable } from "./SkiptracingTable";
import { OutreachTable } from "./OutreachTable";


interface LeadSummaryProps {
  propertyId: number;
}

export function LeadSummary({ propertyId }: LeadSummaryProps) {
  const { data: property, isLoading } = trpc.properties.getById.useQuery({ id: propertyId });
  const { data: deepSearchData } = trpc.properties.getDeepSearch.useQuery({ propertyId });
  
  // Smart filter state
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  
  // Custom summary fields state
  const [visibleSections, setVisibleSections] = useState({
    overview: true,
    research: true,
    financial: true,
    outreach: true,
  });
  
  const [customizeDialogOpen, setCustomizeDialogOpen] = useState(false);
  
  // Load preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('summary-visible-sections');
    if (saved) {
      try {
        setVisibleSections(JSON.parse(saved));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);
  
  // Save preferences to localStorage
  const toggleSection = (section: keyof typeof visibleSections) => {
    const updated = { ...visibleSections, [section]: !visibleSections[section] };
    setVisibleSections(updated);
    localStorage.setItem('summary-visible-sections', JSON.stringify(updated));
  };
  
  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };
  
  // Type assertion for fields that exist in schema but not in inferred type
  // Merge property data with deep search data (deep search data takes priority)
  const propertyData = { ...property, ...deepSearchData } as any;

  if (isLoading) {
    return <div className="p-8 text-center">Loading summary...</div>;
  }

  if (!property) {
    return <div className="p-8 text-center text-muted-foreground">Property not found</div>;
  }

  // Calculate key metrics
  const mortgageAmount = property.mortgageAmount || 0;
  const estimatedValue = property.estimatedValue || 0;
  const equityPercent = estimatedValue > 0 
    ? Math.round(((estimatedValue - mortgageAmount) / estimatedValue) * 100)
    : 0;
  const equityAmount = estimatedValue - mortgageAmount;

  const leadTempIcon = 
    property.leadTemperature === "SUPER HOT" ? <><Flame className="h-5 w-5 text-blue-600" /><Flame className="h-5 w-5 text-blue-600 -ml-3" /></> :
    property.leadTemperature === "HOT" ? <Flame className="h-5 w-5 text-green-600" /> :
    property.leadTemperature === "WARM" ? <ThermometerSun className="h-5 w-5 text-yellow-600" /> :
    property.leadTemperature === "COLD" ? <Snowflake className="h-5 w-5 text-gray-500" /> :
    property.leadTemperature === "TBD" ? <HelpCircle className="h-5 w-5 text-gray-400" /> :
    <Skull className="h-5 w-5 text-gray-500" />;

  const leadTempColor =
    property.leadTemperature === "SUPER HOT" ? "bg-blue-100 border-blue-300" :
    property.leadTemperature === "HOT" ? "bg-green-100 border-green-300" :
    property.leadTemperature === "WARM" ? "bg-yellow-100 border-yellow-300" :
    property.leadTemperature === "COLD" ? "bg-gray-100 border-gray-300" :
    property.leadTemperature === "TBD" ? "bg-white border-gray-300" :
    "bg-gray-100 border-gray-300";

  // Extract positive/important information from all tabs
  const mlsStatus = propertyData.mlsStatus || "Not Listed";
  const occupancy = propertyData.occupancy || "Unknown";
  const monthlyRent = propertyData.monthlyRent || 0;
  
  // Parse JSON fields
  const recordsChecked = propertyData.recordsChecked ? JSON.parse(propertyData.recordsChecked) : [];
  const recordDetails = propertyData.recordDetails ? JSON.parse(propertyData.recordDetails) : [];
  const propertyCondition = propertyData.propertyCondition ? JSON.parse(propertyData.propertyCondition) : [];
  const propertyIssues = propertyData.propertyIssues ? JSON.parse(propertyData.propertyIssues) : [];
  const hasLiens = propertyData.hasLiens === 1;
  const hasCodeViolations = propertyData.hasCodeViolation === 1;
  
  // Parse skiptracing and outreach JSON objects
  const skiptracingDone = propertyData.skiptracingDone ? JSON.parse(propertyData.skiptracingDone) : {};
  const skiptracingChecked = Object.entries(skiptracingDone).filter(([_, date]) => date !== null);
  
  const outreachDone = propertyData.outreachDone ? JSON.parse(propertyData.outreachDone) : {};
  const outreachChecked = Object.entries(outreachDone).filter(([_, date]) => date !== null);

  // Check if property matches active filters
  const matchesFilters = () => {
    if (activeFilters.length === 0) return true;
    
    return activeFilters.every(filter => {
      switch(filter) {
        case 'high-equity': return equityPercent >= 50;
        case 'has-liens': return hasLiens;
        case 'skiptraced': return skiptracingChecked.length > 0;
        case 'owner-occupied': return property.ownerLocation === 'Owner Occupied';
        case 'has-mortgage': return mortgageAmount > 0;
        default: return true;
      }
    });
  };
  
  const isFiltered = !matchesFilters();

  return (
    <div className="space-y-6 p-4">
      {/* Export PDF & Customize Buttons */}
      <div className="flex justify-end gap-2 mb-4">
          <Dialog open={customizeDialogOpen} onOpenChange={setCustomizeDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
              >
                <Settings className="h-3.5 w-3.5" />
                Customize
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Customize Summary Sections</DialogTitle>
                <DialogDescription>
                  Choose which sections to display in the summary tab
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overview"
                    checked={visibleSections.overview}
                    onCheckedChange={() => toggleSection('overview')}
                  />
                  <Label htmlFor="overview" className="cursor-pointer">
                    Overview Highlights (MLS Status, Occupancy, Monthly Rent)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="research"
                    checked={visibleSections.research}
                    onCheckedChange={() => toggleSection('research')}
                  />
                  <Label htmlFor="research" className="cursor-pointer">
                    Research Status (Records, Mortgage, Liens, Code Violations)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="financial"
                    checked={visibleSections.financial}
                    onCheckedChange={() => toggleSection('financial')}
                  />
                  <Label htmlFor="financial" className="cursor-pointer">
                    Financial Highlights (Equity, Estimated Value)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="outreach"
                    checked={visibleSections.outreach}
                    onCheckedChange={() => toggleSection('outreach')}
                  />
                  <Label htmlFor="outreach" className="cursor-pointer">
                    Outreach Status (Skiptracing Done)
                  </Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
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
      
      {/* Show message if filtered out */}
      {isFiltered && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-sm text-yellow-800 font-medium">This property doesn't match the selected filters</p>
        </div>
      )}
      
      {/* Top Status Bar - ADHD-friendly visual indicators */}
      <div className={`grid grid-cols-4 gap-4 ${isFiltered ? 'opacity-40' : ''}`}>
        <Card className={`border-2 ${leadTempColor}`}>
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-2 mb-1">
              {leadTempIcon}
              <span className="text-xs font-medium text-muted-foreground">Lead Status</span>
            </div>
            <div className="text-2xl font-bold">{property.leadTemperature}</div>
          </CardContent>
        </Card>

        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-xs font-medium text-muted-foreground">Equity %</span>
            </div>
            <div className="text-2xl font-bold text-green-700">{equityPercent}%</div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <span className="text-xs font-medium text-muted-foreground">Est. Value</span>
            </div>
            <div className="text-2xl font-bold text-purple-700">
              ${(property.estimatedValue || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center gap-2 mb-1">
              {property.ownerVerified === 1 ? (
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              ) : (
                <User className="h-5 w-5 text-blue-600" />
              )}
              <span className="text-xs font-medium text-muted-foreground">Owner</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {property.ownerVerified === 1 ? "✓ Verified" : "Not Verified"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property Highlights - Conditions & Issues */}
      <Card className="border-2 border-rose-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="h-4 w-4 text-rose-600" />
            Property Highlights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Property Condition */}
          {property.propertyCondition && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-semibold">Property Condition</div>
              <div className="flex flex-wrap gap-2">
                {JSON.parse(property.propertyCondition).map((condition: string) => (
                  <Badge 
                    key={condition}
                    variant="outline"
                    className={
                      condition === "Bad" || condition === "Board Up" || condition === "Abandoned" 
                        ? "bg-red-50 border-red-300 text-red-700"
                        : condition === "Need New Roof"
                        ? "bg-orange-50 border-orange-300 text-orange-700"
                        : "bg-gray-50 border-gray-300"
                    }
                  >
                    {condition === "Bad" && "🔴 "}
                    {condition === "Board Up" && "🔴 "}
                    {condition === "Abandoned" && "🔴 "}
                    {condition === "Need New Roof" && "🟠 "}
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {/* Property Issues */}
          {property.issues && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 font-semibold">Property Issues</div>
              <div className="flex flex-wrap gap-2">
                {JSON.parse(property.issues).map((issue: string) => (
                  <Badge 
                    key={issue}
                    variant="outline"
                    className={
                      issue === "Behind mortgage" || issue === "Deferred Maintenance"
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "bg-amber-50 border-amber-300 text-amber-700"
                    }
                  >
                    {(issue === "Behind mortgage" || issue === "Deferred Maintenance") && "⚠️ "}
                    {issue}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consolidated Summary from All Tabs - POSITIVE INFO ONLY */}
      <div className="grid grid-cols-2 gap-4">
        {/* Overview Summary */}
        {visibleSections.overview && (
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="h-4 w-4 text-blue-600" />
              Overview Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">MLS Status</span>
              <span className="font-semibold">{mlsStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Occupancy</span>
              <span className="font-semibold">{occupancy}</span>
            </div>
            {monthlyRent > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Rent</span>
                <span className="font-semibold text-green-700">${monthlyRent.toLocaleString()}</span>
              </div>
            )}
            {propertyData.overviewNotes && (
              <div className="pt-2 border-t border-blue-200">
                <span className="text-xs text-muted-foreground font-semibold">Notes:</span>
                <p className="text-xs mt-1 text-gray-700 whitespace-pre-wrap">{propertyData.overviewNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Research Summary */}
        {visibleSections.research && (
        <Card className="border-2 border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4 text-purple-600" />
              Research Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recordsChecked.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground font-semibold mb-1 block">Records Checked</span>
                <div className="flex flex-wrap gap-1">
                  {recordsChecked.map((record: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {record}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {recordDetails.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground font-semibold mb-1 block">Record Details</span>
                <div className="flex flex-wrap gap-1">
                  {recordDetails.map((detail: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {detail}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {hasLiens && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-700 font-semibold">Has Liens</span>
              </div>
            )}
            {hasCodeViolations && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-700 font-semibold">Code Violations</span>
              </div>
            )}
            {(propertyData.recordsCheckedNotes || propertyData.recordDetailsFindings) && (
              <div className="pt-2 border-t border-purple-200">
                <span className="text-xs text-muted-foreground font-semibold">Notes:</span>
                {propertyData.recordsCheckedNotes && (
                  <p className="text-xs mt-1 text-gray-700 whitespace-pre-wrap"><strong>Records:</strong> {propertyData.recordsCheckedNotes}</p>
                )}
                {propertyData.recordDetailsFindings && (
                  <p className="text-xs mt-1 text-gray-700 whitespace-pre-wrap"><strong>Findings:</strong> {propertyData.recordDetailsFindings}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Deed Type Summary */}
        {visibleSections.research && propertyData.deedType && (() => {
          try {
            const deedEntries = JSON.parse(propertyData.deedType);
            if (Array.isArray(deedEntries) && deedEntries.length > 0) {
              return (
                <Card className="border-2 border-purple-200 bg-purple-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      Deed Type Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-purple-200">
                            <th className="text-left py-2 px-2 font-semibold text-purple-900">TYPE DEED</th>
                            <th className="text-left py-2 px-2 font-semibold text-purple-900">DEED DATE</th>
                            <th className="text-left py-2 px-2 font-semibold text-purple-900">AMOUNT$</th>
                            <th className="text-left py-2 px-2 font-semibold text-purple-900">NOTES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deedEntries.map((entry: any, index: number) => (
                            <tr key={index} className="border-b border-purple-100">
                              <td className="py-2 px-2 text-gray-700">{entry.type || '-'}</td>
                              <td className="py-2 px-2 text-gray-700">
                                {entry.deedDate ? new Date(entry.deedDate).toLocaleDateString('en-US') : '-'}
                              </td>
                              <td className="py-2 px-2 text-gray-700">
                                {entry.amount ? `$${Number(entry.amount).toLocaleString()}` : '$0'}
                              </td>
                              <td className="py-2 px-2 text-gray-700">{entry.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            }
          } catch (e) {
            console.error('Failed to parse deedType:', e);
          }
          return null;
        })()}

        {/* Financial Summary */}
        {visibleSections.financial && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Financial Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Equity Amount</span>
              <span className="font-semibold text-green-700">${equityAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Equity Percent</span>
              <span className="font-semibold text-green-700">{equityPercent}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Value</span>
              <span className="font-semibold">${estimatedValue.toLocaleString()}</span>
            </div>

            {/* Checkbox Statuses */}
            <div className="pt-2 border-t border-green-200 space-y-1">
              <div className="flex items-center gap-2">
                {propertyData.hasMortgage === 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-muted-foreground">Has Mortgage</span>
              </div>
              <div className="flex items-center gap-2">
                {propertyData.needsRepairs === 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-muted-foreground">Needs Repairs</span>
              </div>
              <div className="flex items-center gap-2">
                {propertyData.hasLiens === 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-muted-foreground">Has Liens</span>
              </div>
              <div className="flex items-center gap-2">
                {propertyData.hasCodeViolation === 1 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-muted-foreground">Has Code Violation</span>
              </div>
            </div>

            {/* Mortgage Amount */}
            {mortgageAmount > 0 && (
              <div className="flex justify-between pt-2 border-t border-green-200">
                <span className="text-muted-foreground">Mortgage Amount</span>
                <span className="font-semibold">${mortgageAmount.toLocaleString()}</span>
              </div>
            )}

            {/* Delinquent Taxes Table */}
            {(() => {
              const years = ['2025', '2024', '2023', '2022', '2021', '2020'];
              const taxData = years.map(year => ({
                year,
                amount: Number(propertyData?.[`delinquentTaxes${year}` as keyof typeof propertyData] || 0)
              }));
              const total = taxData.reduce((sum, item) => sum + item.amount, 0);
              
              return total > 0 ? (
                <div className="pt-2 border-t border-green-200">
                  <span className="text-xs text-muted-foreground font-semibold mb-2 block">Delinquent Taxes by Year</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-green-200">
                          {taxData.map(item => (
                            <th key={item.year} className="text-center py-1 px-2 font-semibold text-green-900">{item.year}</th>
                          ))}
                          <th className="text-center py-1 px-2 font-semibold text-green-900">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {taxData.map(item => (
                            <td key={item.year} className="text-center py-1 px-2 text-gray-700">
                              {item.amount > 0 ? `$${item.amount.toLocaleString()}` : '$0'}
                            </td>
                          ))}
                          <td className="text-center py-1 px-2 font-semibold text-red-600">
                            ${total.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Repair Cost */}
            {propertyData?.needsRepairs === 1 && propertyData?.estimatedRepairCost && (
              <div className="flex justify-between pt-2 border-t border-green-200">
                <span className="text-muted-foreground">Estimated Repair Cost</span>
                <span className="font-semibold">${Number(propertyData.estimatedRepairCost).toLocaleString()}</span>
              </div>
            )}
            {propertyData.mortgageNotes && (
              <div className="pt-2 border-t border-green-200">
                <span className="text-xs text-muted-foreground font-semibold">Mortgage Notes:</span>
                <p className="text-xs mt-1 text-gray-700 whitespace-pre-wrap">{propertyData.mortgageNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Outreach Summary */}
        {visibleSections.outreach && (
        <Card className="border-2 border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="h-4 w-4 text-orange-600" />
              Outreach Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <SkiptracingTable propertyId={propertyId} />
            <OutreachTable propertyId={propertyId} />
          </CardContent>
        </Card>
        )}
      </div>



      {/* Property & Owner Info Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Property Info */}
        <Card className="border-2 border-indigo-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4 text-indigo-600" />
              Property Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm">
                  {property.addressLine1}
                </div>
                <div className="text-xs text-muted-foreground">
                  {property.city}, {property.state} {property.zipcode}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="text-sm font-medium">{property.propertyType || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Year Built</div>
                <div className="text-sm font-medium">{property.yearBuilt || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Construction</div>
                <div className="text-sm font-medium">{property.constructionType || "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="text-sm font-medium">{property.status || "-"}</div>
              </div>
            </div>

            {property.trackingStatus && (
              <div className="pt-2">
                <Badge variant="outline" className="text-xs">
                  {property.trackingStatus}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Owner Info */}
        <Card className="border-2 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-amber-600" />
              Owner Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-xs text-muted-foreground">Owner 1</div>
              <div className="text-sm font-semibold">{property.owner1Name || "Unknown"}</div>
            </div>
            
            {property.owner2Name && (
              <div>
                <div className="text-xs text-muted-foreground">Owner 2</div>
                <div className="text-sm font-medium">{property.owner2Name}</div>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground">Owner Location</div>
              <div className="text-sm font-medium">
                <Badge variant={property.ownerLocation === "Owner Occupied" ? "default" : "secondary"}>
                  {property.ownerLocation || "Unknown"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


    </div>
  );
}

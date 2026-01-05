import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { 
  ClipboardList, 
  Search, 
  DollarSign, 
  Phone, 
  CheckSquare,
  Home,
  FileText,
  AlertCircle,
  Wrench,
  Scale,
  Users as UsersIcon,
  Calendar,
  Building,
  TreePine,
  Plus,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { LeadSummary } from "./LeadSummary";
import { SkiptracingTable } from "./SkiptracingTable";
import { OutreachTable } from "./OutreachTable";
import { LeadStageNavigation } from "./LeadStageNavigation";
import { DeepSearchHeader } from "./DeepSearchHeader";
import { QuickStats } from "./QuickStats";
import { MiniBlock, TagSelector, RatingSelector, SectionDivider } from "./ui/mini-block";

// Currency formatting helper
const formatCurrency = (value: string | number): string => {
  if (!value && value !== 0) return "";
  const num = typeof value === "string" ? parseInt(value.replace(/,/g, "")) : value;
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US");
};

const parseCurrency = (value: string): string => {
  // Remove commas and non-numeric characters except digits
  return value.replace(/[^0-9]/g, "");
};

interface DeepSearchTabsProps {
  propertyId: number;
}

// Property Condition - Main Rating
const PROPERTY_CONDITION_RATINGS = [
  { value: "Excellent", color: "bg-green-500" },
  { value: "Good", color: "bg-green-400" },
  { value: "Fair", color: "bg-yellow-400" },
  { value: "Average", color: "bg-orange-400" },
  { value: "Poor", color: "bg-red-500" },
];

// Property Condition Tags
const PROPERTY_CONDITION_TAGS = [
  "Abandoned",
  "Boarded Up",
  "Condemned",
  "Deferred Maintenance",
  "Fire Damage",
  "Flood Damage",
  "Hoarder Situation",
  "Hurricane Damage",
  "Locked Gates",
  "Major Repairs Needed",
  "Mold Damage",
  "Needs New Roof",
  "Needs Repairs",
  "Occupied",
  "Old / Damaged Carport",
  "Partially Renovated",
  "Squatter Occupied",
  "Tenant Occupied",
  "Under Construction",
  "Unlivable",
  "Vacant",
  "Warning Stickers on Door",
  "Water Damage",
];

// Type of Property - Main Types
const PROPERTY_TYPES = [
  "Single Family Home",
  "Condo",
  "Duplex",
  "Triplex",
  "Fourplex",
  "Townhouse",
  "Mobile Home",
  "Vacant Lot",
  "Others",
];

// Type of Property Tags
const PROPERTY_TYPE_TAGS = [
  "Agricultural Land",
  "Bungalow",
  "Commercial",
  "Commercial Lot",
  "Co-op",
  "Cottage",
  "Farm Land",
  "Infill Lot",
  "Manufactured Home",
  "Modular Home",
  "Ranch Land",
  "Residential Lot",
  "Timber Land",
  "Villa",
  "Waterfront Lot",
];

// Properties / Seller Issues
const SELLER_ISSUES = [
  "Abandoned",
  "Bankruptcy",
  "Behind Taxes",
  "Code Violations",
  "Condemned",
  "Death in the Family",
  "Deportation",
  "Divorce",
  "Downsizing",
  "Empty Property",
  "Eviction in Process",
  "Fire Damage",
  "Foreclosure",
  "Going to Jail / Incarceration",
  "Health Issues",
  "Hoarder Situation",
  "Hurricane or Flood Damage",
  "Job Loss",
  "Legal Issues",
  "Liens",
  "Medical Bills",
  "Missing Heirs",
  "Moving to Another City",
  "Moving to Another County",
  "Moving to Another State",
  "Need Cash Quickly",
  "Pending Lawsuit",
  "Pre-Foreclosure",
  "Probate / Inherited",
  "Property Needs Major Repairs",
  "Relocating",
  "Squatter Issues",
  "Tax Deed Sale",
  "Tax Lien",
  "Tenant Problems",
  "Title Issues",
  "Trust or Estate Issues",
  "Unsafe/Unlivable",
  "Vacant",
  "Water or Mold Damage",
];

// Probate Finds Tags
const PROBATE_FINDS = [
  "Break in Chain of Title",
  "Code Violations",
  "Court Approval Required",
  "Delinquent Taxes (1 Year)",
  "Delinquent Taxes (2 Years)",
  "Delinquent Taxes (3 Years)",
  "Delinquent Taxes (4+ Years)",
  "Estate Debts Exceed Value",
  "Everyone on Board",
  "Executor Lacks Authority to Sell",
  "Family Dispute",
  "Finished",
  "Heir Disagreements",
  "HOA Liens or Unpaid Fees",
  "House Abandoned",
  "Issues with Attorney",
  "Judgments or Lawsuits",
  "Minor Involved",
  "Missing or Unknown Heirs",
  "No Court-Appointed Executor",
  "Not Everyone on Board",
  "Out of Money",
  "Outstanding Mortgage",
  "Probate Not Completed",
  "Property Occupied Without Consent",
  "Tax Liens",
  "Title Issues",
  "Trust and Probate Overlap",
  "Unclear Ownership Interests",
  "Unfinished",
  "Unpaid Property Taxes",
  "Vacant or Abandoned Property",
  "Will Contested",
  "Heirs living on the property",
  "Heirs living on the property, does not want to sell",
  "Sellers Name with Est of",
  "Sellers Name with HE",
  "Sellers Name with REV TRUST",
  "Sellers Name with JTRS",
  "Sellers Name with ETAL",
];

// Family Relationships
const FAMILY_RELATIONSHIPS = [
  "Aunt",
  "Brother",
  "Brother-in-Law",
  "Cousin",
  "Daughter",
  "Father",
  "Father-in-Law",
  "Granddaughter",
  "Grandfather",
  "Grandmother",
  "Grandson",
  "Guardian",
  "Husband",
  "Mother",
  "Mother-in-Law",
  "Nephew",
  "Niece",
  "Sister",
  "Sister-in-Law",
  "Son",
  "Stepdaughter",
  "Stepfather",
  "Stepmother",
  "Stepson",
  "Trustee",
  "Uncle",
  "Wife",
];

// Records Check options
const RECORDS_CHECK = [
  "County Official Records",
  "Taxes",
  "Code Violation",
  "Liens",
  "Permits",
  "Clerk",
  "Google",
  "Obituary",
  "Affidavit of No Florida Estate Tax Due",
  "Additional Paper Work",
];

// Skiptracing options
const SKIPTRACING_OPTIONS = [
  "BeenVerified",
  "DealMachine",
  "Facebook",
  "Forewarn",
  "Resimpli",
  "Truepeoplesearch",
  "IDI",
  "Order Death Certificate $39",
];

// Outreach options
const OUTREACH_OPTIONS = [
  "Sent Emails",
  "Search Facebook",
  "Post Card",
  "Letters",
  "Door Knock",
];

// Deed Types
const DEED_TYPES = [
  "General Warranty Deed",
  "Gift Deed",
  "Bargain and Sale Deed",
  "Quit Claim Deed",
  "Special Warranty Deed",
  "Deed in Lieu of Foreclosure",
  "Transfer on Death Deed",
  "Life Estate Deed",
  "Trust Deed",
  "Tax Deed",
];

// Repair Types
const REPAIR_TYPES = [
  "Outdated",
  "Roof",
  "Kitchen",
  "Bath",
];

// Family Tree Entry Interface
interface FamilyMember {
  name: string;
  relationship: string;
  isRepresentative: boolean;
  isDeceased: boolean;
  isContacted: boolean;
  isOnBoard: boolean;
}

// Deed Entry Interface
interface DeedEntry {
  type: string;
  deedDate: string;
  amount: string;
  notes: string;
}

export function DeepSearchTabs({ propertyId }: DeepSearchTabsProps) {
  const utils = trpc.useUtils();
  const { data: deepSearch, isLoading } = trpc.properties.getDeepSearch.useQuery({ propertyId });
  const updateMutation = trpc.properties.updateDeepSearch.useMutation({
    onSuccess: () => {
      toast.success("Deep search updated successfully");
      utils.properties.getDeepSearch.invalidate({ propertyId });
      utils.properties.getById.invalidate({ id: propertyId });
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState("summary");

  // ===== OVERVIEW STATES =====
  // Property Condition
  const [propertyConditionRating, setPropertyConditionRating] = useState("");
  const [propertyConditionTags, setPropertyConditionTags] = useState<string[]>([]);
  
  // Type of Property
  const [propertyType, setPropertyType] = useState("");
  const [propertyTypeTags, setPropertyTypeTags] = useState<string[]>([]);
  
  // Seller Issues
  const [sellerIssues, setSellerIssues] = useState<string[]>([]);
  const [overviewNotes, setOverviewNotes] = useState("");
  
  // Probate Finds
  const [probateFinds, setProbateFinds] = useState<string[]>([]);
  const [probateNotes, setProbateNotes] = useState("");
  
  // Family Tree
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyTreeNotes, setFamilyTreeNotes] = useState("");

  // ===== FINANCIAL STATES =====
  const [zillowEstimate, setZillowEstimate] = useState("");
  const [dealMachineEstimate, setDealMachineEstimate] = useState("");
  const [ourEstimate, setOurEstimate] = useState("");
  const [estimateNotes, setEstimateNotes] = useState("");
  
  const [mlsStatus, setMlsStatus] = useState("");
  const [occupancy, setOccupancy] = useState("");
  const [annualRent, setAnnualRent] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [leaseType, setLeaseType] = useState("");
  
  // Tax fields
  const [tax2025, setTax2025] = useState("");
  const [tax2024, setTax2024] = useState("");
  const [tax2023, setTax2023] = useState("");
  const [tax2022, setTax2022] = useState("");
  const [tax2021, setTax2021] = useState("");
  const [tax2020, setTax2020] = useState("");
  
  // Mortgage fields
  const [hasMortgage, setHasMortgage] = useState(false);
  const [mortgageAmount, setMortgageAmount] = useState("");
  const [equityPercent, setEquityPercent] = useState("");
  const [mortgageNotes, setMortgageNotes] = useState("");
  
  // Repairs fields (updated)
  const [needsRepairs, setNeedsRepairs] = useState(false);
  const [repairTypes, setRepairTypes] = useState<string[]>([]);
  const [repairCost, setRepairCost] = useState("");
  const [repairNotes, setRepairNotes] = useState("");
  
  // Code Violations
  const [hasCodeViolation, setHasCodeViolation] = useState(false);
  const [codeViolationNotes, setCodeViolationNotes] = useState("");
  
  // Liens
  const [hasLiens, setHasLiens] = useState(false);
  const [liensNotes, setLiensNotes] = useState("");
  
  // Deed entries
  const [deedEntries, setDeedEntries] = useState<DeedEntry[]>([]);

  // ===== RESEARCH STATES =====
  const [recordsChecked, setRecordsChecked] = useState<string[]>([]);
  const [researchNotes, setResearchNotes] = useState("");
  
  // Skiptracing
  const [skiptracingDone, setSkiptracingDone] = useState<Record<string, string | null>>({});
  const [skiptracingNotes, setSkiptracingNotes] = useState("");
  
  // Outreach
  const [outreachDone, setOutreachDone] = useState<Record<string, string | null>>({});

  // Load data when deepSearch changes
  useEffect(() => {
    if (deepSearch) {
      // Overview
      try {
        const conditionData = deepSearch.propertyCondition ? JSON.parse(deepSearch.propertyCondition) : {};
        setPropertyConditionRating(conditionData.rating || "");
        setPropertyConditionTags(conditionData.tags || []);
      } catch {
        setPropertyConditionRating("");
        setPropertyConditionTags([]);
      }
      
      try {
        const typeData = deepSearch.propertyType ? JSON.parse(deepSearch.propertyType) : {};
        setPropertyType(typeData.type || "");
        setPropertyTypeTags(typeData.tags || []);
      } catch {
        setPropertyType("");
        setPropertyTypeTags([]);
      }
      
      try {
        setSellerIssues(deepSearch.issues ? JSON.parse(deepSearch.issues) : []);
      } catch {
        setSellerIssues([]);
      }
      
      setOverviewNotes(deepSearch.overviewNotes || "");
      
      try {
        setProbateFinds(deepSearch.probateFinds ? JSON.parse(deepSearch.probateFinds) : []);
      } catch {
        setProbateFinds([]);
      }
      
      setProbateNotes(deepSearch.probateNotes || "");
      
      try {
        setFamilyMembers(deepSearch.familyTree ? JSON.parse(deepSearch.familyTree) : []);
      } catch {
        setFamilyMembers([]);
      }
      
      setFamilyTreeNotes(deepSearch.familyTreeNotes || "");

      // Financial
      setZillowEstimate(deepSearch.zillowEstimate?.toString() || "");
      setDealMachineEstimate(deepSearch.dealMachineEstimate?.toString() || "");
      setOurEstimate(deepSearch.ourEstimate?.toString() || "");
      setEstimateNotes(deepSearch.estimateNotes || "");
      
      setMlsStatus(deepSearch.mlsStatus || "");
      setOccupancy(deepSearch.occupancy || "");
      setAnnualRent(deepSearch.annualRent?.toString() || "");
      setMonthlyRent(deepSearch.monthlyRent?.toString() || "");
      setLeaseType(deepSearch.leaseType || "");
      
      setTax2025(deepSearch.delinquentTax2025?.toString() || "");
      setTax2024(deepSearch.delinquentTax2024?.toString() || "");
      setTax2023(deepSearch.delinquentTax2023?.toString() || "");
      setTax2022(deepSearch.delinquentTax2022?.toString() || "");
      setTax2021(deepSearch.delinquentTax2021?.toString() || "");
      setTax2020(deepSearch.delinquentTax2020?.toString() || "");
      
      setHasMortgage(deepSearch.hasMortgage === 1);
      setMortgageAmount(deepSearch.mortgageAmount?.toString() || "");
      setEquityPercent(deepSearch.equityPercent?.toString() || "");
      setMortgageNotes(deepSearch.mortgageNotes || "");
      
      setNeedsRepairs(deepSearch.needsRepairs === 1);
      try {
        setRepairTypes(deepSearch.repairTypes ? JSON.parse(deepSearch.repairTypes) : []);
      } catch {
        setRepairTypes([]);
      }
      setRepairCost(deepSearch.estimatedRepairCost?.toString() || "");
      setRepairNotes(deepSearch.repairNotes || "");
      
      setHasCodeViolation(deepSearch.hasCodeViolation === 1);
      setCodeViolationNotes(deepSearch.codeViolationNotes || "");
      
      setHasLiens(deepSearch.hasLiens === 1);
      setLiensNotes(deepSearch.liensNotes || "");
      
      try {
        setDeedEntries(deepSearch.deedType ? JSON.parse(deepSearch.deedType) : []);
      } catch {
        setDeedEntries([]);
      }

      // Research
      try {
        setRecordsChecked(deepSearch.recordsChecked ? JSON.parse(deepSearch.recordsChecked) : []);
      } catch {
        setRecordsChecked([]);
      }
      
      setResearchNotes(deepSearch.recordsCheckedNotes || "");
      
      try {
        setSkiptracingDone(deepSearch.skiptracingDone ? JSON.parse(deepSearch.skiptracingDone) : {});
      } catch {
        setSkiptracingDone({});
      }
      
      setSkiptracingNotes(deepSearch.skiptracingNotes || "");
      
      try {
        setOutreachDone(deepSearch.outreachDone ? JSON.parse(deepSearch.outreachDone) : {});
      } catch {
        setOutreachDone({});
      }
    }
  }, [deepSearch]);

  // Calculate total tax
  const totalTax = useMemo(() => {
    const values = [tax2025, tax2024, tax2023, tax2022, tax2021, tax2020];
    return values.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }, [tax2025, tax2024, tax2023, tax2022, tax2021, tax2020]);

  // Calculate completion percentage
  const completionPercent = useMemo(() => {
    let filled = 0;
    let total = 15;
    
    if (propertyConditionRating) filled++;
    if (propertyType) filled++;
    if (sellerIssues.length > 0) filled++;
    if (mlsStatus) filled++;
    if (occupancy) filled++;
    if (recordsChecked.length > 0) filled++;
    if (Object.keys(skiptracingDone).length > 0) filled++;
    if (zillowEstimate || dealMachineEstimate || ourEstimate) filled++;
    if (probateFinds.length > 0) filled++;
    if (familyMembers.length > 0) filled++;
    if (deedEntries.length > 0) filled++;
    if (hasMortgage !== undefined) filled++;
    if (hasCodeViolation !== undefined) filled++;
    if (hasLiens !== undefined) filled++;
    if (needsRepairs !== undefined) filled++;
    
    return Math.round((filled / total) * 100);
  }, [propertyConditionRating, propertyType, sellerIssues, mlsStatus, occupancy, recordsChecked, skiptracingDone, zillowEstimate, dealMachineEstimate, ourEstimate, probateFinds, familyMembers, deedEntries, hasMortgage, hasCodeViolation, hasLiens, needsRepairs]);

  // Handle save
  const handleSave = () => {
    // Only include enum fields if they have valid values
    const validMlsStatuses = ["Listed", "Not Listed", "Fail", "Expired", "Sold", "Off Market"];
    const validOccupancies = ["Owner-Occupied", "Abandoned", "Partially Occupied", "Relatives", "Second Home", "Squatters", "Vacant", "Tenant-Occupied"];
    const validLeaseTypes = ["Annual", "Month to Month"];
    
    updateMutation.mutate({
      propertyId,
      // Overview
      propertyCondition: JSON.stringify({ rating: propertyConditionRating, tags: propertyConditionTags }),
      propertyType: JSON.stringify({ type: propertyType, tags: propertyTypeTags }),
      issues: JSON.stringify(sellerIssues),
      overviewNotes,
      probateFinds: JSON.stringify(probateFinds),
      probateNotes,
      familyTree: JSON.stringify(familyMembers),
      familyTreeNotes,
      // Financial
      zillowEstimate: zillowEstimate ? parseInt(zillowEstimate) : null,
      dealMachineEstimate: dealMachineEstimate ? parseInt(dealMachineEstimate) : null,
      ourEstimate: ourEstimate ? parseInt(ourEstimate) : null,
      estimateNotes,
      mlsStatus: validMlsStatuses.includes(mlsStatus) ? mlsStatus as "Off Market" | "Listed" | "Not Listed" | "Fail" | "Expired" | "Sold" : undefined,
      occupancy: validOccupancies.includes(occupancy) ? occupancy as "Owner-Occupied" | "Abandoned" | "Partially Occupied" | "Relatives" | "Second Home" | "Squatters" | "Vacant" | "Tenant-Occupied" : undefined,
      annualRent: annualRent ? parseInt(annualRent) : null,
      monthlyRent: monthlyRent ? parseInt(monthlyRent) : null,
      leaseType: validLeaseTypes.includes(leaseType) ? leaseType as "Annual" | "Month to Month" : undefined,
      delinquentTax2025: tax2025 ? parseInt(tax2025) : null,
      delinquentTax2024: tax2024 ? parseInt(tax2024) : null,
      delinquentTax2023: tax2023 ? parseInt(tax2023) : null,
      delinquentTax2022: tax2022 ? parseInt(tax2022) : null,
      delinquentTax2021: tax2021 ? parseInt(tax2021) : null,
      delinquentTax2020: tax2020 ? parseInt(tax2020) : null,
      hasMortgage: hasMortgage ? 1 : 0,
      mortgageAmount: mortgageAmount ? parseInt(mortgageAmount) : null,
      equityPercent: equityPercent ? parseInt(equityPercent) : null,
      mortgageNotes,
      needsRepairs: needsRepairs ? 1 : 0,
      repairTypes: JSON.stringify(repairTypes),
      estimatedRepairCost: repairCost ? parseInt(repairCost) : null,
      repairNotes,
      hasCodeViolation: hasCodeViolation ? 1 : 0,
      codeViolationNotes,
      hasLiens: hasLiens ? 1 : 0,
      liensNotes,
      deedType: JSON.stringify(deedEntries),
      // Research
      recordsChecked: JSON.stringify(recordsChecked),
      recordsCheckedNotes: researchNotes,
      skiptracingDone: JSON.stringify(skiptracingDone),
      skiptracingNotes,
      outreachDone: JSON.stringify(outreachDone),
    });
  };

  // Add family member
  const addFamilyMember = () => {
    setFamilyMembers([...familyMembers, {
      name: "",
      relationship: "",
      isRepresentative: false,
      isDeceased: false,
      isContacted: false,
      isOnBoard: false,
    }]);
  };

  // Remove family member
  const removeFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  // Update family member
  const updateFamilyMember = (index: number, field: keyof FamilyMember, value: any) => {
    const updated = [...familyMembers];
    updated[index] = { ...updated[index], [field]: value };
    setFamilyMembers(updated);
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Loading Deep Search data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lead Stage Navigation - Visual Progress */}
      <LeadStageNavigation 
        currentStage="deep_search" 
        isDead={false}
      />

      {/* Main Deep Search Card */}
      <Card className="shadow-xl border-0 overflow-hidden">
        {/* New Visual Header */}
        <DeepSearchHeader 
          completionPercent={completionPercent}
          leadTemperature="TBD"
        />

        <CardContent className="p-6 bg-white">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Improved Tab Navigation */}
            <TabsList className="grid w-full grid-cols-5 mb-6 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger 
                value="summary" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Summary</span>
              </TabsTrigger>
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="financial" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Financial</span>
              </TabsTrigger>
              <TabsTrigger 
                value="research" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Research</span>
              </TabsTrigger>
              <TabsTrigger 
                value="outreach" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden sm:inline">Outreach</span>
              </TabsTrigger>
            </TabsList>

          {/* ===== SUMMARY TAB ===== */}
          {activeTab === "summary" && (
            <TabsContent value="summary" className="mt-6">
              <LeadSummary propertyId={propertyId} />
            </TabsContent>
          )}

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === "overview" && (
            <TabsContent value="overview" className="space-y-8 mt-6">
              
              {/* Mini-Block 1A: Property Condition */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-orange-500" />
                  Property Condition
                </h3>
                
                {/* Rating Selection */}
                <div className="mb-4">
                  <Label className="text-sm font-semibold mb-2 block">Condition Rating</Label>
                  <div className="flex flex-wrap gap-3">
                    {PROPERTY_CONDITION_RATINGS.map((rating) => (
                      <button
                        key={rating.value}
                        type="button"
                        onClick={() => setPropertyConditionRating(rating.value)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          propertyConditionRating === rating.value
                            ? `${rating.color} text-white border-transparent`
                            : "bg-white border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {rating.value}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Condition Tags */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Condition Tags</Label>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded border">
                    {PROPERTY_CONDITION_TAGS.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cond-tag-${tag}`}
                          checked={propertyConditionTags.includes(tag)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPropertyConditionTags([...propertyConditionTags, tag]);
                            } else {
                              setPropertyConditionTags(propertyConditionTags.filter(t => t !== tag));
                            }
                          }}
                        />
                        <Label htmlFor={`cond-tag-${tag}`} className="text-xs cursor-pointer">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mini-Block 1B: Type of Property */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5 text-blue-500" />
                  Type of Property
                </h3>
                
                {/* Main Type Selection */}
                <div className="mb-4">
                  <Label className="text-sm font-semibold mb-2 block">Property Type</Label>
                  <div className="flex flex-wrap gap-3">
                    {PROPERTY_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPropertyType(type)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          propertyType === type
                            ? "bg-blue-500 text-white border-transparent"
                            : "bg-white border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Property Type Tags */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Additional Tags</Label>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded border">
                    {PROPERTY_TYPE_TAGS.map((tag) => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`type-tag-${tag}`}
                          checked={propertyTypeTags.includes(tag)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPropertyTypeTags([...propertyTypeTags, tag]);
                            } else {
                              setPropertyTypeTags(propertyTypeTags.filter(t => t !== tag));
                            }
                          }}
                        />
                        <Label htmlFor={`type-tag-${tag}`} className="text-xs cursor-pointer">
                          {tag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mini-Block 1C: Properties / Seller Issues */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Properties / Seller Issues
                </h3>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto p-2 bg-white rounded border">
                  {SELLER_ISSUES.map((issue) => (
                    <div key={issue} className="flex items-center space-x-2">
                      <Checkbox
                        id={`issue-${issue}`}
                        checked={sellerIssues.includes(issue)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSellerIssues([...sellerIssues, issue]);
                          } else {
                            setSellerIssues(sellerIssues.filter(i => i !== issue));
                          }
                        }}
                      />
                      <Label htmlFor={`issue-${issue}`} className="text-xs cursor-pointer">
                        {issue}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="overviewNotes" className="text-sm font-semibold">Overview Notes</Label>
                  <Textarea
                    id="overviewNotes"
                    placeholder="Add general notes about the property..."
                    value={overviewNotes}
                    onChange={(e) => setOverviewNotes(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Mini-Block 1D: Probate Finds */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-purple-500" />
                  Probate Finds
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-2 bg-white rounded border">
                  {PROBATE_FINDS.map((find) => (
                    <div key={find} className="flex items-center space-x-2">
                      <Checkbox
                        id={`probate-${find}`}
                        checked={probateFinds.includes(find)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setProbateFinds([...probateFinds, find]);
                          } else {
                            setProbateFinds(probateFinds.filter(f => f !== find));
                          }
                        }}
                      />
                      <Label htmlFor={`probate-${find}`} className="text-xs cursor-pointer">
                        {find}
                      </Label>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4">
                  <Label htmlFor="probateNotes" className="text-sm font-semibold">Probate Notes</Label>
                  <Textarea
                    id="probateNotes"
                    placeholder="Add probate-related notes..."
                    value={probateNotes}
                    onChange={(e) => setProbateNotes(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Family Tree */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-500" />
                    Family Tree
                  </h3>
                  <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>
                    <Plus className="h-4 w-4 mr-1" /> Add Member
                  </Button>
                </div>
                
                {familyMembers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No family members added yet. Click "Add Member" to start.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="p-2 text-left">Name</th>
                          <th className="p-2 text-left">Relationship</th>
                          <th className="p-2 text-center">Representative</th>
                          <th className="p-2 text-center">Deceased</th>
                          <th className="p-2 text-center">Contacted</th>
                          <th className="p-2 text-center">On Board</th>
                          <th className="p-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {familyMembers.map((member, index) => (
                          <tr key={index} className="border-b bg-white">
                            <td className="p-2">
                              <Input
                                value={member.name}
                                onChange={(e) => updateFamilyMember(index, "name", e.target.value)}
                                placeholder="Name"
                                className="h-8"
                              />
                            </td>
                            <td className="p-2">
                              <Select
                                value={member.relationship}
                                onValueChange={(value) => updateFamilyMember(index, "relationship", value)}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {FAMILY_RELATIONSHIPS.map((rel) => (
                                    <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={member.isRepresentative}
                                onCheckedChange={(checked) => updateFamilyMember(index, "isRepresentative", checked)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={member.isDeceased}
                                onCheckedChange={(checked) => updateFamilyMember(index, "isDeceased", checked)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={member.isContacted}
                                onCheckedChange={(checked) => updateFamilyMember(index, "isContacted", checked)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={member.isOnBoard}
                                onCheckedChange={(checked) => updateFamilyMember(index, "isOnBoard", checked)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFamilyMember(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="mt-4">
                  <Label htmlFor="familyTreeNotes" className="text-sm font-semibold">Family Tree Notes</Label>
                  <Textarea
                    id="familyTreeNotes"
                    placeholder="Add family tree notes..."
                    value={familyTreeNotes}
                    onChange={(e) => setFamilyTreeNotes(e.target.value)}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Overview Changes"}
              </Button>
            </TabsContent>
          )}

          {/* ===== FINANCIAL TAB ===== */}
          {activeTab === "financial" && (
            <TabsContent value="financial" className="space-y-6 mt-6">
              
              {/* Property Value Estimates */}
              <div className="border-2 border-green-200 rounded-lg p-6 bg-green-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Property Value Estimates
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zillowEstimate" className="text-sm font-semibold">Zillow Estimated</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="zillowEstimate"
                        type="text"
                        placeholder="0"
                        value={formatCurrency(zillowEstimate)}
                        onChange={(e) => setZillowEstimate(parseCurrency(e.target.value))}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dealMachineEstimate" className="text-sm font-semibold">DealMachine Estimated</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="dealMachineEstimate"
                        type="text"
                        placeholder="0"
                        value={formatCurrency(dealMachineEstimate)}
                        onChange={(e) => setDealMachineEstimate(parseCurrency(e.target.value))}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ourEstimate" className="text-sm font-semibold text-green-700">How Much WE THINK Worth</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="ourEstimate"
                        type="text"
                        placeholder="0"
                        value={formatCurrency(ourEstimate)}
                        onChange={(e) => setOurEstimate(parseCurrency(e.target.value))}
                        className="pl-7 border-green-400"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="estimateNotes" className="text-sm font-semibold">Estimate Notes</Label>
                  <Textarea
                    id="estimateNotes"
                    placeholder="Notes about property value..."
                    value={estimateNotes}
                    onChange={(e) => setEstimateNotes(e.target.value)}
                    rows={2}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* MLS Status and Occupancy */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mlsStatus" className="flex items-center gap-2 font-semibold">
                    <Home className="h-4 w-4" />
                    MLS Status
                  </Label>
                  <Select value={mlsStatus} onValueChange={setMlsStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select MLS status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Listed">Listed</SelectItem>
                      <SelectItem value="Not Listed">Not Listed</SelectItem>
                      <SelectItem value="Fail">Fail</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Sold">Sold</SelectItem>
                      <SelectItem value="Off Market">Off Market</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupancy" className="flex items-center gap-2 font-semibold">
                    <UsersIcon className="h-4 w-4" />
                    Occupancy
                  </Label>
                  <Select value={occupancy} onValueChange={setOccupancy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select occupancy..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Owner-Occupied">Owner-Occupied</SelectItem>
                      <SelectItem value="Abandoned">Abandoned</SelectItem>
                      <SelectItem value="Partially Occupied">Partially Occupied</SelectItem>
                      <SelectItem value="Relatives">Relatives</SelectItem>
                      <SelectItem value="Second Home">Second Home</SelectItem>
                      <SelectItem value="Squatters">Squatters</SelectItem>
                      <SelectItem value="Vacant">Vacant</SelectItem>
                      <SelectItem value="Tenant-Occupied">Tenant-Occupied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rent Information */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-semibold">
                  <DollarSign className="h-4 w-4" />
                  Rent Information
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="monthlyRent" className="text-xs">Monthly Rent</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="monthlyRent"
                        type="text"
                        placeholder="0"
                        value={formatCurrency(monthlyRent)}
                        onChange={(e) => setMonthlyRent(parseCurrency(e.target.value))}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="annualRent" className="text-xs">Annual Rent</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        id="annualRent"
                        type="text"
                        placeholder="0"
                        value={formatCurrency(annualRent)}
                        onChange={(e) => setAnnualRent(parseCurrency(e.target.value))}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="leaseType" className="text-xs">Lease Type</Label>
                    <Select value={leaseType} onValueChange={setLeaseType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Annual">Annual</SelectItem>
                        <SelectItem value="Month to Month">Month to Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Delinquent Taxes */}
              <div className="space-y-4 p-4 border rounded bg-red-50">
                <Label className="flex items-center gap-2 font-semibold text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  Delinquent Taxes
                </Label>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { year: "2025", value: tax2025, setter: setTax2025 },
                    { year: "2024", value: tax2024, setter: setTax2024 },
                    { year: "2023", value: tax2023, setter: setTax2023 },
                    { year: "2022", value: tax2022, setter: setTax2022 },
                    { year: "2021", value: tax2021, setter: setTax2021 },
                    { year: "2020", value: tax2020, setter: setTax2020 },
                  ].map(({ year, value, setter }) => (
                    <div key={year} className="space-y-1">
                      <Label className="text-xs">{year}</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                        <Input
                          type="text"
                          placeholder="0"
                          value={formatCurrency(value)}
                          onChange={(e) => setter(parseCurrency(e.target.value))}
                          className="pl-5 h-8 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right font-bold text-red-800">
                  Total Delinquent: ${totalTax.toLocaleString()}
                </div>
              </div>

              {/* Mortgage */}
              <div className="space-y-4 p-4 border rounded">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasMortgage"
                    checked={hasMortgage}
                    onCheckedChange={(checked) => setHasMortgage(checked as boolean)}
                  />
                  <Label htmlFor="hasMortgage" className="cursor-pointer font-semibold">
                    Has Mortgage
                  </Label>
                </div>
                {hasMortgage && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="mortgageAmount">Mortgage Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <Input
                          id="mortgageAmount"
                          type="text"
                          placeholder="0"
                          value={formatCurrency(mortgageAmount)}
                          onChange={(e) => setMortgageAmount(parseCurrency(e.target.value))}
                          className="pl-7"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equityPercent">Equity %</Label>
                      <Input
                        id="equityPercent"
                        type="number"
                        placeholder="0%"
                        value={equityPercent}
                        onChange={(e) => setEquityPercent(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="mortgageNotes">Mortgage Notes</Label>
                      <Textarea
                        id="mortgageNotes"
                        placeholder="Add notes..."
                        value={mortgageNotes}
                        onChange={(e) => setMortgageNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Need Repairs - UPDATED */}
              <div className="space-y-4 p-4 border rounded bg-orange-50">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="needsRepairs"
                    checked={needsRepairs}
                    onCheckedChange={(checked) => setNeedsRepairs(checked as boolean)}
                  />
                  <Label htmlFor="needsRepairs" className="cursor-pointer font-semibold">
                    Needs Repairs
                  </Label>
                </div>
                {needsRepairs && (
                  <div className="space-y-4 pl-6">
                    <div className="flex flex-wrap gap-4">
                      {REPAIR_TYPES.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`repair-${type}`}
                            checked={repairTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setRepairTypes([...repairTypes, type]);
                              } else {
                                setRepairTypes(repairTypes.filter(t => t !== type));
                              }
                            }}
                          />
                          <Label htmlFor={`repair-${type}`} className="cursor-pointer">
                            {type}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="repairCost">Estimated Repair Cost</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <Input
                            id="repairCost"
                            type="text"
                            placeholder="0"
                            value={formatCurrency(repairCost)}
                            onChange={(e) => setRepairCost(parseCurrency(e.target.value))}
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="repairNotes">Repair Notes</Label>
                        <Input
                          id="repairNotes"
                          placeholder="Notes..."
                          value={repairNotes}
                          onChange={(e) => setRepairNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Code Violation */}
              <div className="space-y-4 p-4 border rounded">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasCodeViolation"
                    checked={hasCodeViolation}
                    onCheckedChange={(checked) => setHasCodeViolation(checked as boolean)}
                  />
                  <Label htmlFor="hasCodeViolation" className="cursor-pointer font-semibold">
                    Has Code Violation
                  </Label>
                </div>
                {hasCodeViolation && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="codeViolationNotes">Code Violation Notes</Label>
                    <Textarea
                      id="codeViolationNotes"
                      placeholder="Add notes..."
                      value={codeViolationNotes}
                      onChange={(e) => setCodeViolationNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Liens */}
              <div className="space-y-4 p-4 border rounded">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasLiens"
                    checked={hasLiens}
                    onCheckedChange={(checked) => setHasLiens(checked as boolean)}
                  />
                  <Label htmlFor="hasLiens" className="cursor-pointer font-semibold">
                    Has Liens
                  </Label>
                </div>
                {hasLiens && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="liensNotes">Liens Notes</Label>
                    <Textarea
                      id="liensNotes"
                      placeholder="Add notes..."
                      value={liensNotes}
                      onChange={(e) => setLiensNotes(e.target.value)}
                      rows={2}
                    />
                  </div>
                )}
              </div>

              {/* Deed Type */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 font-semibold">
                    <Scale className="h-4 w-4" />
                    Deed Type
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeedEntries([...deedEntries, { type: "", deedDate: "", amount: "", notes: "" }]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Deed Entry
                  </Button>
                </div>
                
                {deedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deed entries yet. Click "+ Add Deed Entry" to add one.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold">TYPE DEED</th>
                          <th className="text-left p-3 text-xs font-semibold">DEED DATE</th>
                          <th className="text-left p-3 text-xs font-semibold">AMOUNT$</th>
                          <th className="text-left p-3 text-xs font-semibold">NOTES</th>
                          <th className="text-center p-3 text-xs font-semibold w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {deedEntries.map((entry, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Select
                                value={entry.type}
                                onValueChange={(value) => {
                                  const updated = [...deedEntries];
                                  updated[index].type = value;
                                  setDeedEntries(updated);
                                }}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {DEED_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input
                                type="date"
                                className="h-9"
                                value={entry.deedDate}
                                onChange={(e) => {
                                  const updated = [...deedEntries];
                                  updated[index].deedDate = e.target.value;
                                  setDeedEntries(updated);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="text"
                                className="h-9"
                                placeholder="$0"
                                value={formatCurrency(entry.amount)}
                                onChange={(e) => {
                                  const updated = [...deedEntries];
                                  updated[index].amount = parseCurrency(e.target.value);
                                  setDeedEntries(updated);
                                }}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                className="h-9"
                                placeholder="Notes..."
                                value={entry.notes}
                                onChange={(e) => {
                                  const updated = [...deedEntries];
                                  updated[index].notes = e.target.value;
                                  setDeedEntries(updated);
                                }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeedEntries(deedEntries.filter((_, i) => i !== index));
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <Button onClick={handleSave} className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Financial Changes"}
              </Button>
            </TabsContent>
          )}

          {/* ===== RESEARCH TAB ===== */}
          {activeTab === "research" && (
            <TabsContent value="research" className="space-y-6 mt-6">
              
              {/* Records Checked */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Records Checked
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {RECORDS_CHECK.map((record) => (
                    <div key={record} className="flex items-center space-x-2 p-2 bg-white rounded border">
                      <Checkbox
                        id={`record-${record}`}
                        checked={recordsChecked.includes(record)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setRecordsChecked([...recordsChecked, record]);
                          } else {
                            setRecordsChecked(recordsChecked.filter(r => r !== record));
                          }
                        }}
                      />
                      <Label htmlFor={`record-${record}`} className="cursor-pointer text-sm">
                        {record}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Label htmlFor="researchNotes" className="text-sm font-semibold">Research Notes</Label>
                  <Textarea
                    id="researchNotes"
                    placeholder="Add research notes..."
                    value={researchNotes}
                    onChange={(e) => setResearchNotes(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              {/* SkipTrace */}
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Search className="h-5 w-5 text-purple-500" />
                  SkipTrace
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {SKIPTRACING_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2 p-2 bg-white rounded border">
                      <Checkbox
                        id={`skip-${option}`}
                        checked={!!skiptracingDone[option]}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSkiptracingDone({ ...skiptracingDone, [option]: new Date().toISOString().split('T')[0] });
                          } else {
                            const updated = { ...skiptracingDone };
                            delete updated[option];
                            setSkiptracingDone(updated);
                          }
                        }}
                      />
                      <Label htmlFor={`skip-${option}`} className="cursor-pointer text-sm">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Label htmlFor="skiptracingNotes" className="text-sm font-semibold">SkipTrace Notes</Label>
                  <Textarea
                    id="skiptracingNotes"
                    placeholder="Add skiptracing notes..."
                    value={skiptracingNotes}
                    onChange={(e) => setSkiptracingNotes(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
              </div>

              <Button onClick={handleSave} className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Research Changes"}
              </Button>
            </TabsContent>
          )}

          {/* ===== OUTREACH TAB ===== */}
          {activeTab === "outreach" && (
            <TabsContent value="outreach" className="space-y-6 mt-6">
              <SkiptracingTable propertyId={propertyId} />
              <OutreachTable propertyId={propertyId} />
            </TabsContent>
          )}

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

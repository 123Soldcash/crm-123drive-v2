import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MergeLeadsDialog } from "./MergeLeadsDialog";

interface AIMergeSuggestionCardProps {
  suggestion: {
    leads: Array<{
      id: number;
      addressLine1: string | null;
      city: string | null;
      state: string | null;
      zipcode: string | null;
      owner1Name: string | null;
      leadTemperature: string | null;
      deskStatus: string | null;
      createdAt: Date;
      updatedAt: Date;
      contactsCount: number;
      notesCount: number;
      tasksCount: number;
      photosCount: number;
      assignedAgentsCount: number;
    }>;
    aiSuggestion: {
      overallScore: number;
      addressSimilarity: number;
      ownerNameSimilarity: number;
      dataCompletenessScore: number;
      leadQualityScore: number;
      riskScore: number;
      confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
      reasoning: string[];
      suggestedPrimary: number;
    };
  };
  onMergeComplete?: () => void;
}

export function AIMergeSuggestionCard({ suggestion, onMergeComplete }: AIMergeSuggestionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  
  const { aiSuggestion, leads } = suggestion;
  const primaryLead = leads.find(l => l.id === aiSuggestion.suggestedPrimary);
  const secondaryLeads = leads.filter(l => l.id !== aiSuggestion.suggestedPrimary);
  
  // Confidence badge styling
  const getConfidenceBadge = () => {
    switch (aiSuggestion.confidenceLevel) {
      case "HIGH":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
            <Sparkles className="w-3 h-3 mr-1" />
            High Confidence {aiSuggestion.overallScore}%
          </Badge>
        );
      case "MEDIUM":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20">
            <TrendingUp className="w-3 h-3 mr-1" />
            Medium Confidence {aiSuggestion.overallScore}%
          </Badge>
        );
      case "LOW":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Low Confidence {aiSuggestion.overallScore}%
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Very Low {aiSuggestion.overallScore}%
          </Badge>
        );
    }
  };
  
  const handleAcceptSuggestion = () => {
    setShowMergeDialog(true);
  };
  
  return (
    <>
      <Card className="p-4 border-l-4 border-l-purple-500">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-lg">AI Merge Suggestion</h3>
          </div>
          {getConfidenceBadge()}
        </div>
        
        {/* Primary Lead (Blue highlight) */}
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-blue-500 text-white">Suggested Primary</Badge>
            <span className="text-sm text-muted-foreground">
              ID: {primaryLead?.id}
            </span>
          </div>
          <p className="font-medium text-sm">
            {primaryLead?.addressLine1}, {primaryLead?.city}, {primaryLead?.state} {primaryLead?.zipcode}
          </p>
          <p className="text-sm text-muted-foreground">
            Owner: {primaryLead?.owner1Name || "Unknown"}
          </p>
          <div className="flex gap-2 mt-2 text-xs">
            <Badge variant="outline">{primaryLead?.contactsCount} contacts</Badge>
            <Badge variant="outline">{primaryLead?.notesCount} notes</Badge>
            <Badge variant="outline">{primaryLead?.tasksCount} tasks</Badge>
          </div>
        </div>
        
        {/* Secondary Leads */}
        {secondaryLeads.map((lead) => (
          <div key={lead.id} className="mb-2 p-3 bg-muted/50 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">Will Merge Into Primary</Badge>
              <span className="text-sm text-muted-foreground">
                ID: {lead.id}
              </span>
            </div>
            <p className="font-medium text-sm">
              {lead.addressLine1}, {lead.city}, {lead.state} {lead.zipcode}
            </p>
            <p className="text-sm text-muted-foreground">
              Owner: {lead.owner1Name || "Unknown"}
            </p>
            <div className="flex gap-2 mt-2 text-xs">
              <Badge variant="outline">{lead.contactsCount} contacts</Badge>
              <Badge variant="outline">{lead.notesCount} notes</Badge>
              <Badge variant="outline">{lead.tasksCount} tasks</Badge>
            </div>
          </div>
        ))}
        
        {/* AI Reasoning */}
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full justify-between"
          >
            <span className="text-sm font-medium">AI Analysis & Reasoning</span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          
          {showDetails && (
            <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-2">
              {/* Score Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="text-muted-foreground">Address Match:</span>
                  <span className="ml-2 font-medium">{aiSuggestion.addressSimilarity}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Owner Match:</span>
                  <span className="ml-2 font-medium">{aiSuggestion.ownerNameSimilarity}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data Quality:</span>
                  <span className="ml-2 font-medium">{aiSuggestion.dataCompletenessScore}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Risk Level:</span>
                  <span className="ml-2 font-medium">{aiSuggestion.riskScore}%</span>
                </div>
              </div>
              
              {/* Reasoning Points */}
              <div className="space-y-1">
                {aiSuggestion.reasoning.map((reason, idx) => (
                  <div key={idx} className="text-sm">
                    {reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={handleAcceptSuggestion}
            className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            disabled={aiSuggestion.confidenceLevel === "VERY_LOW"}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Accept AI Suggestion
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/properties/${primaryLead?.id}`, "_blank")}
          >
            View Primary
          </Button>
        </div>
        
        {aiSuggestion.confidenceLevel === "VERY_LOW" && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            ⚠️ Confidence too low for auto-merge. Manual review recommended.
          </p>
        )}
      </Card>
      
      {showMergeDialog && primaryLead && secondaryLeads[0] && (
        <MergeLeadsDialog
          open={showMergeDialog}
          onOpenChange={setShowMergeDialog}
          primaryLeadId={primaryLead.id}
          secondaryLeadId={secondaryLeads[0].id}
          primaryLeadAddress={`${primaryLead.addressLine1}, ${primaryLead.city}, ${primaryLead.state} ${primaryLead.zipcode}`}
          secondaryLeadAddress={`${secondaryLeads[0].addressLine1}, ${secondaryLeads[0].city}, ${secondaryLeads[0].state} ${secondaryLeads[0].zipcode}`}
          primaryLeadOwner={primaryLead.owner1Name || "Unknown"}
          secondaryLeadOwner={secondaryLeads[0].owner1Name || "Unknown"}
          onMergeComplete={() => {
            setShowMergeDialog(false);
            onMergeComplete?.();
          }}
        />
      )}
    </>
  );
}

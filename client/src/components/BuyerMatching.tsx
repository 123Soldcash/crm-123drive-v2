import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Phone, Building, ExternalLink } from "lucide-react";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BuyerMatchingProps {
  propertyId: number;
}

export default function BuyerMatching({ propertyId }: BuyerMatchingProps) {
  const [isOpen, setIsOpen] = useState(true);
  
  const { data: matches, isLoading } = trpc.buyers.getMatches.useQuery({ propertyId });

  if (isLoading) {
    return (
      <div className="h-20 flex items-center justify-center text-muted-foreground animate-pulse bg-slate-50 rounded-lg border border-dashed">
        Finding matching buyers...
      </div>
    );
  }

  return (
    <CollapsibleSection
      title="Potential Cash Buyers"
      icon={Users}
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      accentColor="purple"
      badge={matches && matches.length > 0 ? (
        <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 ml-1">
          {matches.length}
        </Badge>
      ) : null}
      action={
        <Button 
          variant="outline" 
          size="sm"
          className="h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
          onClick={() => window.location.href = '/buyers'}
        >
          Manage List
        </Button>
      }
    >
      {!matches || matches.length === 0 ? (
        <div className="py-8 text-center">
          <Users className="h-10 w-10 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No matching buyers found for this property's criteria.</p>
        </div>
      ) : (
        <div className="rounded-md border border-slate-100 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="h-9 text-xs font-semibold text-slate-600">Name</TableHead>
                <TableHead className="h-9 text-xs font-semibold text-slate-600">Company</TableHead>
                <TableHead className="h-9 text-xs font-semibold text-slate-600">Contact</TableHead>
                <TableHead className="h-9 text-right text-xs font-semibold text-slate-600">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((buyer) => (
                <TableRow key={buyer.id} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="py-2 font-medium text-sm">{buyer.name}</TableCell>
                  <TableCell className="py-2">
                    {buyer.company ? (
                      <div className="flex items-center text-xs text-slate-600">
                        <Building className="mr-1.5 h-3 w-3 text-slate-400" />
                        {buyer.company}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs italic">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center text-[11px] text-slate-500">
                        <Mail className="mr-1 h-2.5 w-2.5" /> {buyer.email}
                      </div>
                      {buyer.phone && (
                        <div className="flex items-center text-[11px] text-slate-500">
                          <Phone className="mr-1 h-2.5 w-2.5" /> {buyer.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                      onClick={() => window.location.href = `/buyers/${buyer.id}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CollapsibleSection>
  );
}

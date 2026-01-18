import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Phone, Building, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
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
  const [isVisible, setIsVisible] = useState(true);
  
  const { data: matches, isLoading } = trpc.buyers.getMatches.useQuery({ propertyId });

  if (isLoading) {
    return (
      <Card className="border-purple-200 shadow-sm">
        <CardContent className="p-6 text-center text-muted-foreground">
          Finding matching buyers...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-purple-50/50 py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-purple-900 flex items-center gap-2">
          <Users className="h-5 w-5" /> Potential Cash Buyers
          {matches && matches.length > 0 && (
            <Badge className="bg-purple-600 ml-2">{matches.length} Matches</Badge>
          )}
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsVisible(!isVisible)}
          className="text-purple-700 hover:bg-purple-100"
        >
          {isVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="ml-2">{isVisible ? "Hide" : "Show"}</span>
        </Button>
      </CardHeader>
      
      {isVisible && (
        <CardContent className="p-0">
          {!matches || matches.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-purple-200 mx-auto mb-3" />
              <p className="text-muted-foreground">No matching buyers found for this property's criteria.</p>
              <Button 
                variant="outline" 
                className="mt-4 border-purple-200 text-purple-700 hover:bg-purple-50"
                onClick={() => window.location.href = '/buyers'}
              >
                Manage Buyer List
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-purple-50/30">
                  <TableHead className="text-purple-900">Name</TableHead>
                  <TableHead className="text-purple-900">Company</TableHead>
                  <TableHead className="text-purple-900">Contact</TableHead>
                  <TableHead className="text-right text-purple-900">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((buyer) => (
                  <TableRow key={buyer.id} className="hover:bg-purple-50/20">
                    <TableCell className="font-medium">{buyer.name}</TableCell>
                    <TableCell>
                      {buyer.company ? (
                        <div className="flex items-center text-sm">
                          <Building className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                          {buyer.company}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Mail className="mr-1 h-3 w-3" /> {buyer.email}
                        </div>
                        {buyer.phone && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Phone className="mr-1 h-3 w-3" /> {buyer.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-purple-600 hover:text-purple-800 hover:bg-purple-100"
                        onClick={() => window.location.href = `/buyers/${buyer.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      )}
    </Card>
  );
}

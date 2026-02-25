import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function BulkAgentAssignment() {
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [filters, setFilters] = useState({
    leadTemperature: '',
    deskName: '',
    status: '',
    unassignedOnly: false,
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  // Get agents list
  const { data: agents } = trpc.agents.list.useQuery();

  // Get preview of properties that will be assigned
  const { data: propertiesPreview, isLoading: isLoadingPreview } = trpc.properties.listFiltered.useQuery(
    {
      leadTemperature: filters.leadTemperature || undefined,
      deskName: filters.deskName || undefined,
      status: filters.status || undefined,
      unassignedOnly: filters.unassignedOnly,
    },
    { enabled: Object.values(filters).some(v => v !== '' && v !== false) }
  );

  // Bulk assign mutation
  const bulkAssignMutation = trpc.properties.bulkAssignAgent.useMutation({
    onSuccess: (result) => {
      toast.success(`Assigned ${result.count} properties to the agent`);
      setShowConfirm(false);
      setSelectedAgent('');
      setFilters({ leadTemperature: '', deskName: '', status: '', unassignedOnly: false });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleBulkAssign = () => {
    if (!selectedAgent) {
      toast.error('Please select an agent');
      return;
    }

    if (!previewCount) {
      toast.error('No properties match the selected filters');
      return;
    }

    setShowConfirm(true);
  };

  const confirmAssignment = () => {
    bulkAssignMutation.mutate({
      agentId: parseInt(selectedAgent),
      filters: {
        leadTemperature: filters.leadTemperature || undefined,
        deskName: filters.deskName || undefined,
        status: filters.status || undefined,
        unassignedOnly: filters.unassignedOnly,
      },
    });
  };

  // Update preview count
  if (propertiesPreview && previewCount !== propertiesPreview.length) {
    setPreviewCount(propertiesPreview.length);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Agent Assignment</h1>
        <p className="text-muted-foreground mt-2">Assign multiple properties to an agent based on filters</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Select criteria to filter properties</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Lead Temperature Filter */}
            <div className="space-y-2">
              <Label>Lead Temperature</Label>
              <Select value={filters.leadTemperature || 'all'} onValueChange={(value) => handleFilterChange('leadTemperature', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All temperatures" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All temperatures</SelectItem>
                  <SelectItem value="HOT">🔥 HOT</SelectItem>
                  <SelectItem value="WARM">🌡️ WARM</SelectItem>
                  <SelectItem value="COLD">❄️ COLD</SelectItem>
                  <SelectItem value="DEAD">💀 DEAD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Desk Filter */}
            <div className="space-y-2">
              <Label>Desk</Label>
              <Select value={filters.deskName || 'all'} onValueChange={(value) => handleFilterChange('deskName', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All desks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All desks</SelectItem>
                  <SelectItem value="DESK_CHRIS">Desk Chris</SelectItem>
                  <SelectItem value="DESK_1-5">Desk 1-5</SelectItem>
                  <SelectItem value="BIN">BIN</SelectItem>
                  <SelectItem value="ARCHIVED">ARCHIVED</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status || 'all'} onValueChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Unassigned Only Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="unassigned"
                checked={filters.unassignedOnly}
                onCheckedChange={(checked) => handleFilterChange('unassignedOnly', checked === true)}
              />
              <Label htmlFor="unassigned" className="cursor-pointer">
                Unassigned properties only
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Agent Selection & Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Agent & Preview</CardTitle>
            <CardDescription>Select agent and preview properties</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agent Selection */}
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Properties to Assign</Label>
              <div className="p-4 bg-muted rounded-lg">
                {isLoadingPreview ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <p className="text-2xl font-bold">
                    {previewCount} properties
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleBulkAssign}
                disabled={!selectedAgent || previewCount === 0 || bulkAssignMutation.isPending}
                className="flex-1"
              >
                {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign Properties'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Properties Preview List */}
      {propertiesPreview && propertiesPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Properties Preview</CardTitle>
            <CardDescription>These properties will be assigned to {agents?.find(a => a.id === parseInt(selectedAgent))?.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {propertiesPreview.map((prop) => (
                <div key={prop.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{prop.addressLine1}</p>
                    <p className="text-sm text-muted-foreground">{prop.city}, {prop.state} {prop.zipcode}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-muted rounded text-sm">{prop.leadTemperature}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to assign {previewCount} properties to {agents?.find(a => a.id === parseInt(selectedAgent))?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-4 rounded-lg my-4">
            <p className="text-sm font-medium">Summary:</p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>Agent: {agents?.find(a => a.id === parseInt(selectedAgent))?.name}</li>
              <li>Properties: {previewCount}</li>
              {filters.leadTemperature && <li>Temperature: {filters.leadTemperature}</li>}
              {filters.deskName && <li>Desk: {filters.deskName}</li>}
              {filters.status && <li>Status: {filters.status}</li>}
            </ul>
          </div>
          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAssignment}>
              Confirm Assignment
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

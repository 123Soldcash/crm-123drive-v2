import { useState, useMemo, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Users, ArrowRightLeft, Filter, Eye, UserCheck, Building2 } from 'lucide-react';

const DESK_OPTIONS = [
  { value: "NEW_LEAD", label: "New Lead", emoji: "🆕" },
  { value: "DESK_CHRIS", label: "Chris", emoji: "🏀" },
  { value: "DESK_DEEP_SEARCH", label: "Deep Search", emoji: "🔍" },
  { value: "DESK_1", label: "Manager", emoji: "🟦" },
  { value: "DESK_2", label: "Edsel", emoji: "🟩" },
  { value: "DESK_3", label: "Zach", emoji: "🟧" },
  { value: "DESK_4", label: "Rodolfo", emoji: "🔵" },
  { value: "DESK_5", label: "Lucas", emoji: "🟨" },
  { value: "BIN", label: "BIN", emoji: "🗑️" },
  { value: "ARCHIVED", label: "Archived", emoji: "⬛" },
];

const TEMPERATURE_OPTIONS = [
  { value: "SUPER HOT", label: "SUPER HOT", emoji: "🔥🔥" },
  { value: "HOT", label: "HOT", emoji: "🔥" },
  { value: "WARM", label: "WARM", emoji: "🌡️" },
  { value: "COLD", label: "COLD", emoji: "❄️" },
  { value: "DEAD", label: "DEAD", emoji: "💀" },
];

type ActionMode = 'assign_agent' | 'change_desk' | 'both';

export default function BulkAgentAssignment() {
  const [actionMode, setActionMode] = useState<ActionMode>('assign_agent');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [targetDesk, setTargetDesk] = useState<string>('');
  const [filters, setFilters] = useState({
    leadTemperature: '',
    deskName: '',
    status: '',
    unassignedOnly: false,
  });
  const [showConfirm, setShowConfirm] = useState(false);

  // Get ALL users (agents + admins)
  const { data: allUsers } = trpc.agents.listAll.useQuery();

  // Get preview of properties that will be affected
  const hasActiveFilter = Object.values(filters).some(v => v !== '' && v !== false);
  const { data: propertiesPreview, isLoading: isLoadingPreview } = trpc.properties.listFiltered.useQuery(
    {
      leadTemperature: filters.leadTemperature || undefined,
      deskName: filters.deskName || undefined,
      status: filters.status || undefined,
      unassignedOnly: filters.unassignedOnly,
    },
    { enabled: hasActiveFilter }
  );

  const previewCount = propertiesPreview?.length ?? 0;

  // Bulk assign mutation
  const bulkAssignMutation = trpc.properties.bulkAssignAgent.useMutation({
    onSuccess: (result) => {
      toast.success(`Assigned ${result.count} properties to the selected user`);
      setShowConfirm(false);
      if (actionMode === 'assign_agent') {
        setSelectedUser('');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Bulk update desk mutation
  const bulkUpdateDeskMutation = trpc.properties.bulkUpdateDesk.useMutation({
    onSuccess: (result) => {
      toast.success(`Moved ${result.count} properties to the selected desk`);
      setShowConfirm(false);
      if (actionMode === 'change_desk') {
        setTargetDesk('');
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFilterChange = (key: string, value: string | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExecute = () => {
    if (actionMode === 'assign_agent' && !selectedUser) {
      toast.error('Please select a user to assign');
      return;
    }
    if (actionMode === 'change_desk' && !targetDesk) {
      toast.error('Please select a target desk');
      return;
    }
    if (actionMode === 'both' && (!selectedUser || !targetDesk)) {
      toast.error('Please select both a user and a target desk');
      return;
    }
    if (!previewCount) {
      toast.error('No properties match the selected filters');
      return;
    }
    setShowConfirm(true);
  };

  const confirmAction = async () => {
    const filterPayload = {
      leadTemperature: filters.leadTemperature || undefined,
      deskName: filters.deskName || undefined,
      status: filters.status || undefined,
      unassignedOnly: filters.unassignedOnly,
    };

    try {
      if (actionMode === 'assign_agent' || actionMode === 'both') {
        await bulkAssignMutation.mutateAsync({
          agentId: parseInt(selectedUser),
          filters: filterPayload,
        });
      }
      if (actionMode === 'change_desk' || actionMode === 'both') {
        await bulkUpdateDeskMutation.mutateAsync({
          targetDesk,
          filters: filterPayload,
        });
      }
      if (actionMode === 'both') {
        toast.success('Both operations completed successfully');
      }
      setShowConfirm(false);
    } catch {
      // Error handled by individual mutation onError
    }
  };

  const isPending = bulkAssignMutation.isPending || bulkUpdateDeskMutation.isPending;

  const selectedUserName = allUsers?.find(u => u.id === parseInt(selectedUser))?.name || '';
  const selectedDeskLabel = DESK_OPTIONS.find(d => d.value === targetDesk)?.label || '';
  const sourceDeskLabel = DESK_OPTIONS.find(d => d.value === filters.deskName)?.label || '';

  const canExecute = useMemo(() => {
    if (!hasActiveFilter || previewCount === 0) return false;
    if (actionMode === 'assign_agent') return !!selectedUser;
    if (actionMode === 'change_desk') return !!targetDesk;
    if (actionMode === 'both') return !!selectedUser && !!targetDesk;
    return false;
  }, [actionMode, selectedUser, targetDesk, hasActiveFilter, previewCount]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-600" />
          Bulk Assignment & Desk Transfer
        </h1>
        <p className="text-muted-foreground mt-2">
          Assign users and/or transfer properties between desks in bulk based on filters
        </p>
      </div>

      {/* Action Mode Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Action Type</CardTitle>
          <CardDescription>Choose what you want to do with the filtered properties</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => setActionMode('assign_agent')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                actionMode === 'assign_agent'
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <UserCheck className={`h-5 w-5 mb-2 ${actionMode === 'assign_agent' ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="font-semibold">Assign User</p>
              <p className="text-xs text-muted-foreground mt-1">Assign a user to filtered properties</p>
            </button>
            <button
              onClick={() => setActionMode('change_desk')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                actionMode === 'change_desk'
                  ? 'border-green-500 bg-green-50 text-green-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Building2 className={`h-5 w-5 mb-2 ${actionMode === 'change_desk' ? 'text-green-600' : 'text-gray-400'}`} />
              <p className="font-semibold">Change Desk</p>
              <p className="text-xs text-muted-foreground mt-1">Move properties to a different desk</p>
            </button>
            <button
              onClick={() => setActionMode('both')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                actionMode === 'both'
                  ? 'border-purple-500 bg-purple-50 text-purple-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <ArrowRightLeft className={`h-5 w-5 mb-2 ${actionMode === 'both' ? 'text-purple-600' : 'text-gray-400'}`} />
              <p className="font-semibold">Both</p>
              <p className="text-xs text-muted-foreground mt-1">Assign user AND change desk together</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <CardDescription>Select criteria to filter which properties will be affected</CardDescription>
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
                  {TEMPERATURE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Source Desk Filter */}
            <div className="space-y-2">
              <Label>Source Desk (current desk)</Label>
              <Select value={filters.deskName || 'all'} onValueChange={(value) => handleFilterChange('deskName', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All desks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All desks</SelectItem>
                  {DESK_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </SelectItem>
                  ))}
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

        {/* Target Selection & Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Target & Preview
            </CardTitle>
            <CardDescription>Select target and review affected properties</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Selection (for assign_agent and both modes) */}
            {(actionMode === 'assign_agent' || actionMode === 'both') && (
              <div className="space-y-2">
                <Label>Assign to User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers?.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        <span className="flex items-center gap-2">
                          {user.name}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Target Desk Selection (for change_desk and both modes) */}
            {(actionMode === 'change_desk' || actionMode === 'both') && (
              <div className="space-y-2">
                <Label>Move to Desk</Label>
                <Select value={targetDesk} onValueChange={setTargetDesk}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose target desk..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DESK_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.emoji} {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preview */}
            <div className="space-y-2">
              <Label>Properties to be affected</Label>
              <div className={`p-4 rounded-lg ${previewCount > 0 ? 'bg-blue-50 border border-blue-200' : 'bg-muted'}`}>
                {!hasActiveFilter ? (
                  <p className="text-muted-foreground text-sm">Select at least one filter to see matching properties</p>
                ) : isLoadingPreview ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <div>
                    <p className="text-3xl font-bold text-blue-700">
                      {previewCount}
                    </p>
                    <p className="text-sm text-muted-foreground">properties match your filters</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleExecute}
                disabled={!canExecute || isPending}
                className="flex-1"
                size="lg"
              >
                {isPending ? 'Processing...' : `Execute on ${previewCount} Properties`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Properties Preview List */}
      {propertiesPreview && propertiesPreview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Properties Preview ({propertiesPreview.length})</CardTitle>
            <CardDescription>
              These properties will be affected by the bulk action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {propertiesPreview.map((prop: any) => (
                <div key={prop.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{prop.addressLine1}</p>
                    <p className="text-sm text-muted-foreground">{prop.city}, {prop.state} {prop.zipcode}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    {prop.deskName && (
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                        {DESK_OPTIONS.find(d => d.value === prop.deskName)?.label || prop.deskName}
                      </span>
                    )}
                    {prop.leadTemperature && (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        prop.leadTemperature === 'SUPER HOT' ? 'bg-red-100 text-red-700' :
                        prop.leadTemperature === 'HOT' ? 'bg-orange-100 text-orange-700' :
                        prop.leadTemperature === 'WARM' ? 'bg-yellow-100 text-yellow-700' :
                        prop.leadTemperature === 'COLD' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {prop.leadTemperature}
                      </span>
                    )}
                    {prop.assignedAgentName && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        {prop.assignedAgentName}
                      </span>
                    )}
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
            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to perform the following action on <strong>{previewCount} properties</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="bg-muted p-4 rounded-lg my-4 space-y-2">
            <p className="text-sm font-semibold">Summary:</p>
            <div className="text-sm text-muted-foreground space-y-1">
              {(actionMode === 'assign_agent' || actionMode === 'both') && (
                <p>Assign to: <strong className="text-foreground">{selectedUserName}</strong></p>
              )}
              {(actionMode === 'change_desk' || actionMode === 'both') && (
                <p>Move to desk: <strong className="text-foreground">{selectedDeskLabel}</strong></p>
              )}
              <p>Properties affected: <strong className="text-foreground">{previewCount}</strong></p>
              {filters.leadTemperature && <p>Temperature filter: {filters.leadTemperature}</p>}
              {filters.deskName && <p>Source desk filter: {sourceDeskLabel}</p>}
              {filters.status && <p>Status filter: {filters.status}</p>}
              {filters.unassignedOnly && <p>Unassigned only: Yes</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction} disabled={isPending}>
              {isPending ? 'Processing...' : 'Confirm'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

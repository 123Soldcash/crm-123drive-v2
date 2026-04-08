/**
 * Integrations Settings Page
 * Admin-only page to view, configure, and test all integration connections.
 */
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Phone,
  MessageSquare,
  Zap,
  Mail,
  PhoneCall,
  Eye,
  EyeOff,
  Save,
  TestTube,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Settings2,
  Shield,
  RefreshCw,
  Link2,
} from "lucide-react";

// Integration metadata for UI rendering
const INTEGRATION_META: Record<
  string,
  {
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    docsUrl?: string;
    hasTest?: boolean;
  }
> = {
  twilio: {
    title: "Twilio",
    description: "Voice calls, SMS messaging, and phone number management",
    icon: Phone,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    docsUrl: "https://console.twilio.com",
    hasTest: true,
  },
  slack: {
    title: "Slack",
    description: "Bot integration for Instantly & AutoCalls notifications",
    icon: MessageSquare,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    docsUrl: "https://api.slack.com/apps",
    hasTest: true,
  },
  zapier: {
    title: "Zapier",
    description: "Webhook integration for WordPress/Elementor form submissions",
    icon: Zap,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    docsUrl: "https://zapier.com/app/zaps",
  },
  instantly: {
    title: "Instantly",
    description: "Email outreach campaigns and cold email automation",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    docsUrl: "https://app.instantly.ai",
  },
  autocalls: {
    title: "AutoCalls",
    description: "Automated phone dialing campaigns",
    icon: PhoneCall,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
};

type SettingRow = {
  id: number;
  integration: string;
  settingKey: string;
  settingValue: string | null;
  label: string | null;
  description: string | null;
  isSecret: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
};

function IntegrationCard({
  integration,
  settings,
  onSave,
}: {
  integration: string;
  settings: SettingRow[];
  onSave: () => void;
}) {
  const meta = INTEGRATION_META[integration] || {
    title: integration,
    description: "",
    icon: Settings2,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  };

  const Icon = meta.icon;

  // Track edited values locally
  const [editedValues, setEditedValues] = useState<Record<number, string>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Reset edited values when settings change
  useEffect(() => {
    setEditedValues({});
  }, [settings]);

  const bulkUpdateMutation = trpc.integrations.bulkUpdate.useMutation({
    onSuccess: () => {
      toast.success(`${meta.title} settings saved!`);
      setEditedValues({});
      onSave();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  const testTwilioMutation = trpc.integrations.testTwilio.useMutation({
    onSuccess: (result) => {
      setTestResult(result);
      setIsTesting(false);
    },
    onError: (err) => {
      setTestResult({ success: false, message: err.message });
      setIsTesting(false);
    },
  });

  const testSlackMutation = trpc.integrations.testSlack.useMutation({
    onSuccess: (result) => {
      setTestResult(result);
      setIsTesting(false);
    },
    onError: (err) => {
      setTestResult({ success: false, message: err.message });
      setIsTesting(false);
    },
  });

  const hasChanges = Object.keys(editedValues).length > 0;

  const handleSave = () => {
    const changedSettings = Object.entries(editedValues).map(([id, value]) => ({
      id: Number(id),
      settingValue: value,
    }));
    if (changedSettings.length === 0) return;
    setIsSaving(true);
    bulkUpdateMutation.mutate(
      { settings: changedSettings },
      { onSettled: () => setIsSaving(false) }
    );
  };

  const handleTest = () => {
    setIsTesting(true);
    setTestResult(null);
    if (integration === "twilio") {
      testTwilioMutation.mutate();
    } else if (integration === "slack") {
      testSlackMutation.mutate();
    }
  };

  const toggleReveal = (id: number) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard!");
  };

  // Count configured vs total fields
  const configuredCount = settings.filter((s) => s.settingValue && s.settingValue.trim() !== "").length;
  const totalCount = settings.length;
  const isFullyConfigured = configuredCount === totalCount;

  return (
    <Card className={`${meta.borderColor} border-2 transition-all hover:shadow-md`}>
      <CardHeader className={`${meta.bgColor} rounded-t-lg`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg bg-white shadow-sm`}>
              <Icon className={`h-6 w-6 ${meta.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {meta.title}
                {isFullyConfigured ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                    {configuredCount}/{totalCount} configured
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-0.5">{meta.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meta.docsUrl && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(meta.docsUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Console
              </Button>
            )}
            {meta.hasTest && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleTest}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <TestTube className="h-3.5 w-3.5 mr-1" />
                )}
                Test Connection
              </Button>
            )}
          </div>
        </div>

        {/* Test result banner */}
        {testResult && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${
              testResult.success
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-5 space-y-4">
        {settings.map((setting) => {
          const currentValue = editedValues[setting.id] ?? setting.settingValue ?? "";
          const isSecret = setting.isSecret === 1;
          const isRevealed = revealedSecrets.has(setting.id);
          const isEdited = editedValues[setting.id] !== undefined;
          const isEmpty = !currentValue.trim();

          return (
            <div key={setting.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  {isSecret && <Shield className="h-3.5 w-3.5 text-amber-500" />}
                  {setting.label || setting.settingKey}
                  {isEdited && (
                    <span className="text-xs text-blue-500 font-normal">(modified)</span>
                  )}
                </label>
                {!isEmpty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => copyToClipboard(currentValue)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={isSecret && !isRevealed ? "password" : "text"}
                    value={currentValue}
                    onChange={(e) =>
                      setEditedValues((prev) => ({ ...prev, [setting.id]: e.target.value }))
                    }
                    placeholder={isEmpty ? "Not configured" : ""}
                    className={`pr-10 text-sm font-mono ${
                      isEmpty ? "border-amber-300 bg-amber-50/30" : "border-gray-200"
                    } ${isEdited ? "border-blue-400 bg-blue-50/30" : ""}`}
                  />
                  {isSecret && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => toggleReveal(setting.id)}
                    >
                      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>

              {setting.description && (
                <p className="text-xs text-gray-400 pl-0.5">{setting.description}</p>
              )}
            </div>
          );
        })}

        {/* Save button */}
        {hasChanges && (
          <div className="pt-3 border-t border-gray-100">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save {meta.title} Settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  const { data: allSettings, isLoading, refetch } = trpc.integrations.list.useQuery();

  // Order integrations
  const integrationOrder = ["twilio", "slack", "zapier", "instantly", "autocalls"];

  const sortedIntegrations = useMemo(() => {
    if (!allSettings) return [];
    return integrationOrder
      .filter((key) => allSettings[key])
      .map((key) => ({ key, settings: allSettings[key] }));
  }, [allSettings]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-100 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Count total configured
  const totalConfigured = Object.values(allSettings || {}).reduce(
    (acc, settings) => acc + settings.filter((s: any) => s.settingValue?.trim()).length,
    0
  );
  const totalSettings = Object.values(allSettings || {}).reduce(
    (acc, settings) => acc + settings.length,
    0
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Link2 className="h-7 w-7 text-indigo-600" />
              Integrations
            </h1>
            <p className="text-gray-500 mt-1">
              Manage API keys, tokens, and connection settings for all external services.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm py-1 px-3">
              {totalConfigured}/{totalSettings} fields configured
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sortedIntegrations.map(({ key, settings }) => (
          <IntegrationCard
            key={key}
            integration={key}
            settings={settings as any}
            onSave={() => refetch()}
          />
        ))}
      </div>

      {/* Help text */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500">
        <p className="font-medium text-gray-700 mb-1">How it works:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Edit any field and click <strong>Save</strong> to update the configuration in real-time.</li>
          <li>Secret fields (marked with a shield icon) are masked by default — click the eye icon to reveal.</li>
          <li>Use <strong>Test Connection</strong> to verify your credentials are working before saving.</li>
          <li>Changes take effect within 60 seconds across the entire system (cached for performance).</li>
        </ul>
      </div>
    </div>
  );
}

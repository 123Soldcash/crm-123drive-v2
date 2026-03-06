/**
 * SMSInbox — Centralized SMS inbox page.
 *
 * Shows all conversations grouped by contact phone number.
 * Clicking a conversation opens the SMSChatButton drawer.
 * Auto-refreshes every 15 seconds to show new inbound messages.
 */
import { useState } from "react";
import { MessageSquare, RefreshCw, Phone, Search, Inbox, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SMSChatButton } from "@/components/SMSChatButton";

/** Format phone for display */
function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/** Format relative time */
function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SMSInbox() {
  const [search, setSearch] = useState("");

  // Get all conversations
  const { data: conversations = [], isLoading, refetch } = trpc.sms.getConversationList.useQuery(
    undefined,
    { refetchInterval: 15_000 }
  );

  const filteredConversations = conversations.filter((conv: any) =>
    conv.contactPhone.includes(search.replace(/\D/g, "")) ||
    formatPhoneDisplay(conv.contactPhone).includes(search)
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">SMS Inbox</h1>
            <p className="text-sm text-gray-500">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by phone number..."
          className="pl-9"
        />
      </div>

      {/* Webhook setup notice */}
      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 space-y-2">
        <p className="font-semibold">To receive inbound SMS replies, configure the Twilio webhook:</p>
        <ol className="list-decimal list-inside space-y-1 text-amber-800">
          <li>
            Go to{" "}
            <a
              href="https://console.twilio.com/us1/develop/phone-numbers/manage/incoming"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium inline-flex items-center gap-0.5"
            >
              Twilio Console → Phone Numbers → Manage → Active Numbers
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </li>
          <li>Click on your phone number</li>
          <li>Scroll down to the <strong>Messaging Configuration</strong> section</li>
          <li>Under <strong>"A message comes in"</strong>, select <strong>Webhook</strong> and paste:</li>
        </ol>
        <code className="block bg-amber-100 border border-amber-300 px-3 py-1.5 rounded text-xs font-mono text-amber-900 select-all">
          https://crmv3.manus.space/api/twilio/sms/incoming
        </code>
        <p className="text-xs text-amber-700">Make sure the HTTP method is set to <strong>HTTP POST</strong>, then click Save.</p>
      </div>

      {/* Conversation list */}
      {isLoading && conversations.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && filteredConversations.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? "No conversations found" : "No messages yet"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {search
              ? "Try searching with a different number"
              : "Click the message icon next to a phone number to start a conversation"}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filteredConversations.map((conv: any) => (
          <ConversationRow key={conv.contactPhone} contactPhone={conv.contactPhone} lastMessageTime={conv.lastMessage} />
        ))}
      </div>
    </div>
  );
}

/** Individual conversation row with last message preview */
function ConversationRow({
  contactPhone,
  lastMessageTime,
}: {
  contactPhone: string;
  lastMessageTime: string;
}) {
  const { data: messages = [] } = trpc.sms.getConversation.useQuery(
    { contactPhone, limit: 1 },
    { staleTime: 10_000 }
  );

  const lastMsg = messages[0] as any;
  const isInbound = lastMsg?.direction === "inbound";

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all group">
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Phone className="w-5 h-5 text-gray-500" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-gray-900 font-mono">
            {formatPhoneDisplay(contactPhone)}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {lastMessageTime ? formatRelativeTime(lastMessageTime) : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {isInbound && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
              Received
            </Badge>
          )}
          <p className="text-xs text-gray-500 truncate">
            {lastMsg ? (
              <>
                {!isInbound && <span className="text-gray-400">You: </span>}
                {lastMsg.body}
              </>
            ) : (
              <span className="italic text-gray-400">No messages</span>
            )}
          </p>
        </div>
      </div>

      {/* Open chat button */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <SMSChatButton
          phoneNumber={contactPhone}
          iconOnly={true}
        />
      </div>
    </div>
  );
}

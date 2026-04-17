/**
 * SMSChatButton — Inline button that opens a number selector, then a full SMS chat drawer.
 *
 * Usage:
 *   <SMSChatButton
 *     phoneNumber="+15551234567"
 *     contactName="John Smith"
 *     contactId={42}
 *     propertyId={123}
 *   />
 *
 * The button shows a MessageSquare icon (blue). Clicking it opens a popover
 * to select which Twilio number to send from, then opens the SMS chat drawer.
 */
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, RefreshCw, CheckCheck, AlertCircle, Clock, Loader2, Phone, FileText, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/formatPhone";
import { toast } from "sonner";

interface SMSChatButtonProps {
  phoneNumber: string;
  contactName?: string;
  contactId?: number;
  propertyId?: number;
  /** Property address line 1 for {{address}} variable */
  propertyAddress?: string;
  /** Property city for {{city}} variable */
  propertyCity?: string;
  /** Logged-in agent name for {{agent}} variable */
  agentName?: string;
  /** If true, show a compact icon-only button (default: true) */
  iconOnly?: boolean;
}

/** Normalize phone to E.164 for display and API calls */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone.replace(/[^\d+]/g, "");
  return `+1${digits}`;
}

/** Format phone for human display: +15551234567 → (555) 123-4567 */
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

/** Format timestamp for chat bubbles */
function formatTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Status icon for outbound messages */
function StatusIcon({ status }: { status: string }) {
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-blue-400" />;
  if (status === "sent") return <CheckCheck className="w-3 h-3 text-gray-400" />;
  if (status === "failed" || status === "undelivered") return <AlertCircle className="w-3 h-3 text-red-400" />;
  return <Clock className="w-3 h-3 text-gray-300" />;
}

export function SMSChatButton({
  phoneNumber,
  contactName,
  contactId,
  propertyId,
  propertyAddress,
  propertyCity,
  agentName,
  iconOnly = true,
}: SMSChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const normalizedPhone = normalizePhone(phoneNumber);

  // Fetch Twilio numbers when selector opens
  const numbersQuery = trpc.twilio.listNumbers.useQuery({ activeOnly: true }, {
    enabled: selectorOpen,
  });

  // Fetch SMS templates for picker
  const { data: templates = [] } = trpc.smsTemplates.list.useQuery(
    { channel: "sms" },
    { enabled: open, staleTime: 60_000 }
  );

  /** Apply a template — substitute all known variables with real data */
  function applyTemplate(body: string) {
    let text = body;
    // Contact name: {{name}}, {{ownerName}}, {{contactName}}
    if (contactName) {
      text = text.replace(/\{\{name\}\}/gi, contactName);
      text = text.replace(/\{\{ownerName\}\}/gi, contactName);
      text = text.replace(/\{\{contactName\}\}/gi, contactName);
    }
    // Property address: {{address}}
    if (propertyAddress) {
      text = text.replace(/\{\{address\}\}/gi, propertyAddress);
    }
    // Property city: {{city}}
    if (propertyCity) {
      text = text.replace(/\{\{city\}\}/gi, propertyCity);
    }
    // Agent name: {{agent}}, {{agentName}}
    if (agentName) {
      text = text.replace(/\{\{agent\}\}/gi, agentName);
      text = text.replace(/\{\{agentName\}\}/gi, agentName);
    }
    setMessage(text);
    setTemplatePickerOpen(false);
    setTemplateSearch("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const filteredTemplates = templates.filter((t: any) =>
    !templateSearch ||
    t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    t.body.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Group templates by category
  const templatesByCategory = filteredTemplates.reduce((acc: Record<string, any[]>, t: any) => {
    const cat = t.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  // Fetch conversation — auto-refresh every 10 seconds when drawer is open
  const { data: messages = [], refetch, isLoading } = trpc.sms.getConversation.useQuery(
    { contactPhone: normalizedPhone, limit: 100 },
    {
      enabled: open,
      refetchInterval: open ? 10_000 : false,
      staleTime: 5_000,
    }
  );

  // Send SMS mutation — now passes fromNumber
  const sendMutation = trpc.sms.send.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    },
    onError: (err) => {
      toast.error("Failed to send SMS", { description: err.message });
    },
  });

  // Scroll to bottom when messages load or new messages arrive
  useEffect(() => {
    if (open && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [open, messages.length]);

  // Focus textarea when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    sendMutation.mutate({
      to: normalizedPhone,
      body: trimmed,
      contactId,
      propertyId,
      fromNumber: selectedFromNumber || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = contactName || formatPhoneDisplay(normalizedPhone);

  function handleSmsClick() {
    setSelectorOpen(true);
  }

  function handleSelectNumber(phone: string, label: string) {
    setSelectedFromNumber(phone);
    setSelectedLabel(label);
    setSelectorOpen(false);
    setOpen(true);
  }

  const numbers = numbersQuery.data || [];

  return (
    <>
      {/* Trigger button with number selector */}
      <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSmsClick}
            className="h-7 w-7 p-0 hover:bg-blue-50 rounded-full flex-shrink-0"
            title={`Send SMS to ${displayName}`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Select sender number:</p>
          {numbersQuery.isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : numbers.length === 0 ? (
            <div className="text-center py-3 px-2">
              <p className="text-sm text-muted-foreground">No Twilio numbers available.</p>
              <p className="text-xs text-muted-foreground mt-1">Ask an admin to add numbers in Settings.</p>
            </div>
          ) : (
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
              {numbers.map((num: any) => (
                <button
                  key={num.id}
                  onClick={() => handleSelectNumber(num.phoneNumber, num.label)}
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{num.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatPhone(num.phoneNumber)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Chat drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          {/* Header — pr-10 reserves space for Sheet's built-in close button */}
          <SheetHeader className="px-4 pr-10 py-3 border-b bg-white flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 font-semibold text-sm">
                  {(contactName || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-sm font-semibold truncate">
                  {displayName}
                </SheetTitle>
                <p className="text-xs text-gray-500 font-mono">
                  {formatPhoneDisplay(normalizedPhone)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="h-7 w-7 p-0 flex-shrink-0"
                title="Refresh messages"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {/* SMS badge + sender number */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <MessageSquare className="w-3 h-3 mr-1" />
                SMS
              </Badge>
              {selectedLabel && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  <Phone className="w-3 h-3 mr-1" />
                  Sending from: {selectedLabel}
                </Badge>
              )}
              <span className="text-xs text-gray-400">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
            </div>
          </SheetHeader>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {isLoading && messages.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}

            {!isLoading && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <MessageSquare className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">No messages yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Send a message to start the conversation
                </p>
              </div>
            )}

            {messages.map((msg: any) => {
              const isOutbound = msg.direction === "outbound";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                      isOutbound
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-white text-gray-900 border border-gray-100 rounded-bl-sm"
                    }`}
                  >
                    {isOutbound && msg.sentByName && (
                      <p className="text-xs text-blue-200 mb-0.5 font-medium">
                        {msg.sentByName}
                      </p>
                    )}
                    {/* Show which Twilio number was used */}
                    {msg.twilioPhone && (
                      <p className={`text-xs mb-0.5 ${isOutbound ? "text-blue-200" : "text-gray-400"}`}>
                        {isOutbound ? "From" : "To"}: {formatPhoneDisplay(msg.twilioPhone)}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.body}
                    </p>
                    <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end" : "justify-start"}`}>
                      <span className={`text-xs ${isOutbound ? "text-blue-200" : "text-gray-400"}`}>
                        {formatTime(msg.createdAt)}
                      </span>
                      {isOutbound && <StatusIcon status={msg.status || "queued"} />}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Compose area */}
          <div className="flex-shrink-0 border-t bg-white px-4 py-3">
            {/* Change number button */}
            {selectedFromNumber && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500">
                  Sending from: <span className="font-mono font-medium">{formatPhoneDisplay(selectedFromNumber)}</span>
                  {selectedLabel && <span className="text-gray-400"> ({selectedLabel})</span>}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 text-xs text-blue-600 hover:text-blue-700 px-1">
                      Change
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Select sender number:</p>
                    <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                      {numbers.map((num: any) => (
                        <button
                          key={num.id}
                          onClick={() => {
                            setSelectedFromNumber(num.phoneNumber);
                            setSelectedLabel(num.label);
                          }}
                          className={`w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2 ${
                            selectedFromNumber === num.phoneNumber ? "bg-accent" : ""
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{num.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">{formatPhone(num.phoneNumber)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            <div className="flex gap-2 items-end">
              {/* Template picker button */}
              <Popover open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-[44px] w-[44px] p-0 flex-shrink-0 border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                    title="Insert template"
                    disabled={sendMutation.isPending}
                  >
                    <FileText className="h-4 w-4 text-gray-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start" side="top">
                  <div className="p-2 border-b">
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">Insert Template</p>
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      autoFocus
                    />
                    {/* Auto-fill status: show which variables will be replaced */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        contactName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {contactName ? `✓ {{name}} → ${contactName.split(' ')[0]}` : '✗ {{name}} missing'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        propertyAddress ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {propertyAddress ? `✓ {{address}}` : '✗ {{address}} missing'}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        agentName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {agentName ? `✓ {{agent}} → ${agentName.split(' ')[0]}` : '✗ {{agent}} missing'}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {filteredTemplates.length === 0 ? (
                      <div className="py-6 text-center text-xs text-gray-400">
                        {templates.length === 0 ? "No SMS templates yet" : "No templates match your search"}
                      </div>
                    ) : (
                      Object.entries(templatesByCategory).map(([category, items]: [string, any[]]) => (
                        <div key={category}>
                          <div className="px-3 py-1 bg-gray-50 border-b border-t">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</span>
                          </div>
                          {items.map((t: any) => (
                            <button
                              key={t.id}
                              onClick={() => applyTemplate(t.body)}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-gray-800 truncate group-hover:text-blue-700">{t.name}</p>
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{t.body}</p>
                                </div>
                                <ChevronRight className="h-3 w-3 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Enter to send)"
                className="flex-1 min-h-[44px] max-h-32 resize-none text-sm"
                rows={1}
                disabled={sendMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                size="sm"
                className="h-[44px] w-[44px] p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                title="Send message"
              >
                {sendMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Enter to send · Shift+Enter for new line · Auto-refreshes every 10s
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

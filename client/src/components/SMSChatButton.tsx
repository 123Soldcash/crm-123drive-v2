/**
 * SMSChatButton — Inline button that opens a full SMS chat drawer.
 *
 * Usage:
 *   <SMSChatButton
 *     phoneNumber="+15551234567"
 *     contactName="John Smith"
 *     contactId={42}
 *     propertyId={123}
 *   />
 *
 * The button shows a MessageSquare icon (green). Clicking it opens a
 * Sheet drawer on the right side with the full conversation history
 * and a compose box to send new messages.
 *
 * Inbound messages are received via Twilio webhook → /api/twilio/sms/incoming
 * and stored in the smsMessages table. The chat auto-refreshes every 10s
 * to pick up new replies.
 */
import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, RefreshCw, Phone, X, CheckCheck, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SMSChatButtonProps {
  phoneNumber: string;
  contactName?: string;
  contactId?: number;
  propertyId?: number;
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
  iconOnly = true,
}: SMSChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const normalizedPhone = normalizePhone(phoneNumber);

  // Fetch conversation — auto-refresh every 10 seconds when drawer is open
  const { data: messages = [], refetch, isLoading } = trpc.sms.getConversation.useQuery(
    { contactPhone: normalizedPhone, limit: 100 },
    {
      enabled: open,
      refetchInterval: open ? 10_000 : false,
      staleTime: 5_000,
    }
  );

  // Send SMS mutation
  const sendMutation = trpc.sms.send.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
      // Scroll to bottom after send
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    },
    onError: (err) => {
      toast.error("Falha ao enviar SMS", { description: err.message });
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
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayName = contactName || formatPhoneDisplay(normalizedPhone);

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 w-7 p-0 hover:bg-blue-50 rounded-full flex-shrink-0"
        title={`Enviar SMS para ${displayName}`}
      >
        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
      </Button>

      {/* Chat drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b bg-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-semibold text-sm">
                    {(contactName || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-sm font-semibold truncate">
                    {displayName}
                  </SheetTitle>
                  <p className="text-xs text-gray-500 font-mono">
                    {formatPhoneDisplay(normalizedPhone)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  className="h-7 w-7 p-0"
                  title="Atualizar mensagens"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 p-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* SMS badge */}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                <MessageSquare className="w-3 h-3 mr-1" />
                SMS
              </Badge>
              <span className="text-xs text-gray-400">
                {messages.length} mensagem{messages.length !== 1 ? "s" : ""}
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
                <p className="text-sm text-gray-500 font-medium">Nenhuma mensagem ainda</p>
                <p className="text-xs text-gray-400 mt-1">
                  Envie uma mensagem para iniciar a conversa
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
                    {/* Sender name for outbound */}
                    {isOutbound && msg.sentByName && (
                      <p className="text-xs text-blue-200 mb-0.5 font-medium">
                        {msg.sentByName}
                      </p>
                    )}
                    {/* Message body */}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.body}
                    </p>
                    {/* Footer: time + status */}
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

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* Compose area */}
          <div className="flex-shrink-0 border-t bg-white px-4 py-3">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem... (Enter para enviar)"
                className="flex-1 min-h-[44px] max-h-32 resize-none text-sm"
                rows={1}
                disabled={sendMutation.isPending}
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMutation.isPending}
                size="sm"
                className="h-[44px] w-[44px] p-0 bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                title="Enviar mensagem"
              >
                {sendMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Enter para enviar · Shift+Enter para nova linha · Atualiza a cada 10s
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

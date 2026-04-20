import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Voicemail,
  Phone,
  Building2,
  User,
  Clock,
  CheckCheck,
  Trash2,
  Upload,
  Play,
  Volume2,
  RefreshCw,
} from "lucide-react";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "Unknown";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

export default function VoicemailsPage() {
  const [unheardOnly, setUnheardOnly] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingGreeting, setUploadingGreeting] = useState(false);

  const utils = trpc.useUtils();

  const { data: voicemails = [], isLoading, refetch } = trpc.voicemails.list.useQuery({
    unheardOnly,
    limit: 100,
    offset: 0,
  });

  const { data: greetingData } = trpc.voicemails.getGreeting.useQuery();
  const { data: unheardCountData } = trpc.voicemails.getUnheardCount.useQuery();

  const markHeardMutation = trpc.voicemails.markHeard.useMutation({
    onSuccess: () => {
      utils.voicemails.list.invalidate();
      utils.voicemails.getUnheardCount.invalidate();
    },
  });

  const deleteMutation = trpc.voicemails.delete.useMutation({
    onSuccess: () => {
      utils.voicemails.list.invalidate();
      utils.voicemails.getUnheardCount.invalidate();
      toast.success("Voicemail deleted");
    },
  });

  const uploadGreetingMutation = trpc.voicemails.uploadGreeting.useMutation({
    onSuccess: () => {
      utils.voicemails.getGreeting.invalidate();
      toast.success("Voicemail greeting uploaded successfully!");
      setUploadingGreeting(false);
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
      setUploadingGreeting(false);
    },
  });

  function handlePlay(vm: any) {
    if (playingId === vm.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(vm.recordingUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingId(vm.id);
    audio.onended = () => setPlayingId(null);

    // Auto-mark as heard when played
    if (!vm.isHeard) {
      markHeardMutation.mutate({ id: vm.id });
    }
  }

  async function handleGreetingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select an audio file (MP3, WAV, etc.)");
      return;
    }
    setUploadingGreeting(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadGreetingMutation.mutate({ fileBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  const unheardCount = unheardCountData?.count ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Voicemail className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voicemails</h1>
            <p className="text-sm text-muted-foreground">
              Missed call recordings from leads
            </p>
          </div>
          {unheardCount > 0 && (
            <Badge className="bg-red-500 text-white text-sm px-2 py-0.5">
              {unheardCount} new
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Voicemail Greeting Upload */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-purple-600" />
            Voicemail Greeting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload an MP3 file that will be played to callers when no agent answers.
            If no file is uploaded, a default text-to-speech message will be used.
          </p>
          {greetingData?.url && (
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
              <Volume2 className="h-4 w-4 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-700">Greeting uploaded</p>
                <p className="text-xs text-muted-foreground truncate">{greetingData.url}</p>
              </div>
              <audio controls src={greetingData.url} className="h-8 max-w-[200px]" />
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleGreetingUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingGreeting}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploadingGreeting ? "Uploading..." : greetingData?.url ? "Replace MP3" : "Upload MP3"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Supported: MP3, WAV, OGG · Max 10 MB
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Button
          variant={!unheardOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnheardOnly(false)}
        >
          All Voicemails
        </Button>
        <Button
          variant={unheardOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnheardOnly(true)}
          className="gap-2"
        >
          Unheard
          {unheardCount > 0 && (
            <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
              {unheardCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Voicemail List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : voicemails.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Voicemail className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium text-muted-foreground">No voicemails yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              {unheardOnly
                ? "All voicemails have been heard."
                : "When a caller leaves a message on a missed call, it will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {voicemails.map((vm) => (
            <Card
              key={vm.id}
              className={`transition-all ${!vm.isHeard ? "border-purple-300 bg-purple-50/30 shadow-sm" : "border-border"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Play Button */}
                  <button
                    onClick={() => handlePlay(vm)}
                    className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      playingId === vm.id
                        ? "bg-purple-600 text-white"
                        : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                    }`}
                  >
                    {playingId === vm.id ? (
                      <Volume2 className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5 ml-0.5" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Unheard badge */}
                      {!vm.isHeard && (
                        <Badge className="bg-red-500 text-white text-xs">New</Badge>
                      )}
                      {/* Caller phone */}
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatPhone(vm.callerPhone)}
                      </div>
                      {/* Duration */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(vm.durationSeconds)}
                      </div>
                    </div>

                    {/* Contact name */}
                    {vm.contactName && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        {vm.contactName}
                      </div>
                    )}

                    {/* Property link */}
                    {vm.propertyId && vm.propertyAddress && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <Link
                          href={`/properties/${vm.propertyId}`}
                          className="text-blue-600 hover:underline truncate"
                        >
                          {vm.propertyAddress}
                        </Link>
                      </div>
                    )}

                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      {formatDate(vm.createdAt)}
                      {vm.isHeard && vm.heardAt && (
                        <span className="ml-2 text-green-600">
                          · Heard {formatDate(vm.heardAt)}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!vm.isHeard && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markHeardMutation.mutate({ id: vm.id })}
                        disabled={markHeardMutation.isPending}
                        className="gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark Heard
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this voicemail?")) {
                          deleteMutation.mutate({ id: vm.id });
                        }
                      }}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

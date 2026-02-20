import { trpc } from "@/lib/trpc";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DistressDriver {
  signal: string;
  points: number;
  category: string;
}

function safeParseDrivers(val: any): DistressDriver[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function DistressScoreBadge({ propertyId }: { propertyId: number }) {
  const { data, isLoading } = trpc.deepSearch.getDistressScore.useQuery({ propertyId });

  if (isLoading) {
    return <div className="h-7 w-28 bg-gray-100 rounded-full animate-pulse" />;
  }

  if (!data || data.score === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
        <Minus className="w-3 h-3" />
        No Distress Data
      </div>
    );
  }

  const { score, band, drivers } = data;
  const parsedDrivers = safeParseDrivers(drivers);

  const bandConfig = {
    LOW: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-300",
      icon: <TrendingDown className="w-3.5 h-3.5" />,
    },
    MEDIUM: {
      bg: "bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-300",
      icon: <Minus className="w-3.5 h-3.5" />,
    },
    HIGH: {
      bg: "bg-red-100",
      text: "text-red-800",
      border: "border-red-300",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
    },
  };

  const config = bandConfig[band as keyof typeof bandConfig] || bandConfig.LOW;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${config.bg} ${config.text} ${config.border} text-xs font-bold cursor-help`}>
            {config.icon}
            Distress: {score} ({band})
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 p-1">
            <p className="text-xs font-bold">Distress Score: {score}/100 ({band})</p>
            {parsedDrivers.length > 0 && (
              <>
                <p className="text-xs text-gray-500 font-medium">Top Drivers:</p>
                <ul className="space-y-1">
                  {parsedDrivers.slice(0, 5).map((d: DistressDriver, i: number) => (
                    <li key={i} className="text-xs flex justify-between gap-3">
                      <span>{d.signal}</span>
                      <span className="font-mono text-gray-500">+{d.points}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

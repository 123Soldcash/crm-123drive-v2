import { describe, it, expect } from "vitest";

// Helper to create a UTC date without timezone offset issues
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// Helper to format a Date as YYYY-MM-DD in UTC
function toUTCDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function calculateNextDueDate(currentDueDate: Date, repeatInterval: string): Date {
  const next = new Date(currentDueDate);
  switch (repeatInterval) {
    case "Daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "Weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "Monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "3 Months":
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case "6 Months":
      next.setUTCMonth(next.getUTCMonth() + 6);
      break;
  }
  return next;
}

describe("Task Repeat Scheduler - Date Calculation", () => {
  it("Daily repeat adds 1 day", () => {
    const base = utcDate(2026, 1, 1);
    const next = calculateNextDueDate(base, "Daily");
    expect(toUTCDateString(next)).toBe("2026-01-02");
  });

  it("Weekly repeat adds 7 days", () => {
    const base = utcDate(2026, 1, 1);
    const next = calculateNextDueDate(base, "Weekly");
    expect(toUTCDateString(next)).toBe("2026-01-08");
  });

  it("Monthly repeat adds 1 month", () => {
    const base = utcDate(2026, 1, 15);
    const next = calculateNextDueDate(base, "Monthly");
    expect(toUTCDateString(next)).toBe("2026-02-15");
  });

  it("3 Months repeat adds 3 months", () => {
    const base = utcDate(2026, 1, 15);
    const next = calculateNextDueDate(base, "3 Months");
    expect(toUTCDateString(next)).toBe("2026-04-15");
  });

  it("6 Months repeat adds 6 months", () => {
    const base = utcDate(2026, 1, 15);
    const next = calculateNextDueDate(base, "6 Months");
    expect(toUTCDateString(next)).toBe("2026-07-15");
  });

  it("3 Months repeat crosses year boundary correctly", () => {
    const base = utcDate(2026, 11, 1);
    const next = calculateNextDueDate(base, "3 Months");
    expect(toUTCDateString(next)).toBe("2027-02-01");
  });

  it("6 Months repeat crosses year boundary correctly", () => {
    const base = utcDate(2026, 9, 1);
    const next = calculateNextDueDate(base, "6 Months");
    expect(toUTCDateString(next)).toBe("2027-03-01");
  });

  it("Unknown interval returns same date", () => {
    const base = utcDate(2026, 1, 15);
    const next = calculateNextDueDate(base, "No repeat");
    expect(toUTCDateString(next)).toBe("2026-01-15");
  });
});

describe("Task Repeat - Repeat Label Display", () => {
  function getRepeatLabel(repeatTask: string | null): string | null {
    if (!repeatTask || repeatTask === "No repeat") return null;
    const labels: Record<string, string> = {
      Daily: "Daily",
      Weekly: "Weekly",
      Monthly: "Monthly",
      "3 Months": "Every 3mo",
      "6 Months": "Every 6mo",
    };
    return labels[repeatTask] || repeatTask;
  }

  it("returns null for No repeat", () => {
    expect(getRepeatLabel("No repeat")).toBeNull();
  });

  it("returns null for null", () => {
    expect(getRepeatLabel(null)).toBeNull();
  });

  it("returns Daily label", () => {
    expect(getRepeatLabel("Daily")).toBe("Daily");
  });

  it("returns Weekly label", () => {
    expect(getRepeatLabel("Weekly")).toBe("Weekly");
  });

  it("returns Monthly label", () => {
    expect(getRepeatLabel("Monthly")).toBe("Monthly");
  });

  it("returns Every 3mo for 3 Months", () => {
    expect(getRepeatLabel("3 Months")).toBe("Every 3mo");
  });

  it("returns Every 6mo for 6 Months", () => {
    expect(getRepeatLabel("6 Months")).toBe("Every 6mo");
  });
});

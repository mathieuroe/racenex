// Race finish times as h:mm:ss or mm:ss text <-> seconds (results.finish_time_sec).

export function parseRaceTime(input: string): number | null {
  const parts = input.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => p === "" || Number.isNaN(Number(p)))) {
    return null;
  }
  const nums = parts.map(Number);
  const [h, m, s] = nums.length === 3 ? nums : [0, nums[0], nums[1]];
  if (m >= 60 || s >= 60 || h < 0 || m < 0 || s < 0) return null;
  return h * 3600 + m * 60 + s;
}

export function formatRaceTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

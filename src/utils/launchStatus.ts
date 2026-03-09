export type LaunchStatus = "SOLD_OUT" | "UPCOMING" | "ENDED" | "ACTIVE";

export function computeLaunchStatus(opts: {
  startsAt: Date;
  endsAt: Date;
  totalSupply: number;
  totalPurchased: number;
}): LaunchStatus {
  const now = new Date();

  if (opts.totalPurchased >= opts.totalSupply) {
    return "SOLD_OUT";
  }
  if (now < opts.startsAt) {
    return "UPCOMING";
  }
  if (now > opts.endsAt) {
    return "ENDED";
  }
  return "ACTIVE";
}


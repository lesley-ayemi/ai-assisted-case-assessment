import { Loading, Skeleton } from "@/components/ui";

const card = "rounded-lg border bg-white";

export function TextSkeleton({ lines = 4, label = "Loading text" }: { lines?: number; label?: string }) {
  return (
    <Loading label={label}>
      <div className="space-y-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? "w-3/5" : "w-full"}`} />
        ))}
      </div>
    </Loading>
  );
}

export function CasesSkeleton() {
  return (
    <Loading label="Loading cases">
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className={`${card} grid gap-1 p-1.5 sm:grid-cols-4`}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        <div className={card}>
          <div className="border-b border-line-soft px-5 py-4">
            <Skeleton className="h-4 w-24" />
          </div>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-line-soft px-5 py-4 last:border-0">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3.5 w-72" />
              </div>
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="hidden h-4 w-8 sm:block" />
              <Skeleton className="h-5 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

export function CaseSkeleton() {
  return (
    <Loading label="Loading case">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-44 rounded-md" />
            <Skeleton className="h-9 w-48 rounded-md" />
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-6">
            {[5, 4, 3].map((n, i) => (
              <div key={i} className={`${card} space-y-3 p-5`}>
                <Skeleton className="h-4 w-28" />
                {Array.from({ length: n }, (_, j) => (
                  <Skeleton key={j} className={`h-3.5 ${j % 2 ? "w-4/5" : "w-full"}`} />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-6">
            <div className={`${card} grid grid-cols-2 gap-px overflow-hidden bg-line xl:grid-cols-4`}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-2 bg-white px-4 py-3.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className={`${card} space-y-4 p-5`}>
              <div className="flex justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-7 w-20" />
              </div>
              <Skeleton className="h-3 w-full rounded-full" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Loading>
  );
}

export function ResultsSkeleton() {
  return (
    <Loading label="Searching legislation">
      <div className={`${card} divide-y divide-line-soft`}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-2.5 px-5 py-4">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-2 w-32 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

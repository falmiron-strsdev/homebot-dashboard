import { NextResponse } from "next/server";
import { orchFetch } from "@/lib/orch-client";
import type { Job, Run, JobEvent, ActivityItem } from "@/lib/types";

export async function GET() {
  try {
    const jobs = await orchFetch<Job[]>("/jobs?limit=200");

    // Sort by most recently updated, take top 20 for activity feed
    const sorted = [...jobs].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const recent = sorted.slice(0, 20);

    // Fetch runs + events for each in parallel
    const enriched = await Promise.all(
      recent.map(async (job): Promise<ActivityItem> => {
        const [runs, events] = await Promise.allSettled([
          orchFetch<Run[]>(`/jobs/${job.id}/runs`),
          orchFetch<JobEvent[]>(`/jobs/${job.id}/events`),
        ]);

        const runList = runs.status === "fulfilled" ? runs.value : [];
        const eventList = events.status === "fulfilled" ? events.value : [];

        const latest_run =
          runList.length > 0
            ? runList.sort((a, b) => b.run_number - a.run_number)[0]
            : null;

        const latest_event =
          eventList.length > 0
            ? eventList[eventList.length - 1]
            : null;

        return { job, latest_run, latest_event };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

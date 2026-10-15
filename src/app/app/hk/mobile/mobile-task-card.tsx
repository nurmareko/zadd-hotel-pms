"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Loader2, Play, Plus } from "lucide-react";
import { toast } from "sonner";

import { AmenitiesStepper } from "@/components/hk/amenities-stepper";
import { AMENITIES_ITEMS, EMPTY_AMENITIES, type AmenitiesCounts } from "@/lib/housekeeping/amenities";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MobileCleaningRoom } from "@/lib/housekeeper-mobile-data";
import { CleaningTimer } from "../rooms/[roomId]/cleaning-timer";
import { finishMobileCleaning, inspectMobileRoom, startMobileCleaning } from "./actions";
import { MobileRoomSummary, useMobileAction } from "./mobile-presentation";

export type MobileTaskCardProps = {
  room: MobileCleaningRoom;
  userId: number;
  onReportFound: (roomId: number) => void;
};

export function MobileTaskCard({ room, userId, onReportFound }: MobileTaskCardProps) {
  const { isPending, run } = useMobileAction();
  const [linenChanged, setLinenChanged] = useState(false);
  const [towelChanged, setTowelChanged] = useState(false);
  const [amenities, setAmenities] = useState<AmenitiesCounts>({ ...EMPTY_AMENITIES });
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [failMode, setFailMode] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const inspectionRef = useRef<HTMLTextAreaElement>(null);
  const cleanable = room.status === "VD" || room.status === "OD";
  const isTurnover = room.status === "VD";
  const ownsSession = room.inProgress && room.activeHousekeeperId === userId;
  const completed = room.status === "VC" || room.status === "OC";
  const errorId = `inspection-error-${room.id}`;

  function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cleanable || !ownsSession || (isTurnover && (!linenChanged || !towelChanged))) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("roomId", String(room.id));
    formData.set("linenChanged", String(linenChanged));
    formData.set("towelChanged", String(towelChanged));
    for (const { key } of AMENITIES_ITEMS) {
      const count = amenities[key];
      if (count !== null) formData.set(key, String(count));
    }
    run(() => finishMobileCleaning(formData), "Cleaning completed", () => {
      setLinenChanged(false);
      setTowelChanged(false);
      setAmenities({ ...EMPTY_AMENITIES });
      form.reset();
    });
  }

  function inspect(passed: boolean) {
    setFailMode(!passed);
    setInspectionError(null);
    if (!passed && !inspectionNotes.trim()) {
      const message = "A reason is required for a failed inspection";
      setInspectionError(message);
      toast.error(message);
      inspectionRef.current?.focus();
      return;
    }
    run(
      () => inspectMobileRoom(room.id, passed, inspectionNotes.trim() || undefined),
      passed ? "Inspection passed" : "Inspection failed. The room needs to be cleaned again.",
    );
  }

  return (
    <article aria-label={`Room tasks ${room.number}`} aria-busy={isPending} className="relative min-w-0 max-w-full space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <MobileRoomSummary room={room} />
      {room.inProgress && !ownsSession ? (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
          Another attendant is cleaning this room. Only the attendant who started the session can complete it.
        </p>
      ) : room.inProgress && cleanable ? (
        <form onSubmit={finish} className="space-y-3">
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-blue-800">Your cleaning session is in progress</p>
            {room.startedAt ? <CleaningTimer startedAt={room.startedAt} /> : null}
          </div>
          <p className="text-xs text-slate-600">
            {isTurnover ? "Bed linen and towels must be replaced in VD rooms." : "Select any bed linen or towels replaced (optional)."}
          </p>
          <fieldset disabled={isPending} className="relative min-w-0 space-y-2">
            <legend className="sr-only">Room supply replacements</legend>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" name="linenChanged" checked={linenChanged} onChange={(event) => setLinenChanged(event.target.checked)} required={isTurnover} className="size-5 shrink-0 accent-slate-900" />
              Bed linen replaced{isTurnover ? " *" : ""}
            </label>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" name="towelChanged" checked={towelChanged} onChange={(event) => setTowelChanged(event.target.checked)} required={isTurnover} className="size-5 shrink-0 accent-slate-900" />
              Towels replaced{isTurnover ? " *" : ""}
            </label>
            <label className="block space-y-2 text-sm">
              <span>Cleaning notes (optional)</span>
              <Textarea name="note" maxLength={500} className="min-h-24 w-full min-w-0 text-base" />
            </label>
          </fieldset>
          <fieldset disabled={isPending} className="min-w-0 space-y-3">
            <legend className="mb-2 text-sm font-semibold">Room Amenities (optional)</legend>
            {AMENITIES_ITEMS.map(({ key, label }) => (
              <AmenitiesStepper
                key={key}
                label={label}
                value={amenities[key]}
                onChange={(value) => setAmenities((current) => ({ ...current, [key]: value }))}
              />
            ))}
          </fieldset>
          <Button type="submit" disabled={isPending || (isTurnover && (!linenChanged || !towelChanged))} className="min-h-12 w-full whitespace-normal">
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
            Complete Cleaning
          </Button>
        </form>
      ) : cleanable ? (
        <Button disabled={isPending} onClick={() => run(() => startMobileCleaning(room.id), "Cleaning started")} className="min-h-12 w-full">
          {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
          Start Cleaning
        </Button>
      ) : room.status === "VCU" && !room.inProgress ? (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold">Awaiting inspection</p>
          <label className="block space-y-2 text-sm">
            <span>{failMode ? "Reason for failed inspection *" : "Inspection notes (optional if passed)"}</span>
            <Textarea ref={inspectionRef} maxLength={500} value={inspectionNotes} onChange={(event) => setInspectionNotes(event.target.value)} disabled={isPending} required={failMode} aria-invalid={Boolean(inspectionError)} aria-describedby={inspectionError ? errorId : undefined} className="min-h-24 w-full min-w-0 text-base" />
          </label>
          <p className="text-xs text-slate-600">A reason is required if the inspection fails.</p>
          {inspectionError ? <p id={errorId} role="alert" className="text-sm text-red-700">{inspectionError}</p> : null}
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <Button disabled={isPending} onClick={() => inspect(true)} className="h-auto min-h-12 w-full min-w-0 flex-wrap whitespace-normal px-2 py-2 leading-snug desktop:h-auto">
              {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
              <span className="min-w-0">Pass Inspection (VC)</span>
            </Button>
            <Button variant="outline" disabled={isPending} onClick={() => inspect(false)} className="h-auto min-h-12 w-full min-w-0 flex-wrap whitespace-normal px-2 py-2 leading-snug desktop:h-auto">
              {isPending ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : null}
              <span className="min-w-0">Requires Recleaning (VD)</span>
            </Button>
          </div>
        </div>
      ) : completed && !room.inProgress ? (
        <p className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800"><Check className="size-4 shrink-0" aria-hidden="true" />Cleaning complete</p>
      ) : (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Cleaning is not available for this room status. Check the room details or contact a supervisor.</p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Button variant="outline" disabled={isPending} onClick={() => onReportFound(room.id)} className="h-auto min-h-12 min-w-0 flex-1 whitespace-normal py-2 desktop:h-auto"><Plus aria-hidden="true" />Report Found Item</Button>
        <Link href={`/app/hk/rooms/${room.id}`} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium text-slate-600 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">Room details</Link>
      </div>
    </article>
  );
}

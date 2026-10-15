"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PRIORITY_CONFIG } from "@/lib/housekeeping-priority";
import { createHousekeepingTaskNote } from "./actions";
import { TASK_NOTE_CATEGORIES, TASK_NOTE_CATEGORY_LABELS } from "./task-note-schema";
import type { HousekeeperOption } from "./inline-housekeeper-select";

export type TaskNoteRoomOption = {
  id: number;
  number: string;
  typeName: string;
  priority: keyof typeof PRIORITY_CONFIG | null;
};
export type RoomTaskNoteDialogProps = {
  rooms: TaskNoteRoomOption[];
  housekeepers: HousekeeperOption[];
  todayIso: string;
  defaultRoomId?: number;
};

export function RoomTaskNoteDialog({ rooms, housekeepers, todayIso, defaultRoomId }: RoomTaskNoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState(defaultRoomId?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  const room = rooms.find((item) => item.id.toString() === roomId);
  const priority = room?.priority ? PRIORITY_CONFIG[room.priority] : null;
  const controlClass = "mt-1 h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-ring disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (pending) return;
      setOpen(next);
      if (next) { setRoomId(defaultRoomId?.toString() ?? ""); setError(null); }
    }}>
      <DialogTrigger render={<Button variant={defaultRoomId ? "outline" : "default"} size="sm" />}>
        <Plus className="size-4" aria-hidden="true" />
        Record Task
        {defaultRoomId && <span className="sr-only"> room {rooms.find((item) => item.id === defaultRoomId)?.number}</span>}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Record Room Task</DialogTitle>
          <DialogDescription>Notes and optional assignments are saved for today ({todayIso}), not the date shown on the board. Priority is calculated automatically and cannot be changed.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" aria-busy={pending} onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          if (!data.get("housekeeperId")) data.delete("housekeeperId");
          setError(null);
          startTransition(async () => {
            const toastId = toast.loading("Saving task notes...");
            try {
              const result = await createHousekeepingTaskNote(data);
              if (!result.ok) {
                setError(result.error);
                toast.error(result.error, { id: toastId });
                return;
              }
              toast.success("Today's task notes saved", { id: toastId });
              setOpen(false);
              router.refresh();
            } catch {
              const message = "Unable to save task notes. Please try again.";
              setError(message);
              toast.error(message, { id: toastId });
            }
          });
        }}>
          <fieldset disabled={pending} className="space-y-4">
            <div>
              <label htmlFor={`${id}-room`} className="text-sm font-medium">Room</label>
              <select id={`${id}-room`} name="roomId" value={roomId} onChange={(event) => setRoomId(event.target.value)} required className={controlClass}>
                <option value="">Select a room</option>
                {rooms.map((item) => <option key={item.id} value={item.id}>{item.number} · {item.typeName}</option>)}
              </select>
            </div>
            <div aria-live="polite" className="rounded-md bg-muted p-3 text-sm">
              <span className="mr-2 font-medium">Today’s priority</span>
              {priority ? <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priority.className}`}>{room?.priority} · {priority.label}</span> : <span className="text-muted-foreground">{room ? "Not available yet" : "Select a room first"}</span>}
            </div>
            <div>
              <label htmlFor={`${id}-category`} className="text-sm font-medium">Category</label>
              <select id={`${id}-category`} name="category" required defaultValue="" className={controlClass}>
                <option value="">Select a category</option>
                {TASK_NOTE_CATEGORIES.map((category) => <option key={category} value={category}>{TASK_NOTE_CATEGORY_LABELS[category]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-note`} className="text-sm font-medium">Task notes</label>
              <textarea id={`${id}-note`} name="note" required minLength={3} maxLength={2000} rows={4} className={`${controlClass} h-auto py-3`} placeholder="Describe the task to be completed..." />
            </div>
            <div>
              <label htmlFor={`${id}-housekeeper`} className="text-sm font-medium">Attendant (optional)</label>
              <select id={`${id}-housekeeper`} name="housekeeperId" defaultValue="" className={controlClass}>
                <option value="">Keep current assignment</option>
                {housekeepers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || !roomId}>{pending ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

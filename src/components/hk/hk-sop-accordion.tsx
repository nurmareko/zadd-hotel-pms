const roomStatuses = [
  { code: "VC", label: "Vacant Clean", description: "A vacant, clean room ready for sale after passing inspection.", color: "bg-emerald-100 text-emerald-800" },
  { code: "OC", label: "Occupied Clean", description: "An occupied room that has been cleaned.", color: "bg-blue-100 text-blue-800" },
  { code: "VD", label: "Vacant Dirty", description: "A vacant room that requires cleaning before reuse.", color: "bg-amber-100 text-amber-800" },
  { code: "OD", label: "Occupied Dirty", description: "An occupied room that requires cleaning.", color: "bg-orange-100 text-orange-800" },
  { code: "VCU", label: "Clean, Awaiting Inspection", description: "A vacant room that has been cleaned but is not ready for sale until it passes inspection.", color: "bg-purple-100 text-purple-800" },
  { code: "OOO", label: "Out of Order", description: "A damaged room or one requiring repairs that cannot be sold.", color: "bg-red-100 text-red-800" },
  { code: "OOS", label: "Out of Service", description: "A room temporarily withdrawn from operations or service.", color: "bg-slate-100 text-slate-700" },
];

const summaryClass = "min-h-12 cursor-pointer rounded-md px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const listClass = "list-decimal space-y-2 pl-5";
const contentClass = "px-4 pb-4 text-sm leading-6 text-muted-foreground";

export function HkSopAccordion() {
  return (
    <section aria-label="Housekeeping SOP Guide" className="mt-6 min-w-0 rounded-lg border border-border bg-card shadow-sm">
      <header className="border-b border-border px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">Housekeeping SOP Guide</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open the guide for your task. Record the actual work completed on the cleaning form.</p>
      </header>
      <div className="divide-y divide-border">
        <details>
          <summary className={summaryClass}>Departure cleaning SOP · VD → VCU</summary>
          <div className={contentClass}>
            <ol className={listClass}>
              <li>Confirm that the guest has checked out, the room status is VD and you are the assigned attendant. Start the cleaning session in the app.</li>
              <li>Check for belongings left behind and report any found items. Remove soiled linen and rubbish, clean all surfaces and floors, sanitise the bathroom and make the bed with clean linen.</li>
              <li><strong className="text-foreground">Bed linen and towels must be replaced</strong> with clean items. Mark both replacements only after completing them.</li>
              <li>Replenish and arrange amenities according to the placement guide. Check cleanliness, supplies and working facilities; record any shortages or damage.</li>
              <li>Complete cleaning to set the room to VCU. The room is not yet ready for sale: a passed inspection changes VCU → VC; if it fails, return it to VD with a reason for recleaning.</li>
            </ol>
          </div>
        </details>
        <details>
          <summary className={summaryClass}>Stayover cleaning SOP · OD → OC</summary>
          <div className={contentClass}>
            <ol className={listClass}>
              <li>Check your assignment, knock, ask permission to enter and respect Do Not Disturb signs. Do not move guests’ personal belongings without permission.</li>
              <li>Start the cleaning session in the app. Make the bed, remove rubbish and clean surfaces, the bathroom and floors.</li>
              <li>Replace towels at the guest’s request or when left on the floor. Replace bed linen as needed or requested. Record only replacements actually made.</li>
              <li>Replenish used amenities and record any shortages, damage or guest requests.</li>
              <li>Complete cleaning to change OD → OC. The guest remains in-house; this workflow does not use the VCU vacant-room inspection.</li>
            </ol>
          </div>
        </details>
        <details>
          <summary className={summaryClass}>Amenity Placement Standards</summary>
          <div className={contentClass}>
            <ul className="list-disc space-y-2 pl-5">
              <li>Clean towels: fold neatly and place on the bathroom towel shelf or rail, separate from soiled towels.</li>
              <li>Soap and shampoo: arrange neatly in a clean, dry tray or toiletry area.</li>
              <li>Toothbrush and toothpaste: place in unopened packaging in a dry area near the washbasin.</li>
              <li>Bottled water: provide <strong className="text-foreground">2 complimentary bottles of water</strong> with intact seals on the table or refreshment tray, alongside clean glasses.</li>
              <li>Check cleanliness, seals and expiry dates. Record the actual quantities replaced or replenished; do not estimate.</li>
            </ul>
          </div>
        </details>
        <details>
          <summary className={summaryClass}>Room Status Glossary</summary>
          <dl className="space-y-4 px-4 pb-4 text-sm">
            {roomStatuses.map(({ code, label, description, color }) => (
              <div key={code}>
                <dt className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${color}`}>{code}</span>
                  {label}
                </dt>
                <dd className="mt-1 leading-6 text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  );
}

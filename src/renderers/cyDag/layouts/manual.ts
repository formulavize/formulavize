import { CyLayoutProvider, LayoutOptionSpec } from "./types";
import { SHARED_OPTIONS } from "./optionParsers";

// https://js.cytoscape.org/#layouts/preset
// 'manual' hands placement to the user, so it runs cytoscape's 'preset' layout,
// which leaves every node exactly where it already is. Only the options preset
// understands are exposed; it has no notion of node dimensions or spacing.
// 'positions', 'zoom' and 'pan' are omitted because they take coordinates,
// which belong to the dragged graph rather than to the recipe.
const MANUAL_OPTIONS: LayoutOptionSpec[] = SHARED_OPTIONS.filter(
  (spec) => spec.directiveKey !== "nodeDimensionsIncludeLabels",
);

export const manualLayout: CyLayoutProvider = {
  layoutName: "manual",
  cyLayoutTargetName: "preset",
  // Refitting the viewport every time the recipe changes would fight the user
  // for control of the view, which is the one thing manual mode is for.
  defaultOptions: { fit: false },
  options: MANUAL_OPTIONS,
  // Nothing places these nodes but the user, so they have to be draggable
  // whatever the caller asked for, and their arrangement lives only in the
  // graph — a rebuild has to carry it across by element id.
  nodesAlwaysGrabbable: true,
  preservesPositions: true,
};

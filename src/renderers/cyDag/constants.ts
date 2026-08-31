// Identifier this renderer answers to in a '^<name>{ }' directive.
export const CYTOSCAPE_RENDERER_NAME: string = "cytoscape";

// Directive property selecting which cytoscape layout runs. The options each
// layout accepts are named by its own provider (see ./layouts) rather than
// declared here, so a layout can be added without touching this file.
export const LAYOUT_PROPERTY: string = "layout";

// Directive property filling the drawing surface, in the editor view and in
// exported images alike.
export const BACKGROUND_COLOR_PROPERTY: string = "background-color";

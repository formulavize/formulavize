export const defaultCubic = `\
/* Welcome to Formulavize! */

// The Default Cubic:
icons @ "https://formulavize.github.io/fiz-tutorial-imports/shapes.fiz"
*node{
  text-valign: "center"
  text-halign: "center"
  font-family: "math"
  color: "black"
}
*edge{
  line-color: "silver"
  target-arrow-color: "silver"
}
%v{ background-color: #80ebff }
%multiply{ background-color: #33acff; label: "×";}

v_squared = multiply(v(), v())
v_cubed = multiply(v_squared, v())
output(v_cubed) {
  label: ""
  shape: "round-rectangle"
  #icons.cube
}
`;

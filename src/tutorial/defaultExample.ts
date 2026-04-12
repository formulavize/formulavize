export const defaultCubic = `\
/* Welcome to Formulavize! */

// The Default Cubic:
*node {
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
%output{ shape: "round-rectangle"; font-size: 10 }

v_squared = multiply(v(), v())
v_cubed = multiply(v_squared, v())
output(v_cubed)
`;

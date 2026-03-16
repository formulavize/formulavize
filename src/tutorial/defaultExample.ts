export const defaultCubic = `\
/* Welcome to Formulavize! */

// The Default Cubic:
#centered { text-valign: "center" ; text-halign: "center" }
%multiply{
  #centered
  label: "×"
  background-color: #33acff
}
%v{
  #centered
  font-family: "math"
  background-color: #80ebff
}

v_squared = multiply(v(), v())
v_cubed = multiply(v_squared, v())
output(v_cubed) { 
  #centered
  font-size: 10
  shape: "round-rectangle"
}
`;

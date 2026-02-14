import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────
// Prism Hybrid v3
//
// LEFT: Straight white beam particles converge toward
// a 3D wireframe icosahedron at center.
//
// CENTER: Slowly rotating icosahedron rendered as
// ASCII wireframe with depth-based brightness.
//
// RIGHT: Spectral ASCII wave field fans outward from
// the icosahedron, colored by exit angle.
// ─────────────────────────────────────────────────────

const CHARS = [" ", ".", "·", ":", "-", "=", "+", "*", "#", "%", "@"];

// ─── 4-stop spectral gradient ───
// Blue → Teal → Green → Amber
const SPECTRAL_STOPS = [
  [0x3B, 0x82, 0xF6],  // #3B82F6 blue
  [0x14, 0xB8, 0xA6],  // #14B8A6 teal
  [0x22, 0xC5, 0x5E],  // #22C55E green
  [0xF5, 0x9E, 0x0B],  // #F59E0B amber
];

function sampleGradient(t) {
  t = Math.max(0, Math.min(1, t));
  const n = SPECTRAL_STOPS.length - 1;
  const idx = t * n;
  const i = Math.min(Math.floor(idx), n - 1);
  const frac = idx - i;
  const a = SPECTRAL_STOPS[i], b = SPECTRAL_STOPS[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

// ─── Icosahedron wireframe mesh (from OBJ) ───
// 444 vertices, 360 triangle faces — tube geometry around icosahedron edges
const MV = new Float32Array([0.031,-0.095,-0.962,0.059,-0.043,-0.98,0.683,-0.496,-0.503,0.632,-0.532,-0.503,0.059,-0.043,-0.98,0.1,0.0,-0.962,0.702,-0.437,-0.503,0.683,-0.496,-0.503,-0.081,-0.059,-0.962,-0.022,-0.069,-0.98,-0.261,-0.802,-0.503,-0.311,-0.766,-0.503,-0.022,-0.069,-0.98,0.031,-0.095,-0.962,-0.199,-0.802,-0.503,-0.261,-0.802,-0.503,-0.081,0.059,-0.962,-0.073,0.0,-0.98,-0.844,0.0,-0.503,-0.825,0.059,-0.503,-0.081,-0.059,-0.962,-0.825,-0.059,-0.503,0.031,0.095,-0.962,-0.022,0.069,-0.98,-0.261,0.802,-0.503,-0.199,0.802,-0.503,-0.022,0.069,-0.98,-0.081,0.059,-0.962,-0.311,0.766,-0.503,-0.261,0.802,-0.503,0.059,0.043,-0.98,0.683,0.496,-0.503,0.702,0.437,-0.503,0.059,0.043,-0.98,0.031,0.095,-0.962,0.632,0.532,-0.503,0.683,0.496,-0.503,-0.28,0.861,-0.341,-0.319,0.845,-0.386,-0.705,0.565,0.386,-0.652,0.591,0.403,-0.319,0.845,-0.386,-0.361,0.802,-0.403,-0.733,0.532,0.341,-0.705,0.565,0.386,-0.18,0.861,-0.403,-0.238,0.871,-0.386,0.238,0.871,0.386,0.28,0.861,0.341,0.18,0.861,0.403,-0.202,0.845,-0.458,0.66,0.565,-0.458,0.632,0.532,-0.503,0.652,0.591,-0.403,-0.333,0.802,-0.458,-0.866,0.069,-0.458,-0.875,0.095,-0.403,-0.311,0.766,-0.503,0.764,0.437,-0.403,0.755,0.496,-0.386,0.902,0.043,0.386,0.906,0.0,0.341,0.733,0.532,-0.341,0.875,0.095,0.403,0.741,0.453,-0.458,0.741,-0.453,-0.458,0.764,-0.437,-0.403,0.705,0.565,-0.386,0.319,0.845,0.386,0.361,0.802,0.403,0.705,0.565,-0.386,0.319,0.845,0.386,-0.906,0.0,-0.341,-0.902,-0.043,-0.386,-0.755,-0.496,0.386,-0.764,-0.437,0.403,-0.875,-0.095,-0.403,-0.733,-0.532,0.341,-0.902,0.043,-0.386,-0.755,0.496,0.386,-0.764,0.437,0.403,-0.866,-0.069,-0.458,-0.333,-0.802,-0.458,-0.361,-0.802,-0.403,-0.311,-0.766,-0.503,-0.28,-0.861,-0.341,-0.238,-0.871,-0.386,0.238,-0.871,0.386,0.18,-0.861,0.403,-0.18,-0.861,-0.403,0.28,-0.861,0.341,-0.319,-0.845,-0.386,-0.705,-0.565,0.386,-0.319,-0.845,-0.386,-0.652,-0.591,0.403,-0.705,-0.565,0.386,-0.202,-0.845,-0.458,0.66,-0.565,-0.458,0.652,-0.591,-0.403,0.632,-0.532,-0.503,0.733,-0.532,-0.341,0.755,-0.496,-0.386,0.902,-0.043,0.386,0.875,-0.095,0.403,0.705,-0.565,-0.386,0.319,-0.845,0.386,0.705,-0.565,-0.386,0.361,-0.802,0.403,0.319,-0.845,0.386,0.311,0.766,0.503,0.261,0.802,0.503,0.022,0.069,0.98,0.081,0.059,0.962,0.261,0.802,0.503,0.199,0.802,0.503,-0.031,0.095,0.962,0.022,0.069,0.98,0.333,0.802,0.458,0.866,0.069,0.458,0.311,0.766,0.503,0.825,0.059,0.503,0.202,0.845,0.458,-0.66,0.565,0.458,-0.632,0.532,0.503,-0.632,0.532,0.503,-0.683,0.496,0.503,-0.059,0.043,0.98,-0.031,0.095,0.962,-0.683,0.496,0.503,-0.702,0.437,0.503,-0.1,0.0,0.962,-0.059,0.043,0.98,-0.741,0.453,0.458,-0.741,-0.453,0.458,-0.702,-0.437,0.503,-0.683,-0.496,0.503,-0.059,-0.043,0.98,-0.683,-0.496,0.503,-0.632,-0.532,0.503,-0.031,-0.095,0.962,-0.059,-0.043,0.98,-0.632,-0.532,0.503,-0.66,-0.565,0.458,0.202,-0.845,0.458,0.199,-0.802,0.503,0.261,-0.802,0.503,0.022,-0.069,0.98,-0.031,-0.095,0.962,0.261,-0.802,0.503,0.311,-0.766,0.503,0.081,-0.059,0.962,0.022,-0.069,0.98,0.311,-0.766,0.503,0.333,-0.802,0.458,0.866,-0.069,0.458,0.825,-0.059,0.503,0.844,0.0,0.503,0.073,0.0,0.98,0.081,-0.059,0.962,0.081,0.059,0.962,0.1,0.0,-0.962,0.0,0.0,-1.0,-0.073,0.0,-0.98,-0.276,0.851,-0.447,-0.276,0.851,-0.447,-0.311,0.766,-0.503,-0.333,0.802,-0.458,0.724,0.526,-0.447,0.683,0.496,-0.503,0.724,0.526,-0.447,0.66,0.565,-0.458,0.652,0.591,-0.403,-0.894,0.0,-0.447,-0.276,-0.851,-0.447,-0.276,-0.851,-0.447,-0.333,-0.802,-0.458,-0.311,-0.766,-0.503,0.724,-0.526,-0.447,0.652,-0.591,-0.403,0.66,-0.565,-0.458,0.683,-0.496,-0.503,0.724,-0.526,-0.447,0.276,0.851,0.447,0.311,0.766,0.503,0.333,0.802,0.458,0.276,0.851,0.447,-0.724,0.526,0.447,-0.683,0.496,0.503,-0.724,0.526,0.447,-0.66,0.565,0.458,-0.652,0.591,0.403,-0.683,-0.496,0.503,-0.724,-0.526,0.447,-0.724,-0.526,0.447,-0.652,-0.591,0.403,-0.66,-0.565,0.458,0.333,-0.802,0.458,0.311,-0.766,0.503,0.276,-0.851,0.447,0.276,-0.851,0.447,0.894,0.0,0.447,0.0,0.0,1.0,0.073,0.0,0.98,-0.1,0.0,0.962,0.031,0.095,-0.962,-0.199,0.802,-0.503,-0.207,0.776,-0.467,0.022,0.069,-0.926,-0.199,0.802,-0.503,0.632,0.532,-0.503,0.624,0.506,-0.467,-0.207,0.776,-0.467,0.632,0.532,-0.503,0.031,0.095,-0.962,0.022,0.069,-0.926,0.624,0.506,-0.467,-0.081,0.059,-0.962,-0.825,0.059,-0.503,-0.802,0.043,-0.467,-0.059,0.043,-0.926,-0.825,0.059,-0.503,-0.311,0.766,-0.503,-0.288,0.75,-0.467,-0.802,0.043,-0.467,-0.311,0.766,-0.503,-0.081,0.059,-0.962,-0.059,0.043,-0.926,-0.288,0.75,-0.467,-0.081,-0.059,-0.962,-0.311,-0.766,-0.503,-0.288,-0.75,-0.467,-0.059,-0.043,-0.926,-0.311,-0.766,-0.503,-0.825,-0.059,-0.503,-0.802,-0.043,-0.467,-0.288,-0.75,-0.467,-0.825,-0.059,-0.503,-0.081,-0.059,-0.962,-0.059,-0.043,-0.926,-0.802,-0.043,-0.467,0.031,-0.095,-0.962,0.632,-0.532,-0.503,0.624,-0.506,-0.467,0.022,-0.069,-0.926,0.632,-0.532,-0.503,-0.199,-0.802,-0.503,-0.207,-0.776,-0.467,0.624,-0.506,-0.467,-0.199,-0.802,-0.503,0.031,-0.095,-0.962,0.022,-0.069,-0.926,-0.207,-0.776,-0.467,0.1,0.0,-0.962,0.702,0.437,-0.503,0.674,0.437,-0.467,0.072,0.0,-0.926,0.702,0.437,-0.503,0.702,-0.437,-0.503,0.674,-0.437,-0.467,0.674,0.437,-0.467,0.702,-0.437,-0.503,0.1,0.0,-0.962,0.072,0.0,-0.926,0.674,-0.437,-0.467,0.652,0.591,-0.403,-0.18,0.861,-0.403,-0.193,0.819,-0.394,0.638,0.549,-0.394,-0.18,0.861,-0.403,0.28,0.861,0.341,0.266,0.819,0.349,-0.193,0.819,-0.394,0.28,0.861,0.341,0.652,0.591,-0.403,0.638,0.549,-0.394,0.266,0.819,0.349,-0.361,0.802,-0.403,-0.875,0.095,-0.403,-0.838,0.069,-0.394,-0.325,0.776,-0.394,-0.875,0.095,-0.403,-0.733,0.532,0.341,-0.696,0.506,0.349,-0.838,0.069,-0.394,-0.733,0.532,0.341,-0.361,0.802,-0.403,-0.325,0.776,-0.394,-0.696,0.506,0.349,-0.875,-0.095,-0.403,-0.361,-0.802,-0.403,-0.325,-0.776,-0.394,-0.838,-0.069,-0.394,-0.361,-0.802,-0.403,-0.733,-0.532,0.341,-0.696,-0.506,0.349,-0.325,-0.776,-0.394,-0.733,-0.532,0.341,-0.875,-0.095,-0.403,-0.838,-0.069,-0.394,-0.696,-0.506,0.349,-0.18,-0.861,-0.403,0.652,-0.591,-0.403,0.638,-0.549,-0.394,-0.193,-0.819,-0.394,0.652,-0.591,-0.403,0.28,-0.861,0.341,0.266,-0.819,0.349,0.638,-0.549,-0.394,0.28,-0.861,0.341,-0.18,-0.861,-0.403,-0.193,-0.819,-0.394,0.266,-0.819,0.349,0.764,-0.437,-0.403,0.764,0.437,-0.403,0.719,0.437,-0.394,0.719,-0.437,-0.394,0.764,0.437,-0.403,0.906,0.0,0.341,0.861,0.0,0.349,0.719,0.437,-0.394,0.906,0.0,0.341,0.764,-0.437,-0.403,0.719,-0.437,-0.394,0.861,0.0,0.349,0.733,0.532,-0.341,0.361,0.802,0.403,0.325,0.776,0.394,0.696,0.506,-0.349,0.361,0.802,0.403,0.875,0.095,0.403,0.838,0.069,0.394,0.325,0.776,0.394,0.875,0.095,0.403,0.733,0.532,-0.341,0.696,0.506,-0.349,0.838,0.069,0.394,-0.28,0.861,-0.341,-0.652,0.591,0.403,-0.638,0.549,0.394,-0.266,0.819,-0.349,-0.652,0.591,0.403,0.18,0.861,0.403,0.193,0.819,0.394,-0.638,0.549,0.394,0.18,0.861,0.403,-0.28,0.861,-0.341,-0.266,0.819,-0.349,0.193,0.819,0.394,-0.906,0.0,-0.341,-0.764,-0.437,0.403,-0.719,-0.437,0.394,-0.861,0.0,-0.349,-0.764,-0.437,0.403,-0.764,0.437,0.403,-0.719,0.437,0.394,-0.719,-0.437,0.394,-0.764,0.437,0.403,-0.906,0.0,-0.341,-0.861,0.0,-0.349,-0.719,0.437,0.394,-0.28,-0.861,-0.341,0.18,-0.861,0.403,0.193,-0.819,0.394,-0.266,-0.819,-0.349,0.18,-0.861,0.403,-0.652,-0.591,0.403,-0.638,-0.549,0.394,0.193,-0.819,0.394,-0.652,-0.591,0.403,-0.28,-0.861,-0.341,-0.266,-0.819,-0.349,-0.638,-0.549,0.394,0.733,-0.532,-0.341,0.875,-0.095,0.403,0.838,-0.069,0.394,0.696,-0.506,-0.349,0.875,-0.095,0.403,0.361,-0.802,0.403,0.325,-0.776,0.394,0.838,-0.069,0.394,0.361,-0.802,0.403,0.733,-0.532,-0.341,0.696,-0.506,-0.349,0.325,-0.776,0.394,0.825,0.059,0.503,0.311,0.766,0.503,0.288,0.75,0.467,0.802,0.043,0.467,0.311,0.766,0.503,0.081,0.059,0.962,0.059,0.043,0.926,0.288,0.75,0.467,0.081,0.059,0.962,0.825,0.059,0.503,0.802,0.043,0.467,0.059,0.043,0.926,0.199,0.802,0.503,-0.632,0.532,0.503,-0.624,0.506,0.467,0.207,0.776,0.467,-0.632,0.532,0.503,-0.031,0.095,0.962,-0.022,0.069,0.926,-0.624,0.506,0.467,-0.031,0.095,0.962,0.199,0.802,0.503,0.207,0.776,0.467,-0.022,0.069,0.926,-0.702,0.437,0.503,-0.702,-0.437,0.503,-0.674,-0.437,0.467,-0.674,0.437,0.467,-0.702,-0.437,0.503,-0.1,0.0,0.962,-0.072,0.0,0.926,-0.674,-0.437,0.467,-0.1,0.0,0.962,-0.702,0.437,0.503,-0.674,0.437,0.467,-0.072,0.0,0.926,-0.632,-0.532,0.503,0.199,-0.802,0.503,0.207,-0.776,0.467,-0.624,-0.506,0.467,0.199,-0.802,0.503,-0.031,-0.095,0.962,-0.022,-0.069,0.926,0.207,-0.776,0.467,-0.031,-0.095,0.962,-0.632,-0.532,0.503,-0.624,-0.506,0.467,-0.022,-0.069,0.926,0.311,-0.766,0.503,0.825,-0.059,0.503,0.802,-0.043,0.467,0.288,-0.75,0.467,0.825,-0.059,0.503,0.081,-0.059,0.962,0.059,-0.043,0.926,0.802,-0.043,0.467,0.081,-0.059,0.962,0.311,-0.766,0.503,0.288,-0.75,0.467,0.059,-0.043,0.926]);
const MF = [0,1,2,0,2,3,4,5,6,4,6,7,8,9,10,8,10,11,12,13,14,12,14,15,16,17,18,16,18,19,17,20,21,17,21,18,22,23,24,22,24,25,26,27,28,26,28,29,5,30,31,5,31,32,33,34,35,33,35,36,37,38,39,37,39,40,41,42,43,41,43,44,45,46,47,45,47,48,46,37,49,46,49,47,25,50,51,25,51,52,50,45,53,50,53,51,42,54,55,42,55,56,54,57,19,54,19,55,58,59,60,58,60,61,59,62,63,59,63,60,32,64,65,32,65,6,64,58,66,64,66,65,62,67,68,62,68,69,70,53,48,70,48,71,72,73,74,72,74,75,73,76,77,73,77,74,56,78,79,56,79,43,78,72,80,78,80,79,76,81,82,76,82,83,81,21,84,81,84,82,85,86,87,85,87,88,86,89,90,86,90,87,83,91,92,83,92,77,93,85,94,93,94,95,89,96,97,89,97,98,96,14,99,96,99,97,100,101,102,100,102,103,101,66,61,101,61,102,98,104,105,98,105,90,106,100,107,106,107,108,109,110,111,109,111,112,113,114,115,113,115,116,69,117,118,69,118,63,117,119,120,117,120,118,114,121,122,114,122,123,121,49,40,121,40,122,124,125,126,124,126,127,128,129,130,128,130,131,129,132,133,129,133,134,132,80,75,132,75,133,134,135,136,134,136,130,137,138,139,137,139,140,141,142,143,141,143,144,142,94,88,142,88,143,144,145,146,144,146,147,148,149,150,148,150,151,152,153,154,152,154,155,153,107,103,153,103,154,155,156,157,155,157,158,156,120,159,156,159,157,33,160,1,33,1,161,1,0,9,1,9,161,9,8,162,9,162,161,162,27,26,162,26,161,26,34,33,26,33,161,54,42,41,54,41,163,38,37,46,38,46,164,46,45,50,46,50,164,50,25,24,50,24,164,24,165,166,24,166,164,67,62,59,67,59,167,59,58,64,59,64,167,64,32,31,64,31,167,168,52,51,168,51,169,170,171,67,170,67,167,81,76,73,81,73,172,73,72,78,73,78,172,78,56,55,78,55,172,55,19,18,55,18,172,18,21,81,18,81,172,96,89,86,96,86,173,86,85,93,86,93,173,91,83,82,91,82,174,175,176,15,175,15,173,15,14,96,15,96,173,65,66,101,65,101,177,101,100,106,101,106,177,106,178,179,106,179,177,97,99,180,97,180,181,7,6,65,7,65,177,121,114,113,121,113,182,113,183,184,113,184,182,117,69,68,117,68,185,71,48,47,71,47,182,47,49,121,47,121,182,132,129,128,132,128,186,187,123,122,187,122,188,189,190,44,189,44,186,44,43,79,44,79,186,79,80,132,79,132,186,142,141,191,142,191,192,135,134,133,135,133,193,133,75,74,133,74,193,74,77,92,74,92,193,92,194,195,92,195,193,196,197,145,196,145,198,145,144,143,145,143,198,143,88,87,143,87,198,87,90,105,87,105,198,108,107,153,108,153,199,118,120,156,118,156,200,156,155,154,156,154,200,154,103,102,154,102,200,102,61,60,102,60,200,60,63,118,60,118,200,140,139,151,140,151,201,151,150,202,151,202,201,202,112,111,202,111,201,111,127,126,111,126,201,126,203,140,126,140,201,204,205,206,204,206,207,208,209,210,208,210,211,212,213,214,212,214,215,216,217,218,216,218,219,220,221,222,220,222,223,224,225,226,224,226,227,228,229,230,228,230,231,232,233,234,232,234,235,236,237,238,236,238,239,240,241,242,240,242,243,244,245,246,244,246,247,248,249,250,248,250,251,252,253,254,252,254,255,256,257,258,256,258,259,260,261,262,260,262,263,264,265,266,264,266,267,268,269,270,268,270,271,272,273,274,272,274,275,276,277,278,276,278,279,280,281,282,280,282,283,284,285,286,284,286,287,288,289,290,288,290,291,292,293,294,292,294,295,296,297,298,296,298,299,300,301,302,300,302,303,304,305,306,304,306,307,308,309,310,308,310,311,312,313,314,312,314,315,316,317,318,316,318,319,320,321,322,320,322,323,324,325,326,324,326,327,328,329,330,328,330,331,332,333,334,332,334,335,336,337,338,336,338,339,340,341,342,340,342,343,344,345,346,344,346,347,348,349,350,348,350,351,352,353,354,352,354,355,356,357,358,356,358,359,360,361,362,360,362,363,364,365,366,364,366,367,368,369,370,368,370,371,372,373,374,372,374,375,376,377,378,376,378,379,380,381,382,380,382,383,384,385,386,384,386,387,388,389,390,388,390,391,392,393,394,392,394,395,396,397,398,396,398,399,400,401,402,400,402,403,404,405,406,404,406,407,408,409,410,408,410,411,412,413,414,412,414,415,416,417,418,416,418,419,420,421,422,420,422,423,424,425,426,424,426,427,428,429,430,428,430,431,432,433,434,432,434,435,436,437,438,436,438,439,440,441,442,440,442,443];
const NVERT = 444, NFACE = 360;

// ─── 3D rotation matrices ───
function rotateY(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c*v[0] + s*v[2], v[1], -s*v[0] + c*v[2]];
}
function rotateX(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c*v[1] - s*v[2], s*v[1] + c*v[2]];
}
function rotateZ(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c*v[0] - s*v[1], s*v[0] + c*v[1], v[2]];
}

// ─── Beam particle ───
class BeamParticle {
  constructor(x, y, vx, vy, brightness, life) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.brightness = brightness;
    this.life = life; this.maxLife = life;
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
  alive() { return this.life > 0 && this.x < 1.1; }
}

const DEFAULT_PARAMS = {
  // Icosahedron
  icoX: 0.36,
  icoY: 0.50,
  icoScale: 0.11,
  icoRotSpeedY: 0.15,
  icoRotSpeedX: 0.08,
  icoRotSpeedZ: 0.05,
  icoBrightness: 0.7,

  // Beam
  beamWidth: 0.015,
  beamRays: 4,
  beamSpeed: 0.010,
  beamGlow: 2,
  beamBrightness: 0.50,

  // Wave field
  waveFreq1: 34.0,
  waveFreq2: 26.0,
  waveSpeed: 1.0,
  waveSecondary: 0.30,
  ySquash: 0.45,

  // Spectral
  spectralSpread: 1.0,
  colorIntensity: 0.35,
  peakBoost: 0.15,

  // Global
  phaseStep: 0.08,
  speed: 1.0,
  falloff: 0.50,
  greyMin: 0.05,
  greyMax: 0.32,
  particleCount: 200,
  fontSize: 11,
  transitionWidth: 0.08,

  // Halo
  showHalo: true,
  haloPadX: 4,
  haloPadY: 2,
  haloFadeX: 12,
  haloFadeY: 5,

  titleText: "P R I S M",
  subText: "─── spectrum cli ───",
};

export default function PrismHybrid() {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0);
  const particlesRef = useRef([]);
  const spawnAccRef = useRef(0);

  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [showControls, setShowControls] = useState(false);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  const updateParam = (key, value) => setParams(p => ({ ...p, [key]: value }));
  const bg = [10, 9, 16];

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const size = params.fontSize;
    const [bgR, bgG, bgB] = bg;

    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(0, 0, w, h);

    const fontFamily = '"Cascadia Code","JetBrains Mono","Fira Code","SF Mono",monospace';
    ctx.font = `${size}px ${fontFamily}`;
    ctx.textBaseline = "top";

    const charW = size * 0.6;
    const charH = size * 1.2;
    const cols = Math.ceil(w / charW);
    const rows = Math.ceil(h / charH);
    const aspect = (charW / charH); // char aspect for Y correction

    phaseRef.current += params.phaseStep * params.speed;
    const phase = phaseRef.current;
    const numChars = CHARS.length;

    // ── Project mesh vertices ──
    const icoX = params.icoX, icoY = params.icoY;
    const scale = params.icoScale;
    const perspDist = 3.5;

    // Pre-compute rotation matrix
    const ay = phase * params.icoRotSpeedY;
    const ax = phase * params.icoRotSpeedX + 0.3;
    const az = phase * params.icoRotSpeedZ;

    // Project all 444 vertices
    const projX = new Float32Array(NVERT);
    const projY = new Float32Array(NVERT);
    const projZ = new Float32Array(NVERT);
    for (let i = 0; i < NVERT; i++) {
      let v = [MV[i*3], MV[i*3+1], MV[i*3+2]];
      v = rotateY(v, ay);
      v = rotateX(v, ax);
      v = rotateZ(v, az);
      const pf = perspDist / (perspDist + v[2]);
      projX[i] = icoX + v[0] * scale * pf;
      projY[i] = icoY + v[1] * scale * pf / aspect;
      projZ[i] = v[2];
    }

    // ── Rasterize mesh triangles into screen buffer ──
    // meshBuf stores brightness at each cell (0 = no mesh, >0 = mesh surface)
    const meshBuf = new Float32Array(rows * cols);
    const meshDepth = new Float32Array(rows * cols).fill(999);

    for (let fi = 0; fi < NFACE; fi++) {
      const i0 = MF[fi*3], i1 = MF[fi*3+1], i2 = MF[fi*3+2];
      // Screen-space coords (in col/row units)
      const x0 = projX[i0]*cols, y0 = projY[i0]*rows;
      const x1 = projX[i1]*cols, y1 = projY[i1]*rows;
      const x2 = projX[i2]*cols, y2 = projY[i2]*rows;
      const z0 = projZ[i0], z1 = projZ[i1], z2 = projZ[i2];

      // Back-face culling (screen-space cross product)
      const cross = (x1-x0)*(y2-y0) - (y1-y0)*(x2-x0);
      if (cross < 0) continue; // back-facing

      // Average depth for this face
      const avgZ = (z0 + z1 + z2) / 3;
      // Brightness: front faces brighter
      const bright = 0.3 + 0.7 * (perspDist / (perspDist + avgZ));

      // Bounding box
      const minX = Math.max(0, Math.floor(Math.min(x0,x1,x2)));
      const maxX = Math.min(cols-1, Math.ceil(Math.max(x0,x1,x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0,y1,y2)));
      const maxY = Math.min(rows-1, Math.ceil(Math.max(y0,y1,y2)));

      // Barycentric rasterization
      const denom = (y1-y2)*(x0-x2) + (x2-x1)*(y0-y2);
      if (Math.abs(denom) < 0.001) continue;
      const invDenom = 1 / denom;

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const w0 = ((y1-y2)*(px-x2) + (x2-x1)*(py-y2)) * invDenom;
          const w1 = ((y2-y0)*(px-x2) + (x0-x2)*(py-y2)) * invDenom;
          const w2 = 1 - w0 - w1;
          if (w0 >= -0.01 && w1 >= -0.01 && w2 >= -0.01) {
            const z = z0*w0 + z1*w1 + z2*w2;
            const idx = py * cols + px;
            if (z < meshDepth[idx]) {
              meshDepth[idx] = z;
              meshBuf[idx] = bright * params.icoBrightness;
            }
          }
        }
      }
    }

    // Entry and exit points for beam/wave
    const entryX = icoX - scale * 0.9;
    const entryY = icoY;
    const exitX = icoX + scale * 0.9;
    const exitY = icoY;

    // ── Update beam particles ──
    const particles = particlesRef.current;
    const dt = params.speed;
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update(dt);
      if (!particles[i].alive()) particles.splice(i, 1);
    }

    // ── Spawn beam particles (straight, no sweep) ──
    spawnAccRef.current += params.particleCount * 0.12 * dt;
    while (spawnAccRef.current >= 1 && particles.length < params.particleCount * 2) {
      spawnAccRef.current -= 1;

      for (let r = 0; r < params.beamRays; r++) {
        const rayOff = (r / Math.max(1, params.beamRays - 1) - 0.5) * params.beamWidth;
        const sx = -0.03 + Math.random() * 0.02;
        const sy = entryY + rayOff + (Math.random() - 0.5) * 0.008;

        const dx = entryX - sx;
        const dy = (entryY + rayOff * 0.15) - sy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const spd = params.beamSpeed * (0.8 + Math.random() * 0.4);

        particles.push(new BeamParticle(
          sx, sy,
          (dx / len) * spd, (dy / len) * spd,
          0.3 + Math.random() * 0.7,
          len / spd * 1.2,
        ));
      }
    }

    // ── Build beam light grid ──
    const beamGrid = new Float32Array(rows * cols);
    const glowR = params.beamGlow;

    for (const p of particles) {
      const lifeRatio = p.life / p.maxLife;
      const fade = Math.min(1, (1 - lifeRatio) * 5) * Math.min(1, lifeRatio * 4) * p.brightness * params.beamBrightness;
      const cx = Math.floor(p.x * cols);
      const cy = Math.floor(p.y * rows);

      for (let dy = -glowR; dy <= glowR; dy++) {
        const gy = cy + dy;
        if (gy < 0 || gy >= rows) continue;
        for (let dx = -glowR; dx <= glowR; dx++) {
          const gx = cx + dx;
          if (gx < 0 || gx >= cols) continue;
          const dist = Math.sqrt(dx * dx + (dy * 1.6) * (dy * 1.6) / 3);
          if (dist > glowR) continue;
          beamGrid[gy * cols + gx] += fade * Math.pow(Math.max(0, 1 - dist / glowR), 1.4);
        }
      }
    }

    // ── Title layout ──
    const titleText = params.titleText;
    const subText = params.subText;
    const centerRow = Math.floor(rows / 2);

    // Large title measurements
    const titleScale = 2.5;
    const titleFontSize = Math.round(size * titleScale);
    const titleCharW = titleFontSize * 0.6;
    const titlePixelW = titleText.length * titleCharW;
    const titlePixelX = (w - titlePixelW) / 2;
    const titleRowsSpan = Math.ceil((titleFontSize * 1.2) / charH);

    // Row positions (in grid coords)
    const titleTopRow = centerRow - Math.floor(titleRowsSpan / 2) - 1;
    const titleBottomRow = titleTopRow + titleRowsSpan - 1;
    const barRow = titleBottomRow + 1;     // gradient bar
    const subRow = barRow + 1;             // subtitle

    // Title column span (in grid cells)
    const titleColStart = Math.floor(titlePixelX / charW);
    const titleColEnd = Math.ceil((titlePixelX + titlePixelW) / charW);

    // Gradient bar dimensions — matches title width
    const barCharCount = Math.round(titlePixelW / charW);
    const barColStart = Math.floor((cols - barCharCount) / 2);
    const barColEnd = barColStart + barCharCount - 1;

    // Subtitle
    const subColStart = Math.floor((cols - subText.length) / 2);

    // Halo bounding box across all overlay elements
    let hR0 = 0, hR1 = 0, hC0 = 0, hC1 = 0;
    if (params.showHalo) {
      hR0 = titleTopRow;
      hR1 = subRow;
      hC0 = Math.min(titleColStart, barColStart, subColStart);
      hC1 = Math.max(titleColEnd, barColEnd, subColStart + subText.length - 1);
    }

    // ── Render every cell ──
    for (let row = 0; row < rows; row++) {
      const ny = row / rows;
      for (let col = 0; col < cols; col++) {
        const nx = col / cols;

        // ── Icosahedron mesh surface ──
        const meshIdx = row * cols + col;
        const totalIco = meshBuf[meshIdx];

        // Transition blend
        const transNorm = (nx - exitX) / Math.max(0.001, params.transitionWidth);
        const waveMix = Math.max(0, Math.min(1, transNorm));
        const beamMix = 1.0 - waveMix;

        // ── Wave field (right side) ──
        let waveR = 0, waveG = 0, waveB = 0, waveDensity = 0;

        if (waveMix > 0) {
          const wdx = nx - exitX;
          const wdy = (ny - exitY) * params.ySquash;
          const wDist = Math.sqrt(wdx * wdx + wdy * wdy);
          const wave1 = Math.sin(wDist * params.waveFreq1 - phase * params.waveSpeed) * 0.5 + 0.5;

          const wdx2 = nx - (exitX + 0.15);
          const wdy2 = (ny - exitY) * params.ySquash;
          const wDist2 = Math.sqrt(wdx2 * wdx2 + wdy2 * wdy2);
          const wave2 = Math.sin(wDist2 * params.waveFreq2 - phase * params.waveSpeed * 0.7) * 0.5 + 0.5;

          const combined = wave1 * (1.0 - params.waveSecondary) + wave2 * params.waveSecondary;
          const falloff = Math.max(0.10, 1.0 - wDist * params.falloff);
          waveDensity = combined * falloff;

          const angle = Math.atan2(ny - exitY, nx - exitX);
          const normalizedAngle = (angle / Math.PI) * params.spectralSpread;
          const gradientT = normalizedAngle * 0.5 + 0.5;
          const [sr, sg, sb] = sampleGradient(gradientT);

          const grey = params.greyMin + waveDensity * (params.greyMax - params.greyMin);
          const colorAmt = waveDensity * params.colorIntensity + Math.pow(waveDensity, 3) * params.peakBoost;

          waveR = bgR + grey * 255 + (sr - 128) * colorAmt;
          waveG = bgG + grey * 255 + (sg - 128) * colorAmt;
          waveB = bgB + grey * 255 + (sb - 128) * colorAmt;
        }

        // ── Beam (left side) ──
        let beamLR = bgR, beamLG = bgG, beamLB = bgB;
        let beamDensity = 0;

        if (beamMix > 0) {
          const bVal = beamGrid[row * cols + col];
          if (bVal > 0.01) {
            beamDensity = Math.min(1.0, bVal);
            const grey = params.greyMin + beamDensity * (params.greyMax - params.greyMin);
            beamLR = bgR + grey * 255 + (175 - 128) * beamDensity * 0.3;
            beamLG = bgG + grey * 255 + (172 - 128) * beamDensity * 0.3;
            beamLB = bgB + grey * 255 + (195 - 128) * beamDensity * 0.3;
          } else {
            const adx = nx - entryX;
            const ady = (ny - icoY) * params.ySquash;
            const aDist = Math.sqrt(adx * adx + ady * ady);
            const ambientWave = (Math.sin(aDist * 20 - phase * 0.4) * 0.5 + 0.5);
            const ambientDensity = ambientWave * 0.25 * Math.max(0.1, 1.0 - aDist * 0.8);
            beamDensity = ambientDensity;
            const grey = params.greyMin + ambientDensity * (params.greyMax - params.greyMin) * 0.5;
            beamLR = bgR + grey * 160;
            beamLG = bgG + grey * 160;
            beamLB = bgB + grey * 170;
          }
        }

        // ── Blend ──
        let density = beamDensity * beamMix + waveDensity * waveMix;
        let finalR = beamLR * beamMix + waveR * waveMix;
        let finalG = beamLG * beamMix + waveG * waveMix;
        let finalB = beamLB * beamMix + waveB * waveMix;

        // Add icosahedron mesh (blue #3B82F6, boosts density for ASCII visibility)
        if (totalIco > 0) {
          density = Math.max(density, totalIco * 0.85);
          finalR += totalIco * 59;
          finalG += totalIco * 130;
          finalB += totalIco * 246;
        }

        // ── Halo ──
        let haloMask = 1.0;
        if (params.showHalo) {
          const { haloPadX: px, haloPadY: py, haloFadeX: fx, haloFadeY: fy } = params;
          let ddx = 0, ddy = 0;
          if (col < hC0 - px) ddx = (hC0 - px - col) / fx;
          else if (col > hC1 + px) ddx = (col - hC1 - px) / fx;
          if (row < hR0 - py) ddy = (hR0 - py - row) / fy;
          else if (row > hR1 + py) ddy = (row - hR1 - py) / fy;
          const hd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (hd < 1.0) haloMask = hd;
        }

        let charIdx = Math.floor(density * numChars);
        charIdx = Math.max(0, Math.min(numChars - 1, charIdx));
        if (haloMask < 1.0) charIdx = Math.max(0, Math.round(charIdx * haloMask));

        const oR = Math.round(Math.min(255, Math.max(0, finalR * haloMask + bgR * (1 - haloMask))));
        const oG = Math.round(Math.min(255, Math.max(0, finalG * haloMask + bgG * (1 - haloMask))));
        const oB = Math.round(Math.min(255, Math.max(0, finalB * haloMask + bgB * (1 - haloMask))));

        ctx.fillStyle = `rgb(${oR},${oG},${oB})`;
        ctx.fillText(CHARS[charIdx], col * charW, row * charH);
      }
    }

    // ── Title (large, white) ──
    ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#e8e8f0";

    for (let i = 0; i < titleText.length; i++) {
      ctx.fillText(titleText[i], titlePixelX + i * titleCharW, titleTopRow * charH);
    }

    // ── Gradient bar ──
    ctx.font = `${size}px ${fontFamily}`;
    ctx.textBaseline = "top";
    for (let i = 0; i < barCharCount; i++) {
      const t = i / Math.max(1, barCharCount - 1);
      const [gr, gg, gb] = sampleGradient(t);
      ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
      ctx.fillText("━", (barColStart + i) * charW, barRow * charH);
    }

    // ── Subtitle ──
    ctx.fillStyle = `rgb(${bgR + 42},${bgG + 40},${bgB + 50})`;
    for (let i = 0; i < subText.length; i++) {
      const col = subColStart + i;
      if (col >= 0 && col < cols) ctx.fillText(subText[i], col * charW, subRow * charH);
    }

    // FPS
    frameCountRef.current++;
    const now = performance.now();
    if (now - lastTimeRef.current > 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    animRef.current = requestAnimationFrame(renderFrame);
  }, [params]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [renderFrame]);

  const Slider = ({ label, param, min, max, step }) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-right opacity-60 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step}
        value={params[param]} onChange={e => updateParam(param, parseFloat(e.target.value))}
        className="flex-1 h-1" style={{ accentColor: "#6a5a8a" }} />
      <span className="w-12 text-right font-mono opacity-40">{Number(params[param]).toFixed(2)}</span>
    </div>
  );

  return (
    <div className="w-full h-screen flex flex-col" style={{ background: "#030308" }}>
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-mono"
          style={{ background: "rgba(0,0,0,0.6)", color: "#3a3a50" }}>{fps} fps</div>
        <button onClick={() => setShowControls(!showControls)}
          className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs cursor-pointer"
          style={{ background: "rgba(0,0,0,0.6)", color: "#666", border: "1px solid #1a1a28" }}>
          {showControls ? "▼ Hide" : "▶ Tune"}
        </button>
      </div>

      {showControls && (
        <div className="shrink-0 p-3 space-y-3 overflow-y-auto"
          style={{ background: "#08080f", color: "#888", maxHeight: "55vh", borderTop: "1px solid #1a1a28" }}>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Icosahedron</div>
              <Slider label="X" param="icoX" min={0.2} max={0.5} step={0.01} />
              <Slider label="Y" param="icoY" min={0.3} max={0.7} step={0.01} />
              <Slider label="scale" param="icoScale" min={0.04} max={0.25} step={0.005} />
              <Slider label="rot Y spd" param="icoRotSpeedY" min={0} max={0.5} step={0.01} />
              <Slider label="rot X spd" param="icoRotSpeedX" min={0} max={0.5} step={0.01} />
              <Slider label="rot Z spd" param="icoRotSpeedZ" min={0} max={0.5} step={0.01} />
              <Slider label="brightness" param="icoBrightness" min={0.1} max={1.5} step={0.05} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">White Beam</div>
              <Slider label="width" param="beamWidth" min={0.01} max={0.12} step={0.005} />
              <Slider label="rays" param="beamRays" min={1} max={12} step={1} />
              <Slider label="speed" param="beamSpeed" min={0.003} max={0.02} step={0.001} />
              <Slider label="glow" param="beamGlow" min={1} max={6} step={1} />
              <Slider label="brightness" param="beamBrightness" min={0.1} max={0.8} step={0.05} />
              <Slider label="particles" param="particleCount" min={50} max={500} step={10} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Wave Field</div>
              <Slider label="freq 1" param="waveFreq1" min={10} max={60} step={0.5} />
              <Slider label="freq 2" param="waveFreq2" min={10} max={60} step={0.5} />
              <Slider label="wave speed" param="waveSpeed" min={0.3} max={2.5} step={0.05} />
              <Slider label="secondary" param="waveSecondary" min={0} max={0.6} step={0.05} />
              <Slider label="falloff" param="falloff" min={0} max={1.5} step={0.05} />
              <Slider label="transition" param="transitionWidth" min={0.02} max={0.2} step={0.01} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Spectral Color</div>
              <Slider label="spread" param="spectralSpread" min={0.3} max={2.0} step={0.05} />
              <Slider label="intensity" param="colorIntensity" min={0.05} max={0.7} step={0.05} />
              <Slider label="peak boost" param="peakBoost" min={0} max={0.4} step={0.02} />
              <Slider label="grey min" param="greyMin" min={0.02} max={0.15} step={0.005} />
              <Slider label="grey max" param="greyMax" min={0.15} max={0.5} step={0.01} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="text-xs font-semibold opacity-35 mb-1.5">Global</div>
              <Slider label="anim speed" param="phaseStep" min={0.02} max={0.2} step={0.005} />
              <Slider label="speed mult" param="speed" min={0.3} max={3} step={0.1} />
              <Slider label="y squash" param="ySquash" min={0.1} max={1} step={0.01} />
              <Slider label="font size" param="fontSize" min={6} max={16} step={1} />
            </div>

            <div className="space-y-1 p-2.5 rounded" style={{ background: "#0c0c15" }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-semibold opacity-35">Halo</div>
                <button onClick={() => updateParam("showHalo", !params.showHalo)}
                  className="px-2 py-0.5 rounded text-xs cursor-pointer"
                  style={{
                    background: params.showHalo ? "#18162a" : "#0a0a12",
                    color: params.showHalo ? "#7868a0" : "#444",
                    border: `1px solid ${params.showHalo ? "#2e2848" : "#151520"}`,
                  }}>{params.showHalo ? "ON" : "OFF"}</button>
              </div>
              <Slider label="pad X" param="haloPadX" min={0} max={15} step={1} />
              <Slider label="pad Y" param="haloPadY" min={0} max={8} step={1} />
              <Slider label="fade X" param="haloFadeX" min={1} max={30} step={1} />
              <Slider label="fade Y" param="haloFadeY" min={1} max={15} step={1} />
            </div>
          </div>

          {/* Spectrum preview */}
          <div className="p-2.5 rounded" style={{ background: "#0c0c15" }}>
            <div className="text-xs font-semibold opacity-35 mb-2">Spectral Fan</div>
            <div className="h-3 rounded overflow-hidden flex">
              {Array.from({ length: 40 }, (_, i) => {
                const t = i / 39;
                const [r, g, b] = sampleGradient(t);
                return <div key={i} className="flex-1" style={{ background: `rgb(${r},${g},${b})` }} />;
              })}
            </div>
          </div>

          <button onClick={() => setParams(DEFAULT_PARAMS)}
            className="px-3 py-1.5 rounded text-xs font-mono cursor-pointer"
            style={{ background: "#0e0e18", color: "#444", border: "1px solid #1a1a28" }}>
            ↺ Reset
          </button>
        </div>
      )}
    </div>
  );
}

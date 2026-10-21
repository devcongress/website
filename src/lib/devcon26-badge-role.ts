// A small dot-matrix alphabet keeps role lettering identical in canvas and SVG
// exports, without relying on a remotely loaded display font.
const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
};

export function badgeRoleDots(role: 'attendee' | 'speaker'): Array<{ x: number; y: number; radius: number }> {
  const label = role.toUpperCase();
  const pitch = 7;
  const radius = 2.35;
  const left = 944 - ((label.length * 6 - 2) * pitch + radius);
  const dots: Array<{ x: number; y: number; radius: number }> = [];

  Array.from(label).forEach((letter, index) => {
    GLYPHS[letter].forEach((row, rowIndex) => {
      Array.from(row).forEach((pixel, column) => {
        if (pixel === '1') dots.push({ x: left + (index * 6 + column) * pitch, y: 1195 + rowIndex * pitch, radius });
      });
    });
  });

  return dots;
}

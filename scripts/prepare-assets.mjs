import { mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const input = process.argv[2];
if (!input) throw new Error('Pass the directory containing the supplied designs.');
const prefix = 'ChatGPT Image Sep 13, 2026, ';
const cards = {
  angel: '12_06_10 AM.png',
  'thread-knight': '12_18_31 AM(1).png',
  'stage-spider': '12_22_00 AM.png',
  'thread-cutter': '12_26_03 AM(2).png',
  spotlight: '12_29_04 AM(1).png',
  'needle-pot': '12_34_55 AM(1).png',
  faceless: '12_47_40 AM(1).png',
  shader: '12_48_49 AM.png',
  weeper: '12_57_04 AM.png',
  'invade-1': '01_28_30 AM (1).png',
  'invade-2': '01_28_31 AM (2).png',
  'invade-3': '01_28_34 AM (3).png',
  'defence-1': '01_41_11 AM (1).png',
  'defence-2': '01_41_11 AM (2).png',
  'defence-3': '01_41_13 AM (5).png',
  'defence-5': '01_41_12 AM (3).png',
  'defence-10': '01_41_12 AM (4).png',
  'defence-20': '01_41_13 AM (6)(1).png',
  'black-box': '01_54_33 AM (1)(1).png',
  'no-strings-attached': '01_54_33 AM (2)(1).png',
  'pulling-the-strings': '02_05_57 AM (1).png',
  'loose-thread': '02_05_57 AM (2)(1).png',
};
mkdirSync('public/cards', { recursive: true });
mkdirSync('public/audio', { recursive: true });
for (const [name, file] of Object.entries(cards)) {
  execFileSync('convert', [join(input, prefix + file), '-resize', '768x1152>', '-quality', '90', `public/cards/${name}.webp`]);
}
for (const [name, file] of Object.entries({
  intro: 'Gemini_Generated_Image_528oyq528oyq528o(1).jfif',
  backdrop: 'Gemini_Generated_Image_wl8dywwl8dywwl8d.jfif',
})) execFileSync('convert', [join(input, file), '-quality', '92', `public/${name}.webp`]);
copyFileSync(join(input, 'astronautflute-the-creepy-circus-521971.mp3'), 'public/audio/creepy-circus.mp3');
copyFileSync(join(input, 'dragon-studio-sword-slice-393847.mp3'), 'public/audio/sword-slice.mp3');
console.log('Prepared 22 card faces, two backgrounds, and two audio tracks.');

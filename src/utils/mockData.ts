import { Resident } from '../types/dorm.ts';

const FIRST_NAMES = [
  '冠宇', '家豪', '子軒', '建廷', '柏翰', '承恩', '彥廷', '宇翔', '宗翰', '威廷',
  '俊傑', '冠廷', '志偉', '政達', '育誠', '文傑', '家銘', '智翔', '宏達', '博文',
  '信安', '凱文', '廷宇', '銘哲', '哲偉', '聖傑', '祐誠', '俊維', '奕廷', '子傑'
];

const LAST_NAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '洪', '郭', '邱', '曾', '廖', '賴', '徐'];

export function generateInitialMockResidents(): Resident[] {
  const residents: Resident[] = [];
  let studentIdCounter = 11527001;

  // 4th Floor: rooms 401 ~ 420 (including 416-2 specified by user)
  for (let r = 401; r <= 420; r++) {
    const room = r.toString();
    for (let b = 1; b <= 4; b++) {
      const bed = b.toString();
      const id = `${room}-${bed}`;
      
      let name: string;
      let studentId: string;
      let note: string | undefined = undefined;
      let tag: string | undefined = undefined;

      if (room === '416' && bed === '2') {
        name = '黃柏翰'; // Cadre
        studentId = '11527014';
        note = '宿舍樓長 / 幹部';
        tag = '樓長';
      } else if (room === '416' && bed === '1') {
        name = '張育誠';
        studentId = '11527013';
        tag = '副樓長';
      } else if (room === '401' && bed === '1') {
        name = '陳冠宇';
        studentId = '11527001';
        note = '全棟宿舍總舍長';
        tag = '舍長';
      } else if (room === '416' && bed === '3') {
        name = '林子軒';
        studentId = '11527015';
      } else if (room === '416' && bed === '4') {
        name = '陳家銘';
        studentId = '11527016';
      } else {
        const lastName = LAST_NAMES[(r * 7 + b * 13) % LAST_NAMES.length];
        const firstName = FIRST_NAMES[(r * 11 + b * 17) % FIRST_NAMES.length];
        name = `${lastName}${firstName}`;
        studentId = (studentIdCounter++).toString();
      }

      residents.push({
        id,
        room,
        bed,
        name,
        studentId,
        floor: '4',
        defaultNote: note,
        tag,
      });
    }
  }

  // 3rd Floor: rooms 301 ~ 315
  for (let r = 301; r <= 315; r++) {
    const room = r.toString();
    for (let b = 1; b <= 4; b++) {
      const bed = b.toString();
      const id = `${room}-${bed}`;
      const lastName = LAST_NAMES[(r * 5 + b * 9) % LAST_NAMES.length];
      const firstName = FIRST_NAMES[(r * 13 + b * 7) % FIRST_NAMES.length];
      const tag = (room === '301' && bed === '1') ? '樓長' : (room === '301' && bed === '2') ? '副樓長' : undefined;
      residents.push({
        id,
        room,
        bed,
        name: `${lastName}${firstName}`,
        studentId: (studentIdCounter++).toString(),
        floor: '3',
        tag,
      });
    }
  }

  // 2nd Floor: rooms 201 ~ 210
  for (let r = 201; r <= 210; r++) {
    const room = r.toString();
    for (let b = 1; b <= 4; b++) {
      const bed = b.toString();
      const id = `${room}-${bed}`;
      const lastName = LAST_NAMES[(r * 3 + b * 11) % LAST_NAMES.length];
      const firstName = FIRST_NAMES[(r * 7 + b * 5) % FIRST_NAMES.length];
      residents.push({
        id,
        room,
        bed,
        name: `${lastName}${firstName}`,
        studentId: (studentIdCounter++).toString(),
        floor: '2'
      });
    }
  }

  return residents;
}

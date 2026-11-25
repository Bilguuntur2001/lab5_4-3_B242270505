/**
 * README-ийн спецификацийн хүснэгтээс Postman Collection v2.1 JSON үүсгэнэ.
 * Гарсан файлыг Postman-д шууд Import хийж болно (File → Import).
 *
 *   node tools/build-collection.js
 *   → lab05-collection.json        (бүх oracle зөв)
 *   → lab05-collection-fail.json   (S01-ийн статус oracle-ыг зориуд 200 болгосон)
 *   → public-api-collection.json   (Даалгавар 5: jsonplaceholder)
 *
 * Тест бүр (folder) БИЕ ДААСАН: өөрийн оюутан/хичээлийг PUT-ээр өөрөө үүсгэнэ,
 * ID-ууд нь тест бүрд өвөрмөц (B_S01, CS313_S01 ...) тул дараалал, давталтаас үл хамаарна.
 */
const fs = require('fs');

const json = (o) => ({ mode: 'raw', raw: typeof o === 'string' ? o : JSON.stringify(o), options: { raw: { language: 'json' } } });
const req = (name, method, path, body, tests) => ({
  name,
  event: tests ? [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] : [],
  request: {
    method,
    header: [{ key: 'Content-Type', value: 'application/json' }],
    body: body === undefined ? undefined : json(body),
    url: { raw: `{{baseUrl}}${path}`, host: ['{{baseUrl}}'], path: path.split('/').filter(Boolean) },
  },
});
const putStudent = (id, status, taken) => req(`setup: PUT /students/${id}`, 'PUT', `/students/${id}`, { status, coursesTaken: taken });
const putCourse = (id, prereq) => req(`setup: PUT /courses/${id}`, 'PUT', `/courses/${id}`, { prerequisites: prereq });

// Oracle-ууд: статус код + result утга (+ нэмэлт)
const oracle = (status, result, extra = []) => [
  `pm.test("Статус ${status}", () => pm.response.to.have.status(${status}));`,
  `pm.test("result = ${result}", () => pm.expect(pm.response.json().result).to.eql("${result}"));`,
  ...extra,
];
const post = (body, tests) => req('POST /registrations', 'POST', '/registrations', body, tests);

function specs(happyStatus) {
  return [
    { name: 'S01 Идэвхтэй, урьдач хангасан оюутан бүртгүүлэхэд 201 OK', item: [
      putStudent('B_S01', 'active', ['CS201']), putCourse('CS313_S01', ['CS201']),
      post({ studentID: 'B_S01', courseID: 'CS313_S01' }, oracle(happyStatus, 'OK', [
        // registrationID-ийн яг утгыг БИШ, тоо эсэхийг шалгана (сервер in-memory, хуримтлагдана)
        'pm.test("registrationID нь эерэг тоо", () => { const id = pm.response.json().registrationID; pm.expect(id).to.be.a("number"); pm.expect(id).to.be.above(0); });',
      ])),
    ]},
    { name: 'S02 Байхгүй оюутан бүртгүүлэхэд ERROR_NO_STUDENT', item: [
      putCourse('CS313_S02', ['CS201']),
      post({ studentID: 'B_NOPE_S02', courseID: 'CS313_S02' }, oracle(200, 'ERROR_NO_STUDENT')),
    ]},
    { name: 'S03 Идэвхгүй оюутан бүртгүүлэхэд ERROR_INACTIVE_STUDENT', item: [
      putStudent('B_S03', 'inactive', ['CS201']), putCourse('CS313_S03', ['CS201']),
      post({ studentID: 'B_S03', courseID: 'CS313_S03' }, oracle(200, 'ERROR_INACTIVE_STUDENT')),
    ]},
    { name: 'S04 Байхгүй хичээлд бүртгүүлэхэд ERROR_NO_COURSE', item: [
      putStudent('B_S04', 'active', ['CS201']),
      post({ studentID: 'B_S04', courseID: 'CS_NOPE_S04' }, oracle(200, 'ERROR_NO_COURSE')),
    ]},
    { name: 'S05 Урьдач хичээл огт үзээгүй бол ERROR_PREREQUISITES (missing CS201)', item: [
      putStudent('B_S05', 'active', []), putCourse('CS313_S05', ['CS201']),
      post({ studentID: 'B_S05', courseID: 'CS313_S05' }, oracle(200, 'ERROR_PREREQUISITES', [
        'pm.test("missing = [CS201]", () => pm.expect(pm.response.json().missing).to.eql(["CS201"]));',
      ])),
    ]},
    { name: 'S06 Оюутан ч хичээл ч байхгүй бол ERROR_NO_STUDENT (давхар алдаа)', item: [
      post({ studentID: 'B_NOPE_S06', courseID: 'CS_NOPE_S06' }, oracle(200, 'ERROR_NO_STUDENT')),
    ]},
    { name: 'S07 Идэвхгүй ба урьдач дутуу бол ERROR_INACTIVE_STUDENT (давхар алдаа)', item: [
      putStudent('B_S07', 'inactive', []), putCourse('CS313_S07', ['CS201']),
      post({ studentID: 'B_S07', courseID: 'CS313_S07' }, oracle(200, 'ERROR_INACTIVE_STUDENT')),
    ]},
    { name: 'S08 Урьдачийн зарим нь дутуу бол зөвхөн дутууг (CS202) буцаана', item: [
      putStudent('B_S08', 'active', ['CS201']), putCourse('CS313_S08', ['CS201', 'CS202']),
      post({ studentID: 'B_S08', courseID: 'CS313_S08' }, oracle(200, 'ERROR_PREREQUISITES', [
        'pm.test("missing = [CS202]", () => pm.expect(pm.response.json().missing).to.eql(["CS202"]));',
      ])),
    ]},
    { name: 'S09 Урьдачгүй хичээлд хоосон coursesTaken-тай оюутан 201 OK', item: [
      putStudent('B_S09', 'active', []), putCourse('CS100_S09', []),
      post({ studentID: 'B_S09', courseID: 'CS100_S09' }, oracle(201, 'OK', [
        'pm.test("registrationID нь тоо", () => pm.expect(pm.response.json().registrationID).to.be.a("number"));',
      ])),
    ]},
    { name: 'S10 courseID дутуу бол 400 ERROR_BAD_REQUEST', item: [
      post({ studentID: 'B_S10' }, oracle(400, 'ERROR_BAD_REQUEST')),
    ]},
    { name: 'S11 studentID дутуу бол 400 ERROR_BAD_REQUEST', item: [
      post({ courseID: 'CS313' }, oracle(400, 'ERROR_BAD_REQUEST')),
    ]},
    { name: 'S12 Буруу JSON бол 400 ERROR_BAD_JSON', item: [
      post('{"studentID": "B_S12", bad json', oracle(400, 'ERROR_BAD_JSON')),
    ]},
  ];
}

const collection = (name, items, vars) => ({
  info: { name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: items,
  variable: vars,
});
const local = [{ key: 'baseUrl', value: 'http://localhost:3000' }];
const write = (f, c) => { fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n'); console.log('→', f); };

write('lab05-collection.json', collection('Lab05 — Хичээлд бүртгүүлэх API', specs(201), local));
// FAIL хувилбар: S01-ийн статус oracle-ыг ЗОРИУД буруу (201-ийн оронд 200) болгосон
write('lab05-collection-fail.json', collection('Lab05 — FAIL (S01 oracle зориуд буруу)', specs(200), local));

// Даалгавар 5: нийтийн API (GET-only, setup хэрэггүй)
write('public-api-collection.json', collection('Lab05 — Нийтийн API (jsonplaceholder)', [
  { name: 'GET /users', request: { method: 'GET', url: { raw: '{{publicUrl}}/users', host: ['{{publicUrl}}'], path: ['users'] } },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: [
      'pm.test("Статус 200", () => pm.response.to.have.status(200));',
      'pm.test("Хариу нь массив", () => pm.expect(pm.response.json()).to.be.an("array").that.is.not.empty);',
      'pm.test("Эхний хэрэглэгч Leanne Graham", () => pm.expect(pm.response.json()[0].name).to.eql("Leanne Graham"));',
    ] } }] },
], [{ key: 'publicUrl', value: 'https://jsonplaceholder.typicode.com' }]));

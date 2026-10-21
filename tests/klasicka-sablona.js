// Testy ovládání editoru a čtečky běží na „klasické“ šabloně (nadpisy sekcí vidět, malá písmena, zápatí),
// aby nezávisely na výchozí šabloně kapely (ta se může měnit podle toho, co kapela potřebuje).
const KLASICKA = {
  fontFamily: 'Arial', fontSize: 64, fontWeight: 700, lineHeight: 1.22, align: 'left', uppercase: false,
  sectionScale: 0.55, showSections: true, padX: 70, padY: 36, colGap: 70, stanzaGap: 0.55,
  singerText: true, singerBar: true, singerBarRight: false, singerBg: false, barWidth: 14, textBy: 'singer',
  minScale: 0.7, showFooter: true, headerSize: 30,
};
module.exports = page => page.evaluate(async t => { await Store.put('templates', Object.assign(Store.template('default'), t), { silent: true }); }, KLASICKA);

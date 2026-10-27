import assert from 'node:assert/strict';
import fs from 'node:fs';
import {marksFor,defaultAnchor,familyOrder,connectedFamily,yearDomain,clinicalWindow} from '../src/progress.ts';
const d=JSON.parse(fs.readFileSync(new URL('../data/pilot.json',import.meta.url),'utf8'));
const aube=d.molecules.find(m=>m.id==='aube00'),luna=d.molecules.find(m=>m.id==='luna18');
const marks=marksFor(aube,d.evidence,d.sources);
assert.equal(marks.find(x=>x.kind==='stage'&&x.evidence.id==='aube-phase1').date,'2025-06-05');
assert.equal(marks.find(x=>x.kind==='status').date,'2026-09-29','registry status is not backdated to trial start');
assert(!marks.some(x=>x.kind==='candidate'),'clinical entry does not invent PCC nomination');
assert(marks.some(x=>x.kind==='stage'&&x.label==='动物结果公开'&&x.basis.includes('公开日')));
const planned={...d.evidence[0],id:'planned',moleculeIds:[aube.id],stageClaim:'phase2',outcome:'planned'};
assert.equal(marksFor(aube,[planned],d.sources).length,0);
const candidate={...planned,id:'candidate',outcome:'reported',stageClaim:undefined,candidateClaim:true,date:'2024-06-01'};
assert.equal(marksFor(aube,[candidate],d.sources)[0].kind,'candidate');
assert.equal(defaultAnchor(d.molecules.filter(m=>m.targetIds.includes('kras'))).id,'aube00');
assert.equal(defaultAnchor([]),undefined);
assert.deepEqual([...connectedFamily('aube00',d.relations)].sort(),['ap8784-m','aube00','luna18']);
assert(!connectedFamily('aube00',[{...d.relations[1],type:'portfolio-shift'}]).has('luna18'));
assert.deepEqual(familyOrder([aube,luna,d.molecules.find(m=>m.id==='ap8784-m')],d.relations).map(m=>m.id),['ap8784-m','luna18','aube00']);
assert.deepEqual(yearDomain([], '2026-10-26'),{start:2024,end:2026});
console.log('Progress: dates, provenance, planned exclusions, explicit PCC, lineage and anchor checks passed.');

assert.deepEqual(clinicalWindow(marks),{start:'2025-06-05',end:'2026-09-29'});
assert.deepEqual(clinicalWindow(marksFor(luna,d.evidence,d.sources)),{start:'2021-10-08',end:'2025-07-24'});
assert.equal(clinicalWindow(marksFor(d.molecules.find(m=>m.id==='ap8784-m'),d.evidence,d.sources)),null);

const enl=d.molecules.find(m=>m.id==='enlicitide');
const cmc=marksFor(enl,d.evidence,d.sources).filter(m=>m.kind==='cmc');
assert.equal(cmc.length,7);
assert(cmc.every(m=>!m.evidence.stageClaim && !m.evidence.statusClaim));
assert.equal(defaultAnchor(d.molecules.filter(m=>m.targetIds.includes('il23r'))).id,'icotrokinra');

const hs=d.molecules.find(m=>m.id==='hs20118');
const hsMarks=marksFor(hs,d.evidence,d.sources);
assert(!hsMarks.some(m=>m.evidence.id==='hs20118-phase2-planned'),'estimated, not-yet-recruiting phase 2 is not completed progress');
assert(hsMarks.find(m=>m.evidence.id==='hs20118-license-announcement').basis.includes('披露日'));

/* Validate the raw YAML before Compose interpolation, as CasaOS ImportPanel does.
 * Port string behaviour checked against CasaOS-UI ComposeConfig.vue:
 * https://github.com/IceWhaleTech/CasaOS-UI/blob/main/src/components/Apps/ComposeConfig.vue
 * This regression does not claim a live installation through the CasaOS UI.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const YAML=require(process.env.CINEMA_YAML||'yaml'),checks=[];
function stringPort(item){
 const pattern=/(^(?<host>(\d{1,3}\.){1,3}\d{1,3}):?)?(?<published>(\d{1,5})(-(\d{1,5}))?)(:(?<target>(\d{1,5})(-(\d{1,5}))?))?(\/(?<protocol>.*)$)?/;
 const match=item.match(pattern)?.groups||{};
 return {target:Number(match.target?.split('-')?.[0]),published:match.published,protocol:match.protocol||'tcp'};
}
const broken=stringPort('${WEBUI_PORT:-8096}:8096/tcp');
assert(Number.isNaN(broken.target));assert.equal(broken.published,'8096');
checks.push({name:'The former raw port placeholder reproduces the reported numeric-host/NaN-container failure',passed:true});
for(const name of ['CasaOS-Import.yaml','CasaOS-Import-CPU.yaml','CasaOS-Import-Parallel.yaml','compose.yaml']){
 const raw=fs.readFileSync(path.join(__dirname,'../',name),'utf8'),doc=YAML.parse(raw);
 const port=doc.services.jellyfin.ports[0],expected=name.includes('Parallel')?8100:8096;
 assert(!raw.includes('WEBUI_PORT'));
 assert.equal(typeof port,'object');assert.equal(port.target,8096);assert.equal(port.protocol,'tcp');
 for(const row of doc.services.jellyfin.ports){
  assert.equal(typeof row,'object');assert(Number.isInteger(row.target)&&row.target>0&&row.target<=65535);
  assert(/^\d+$/.test(String(row.published)));assert(Number.isInteger(Number(row.published))&&Number(row.published)>0&&Number(row.published)<=65535);
  assert(['tcp','udp'].includes(row.protocol));
 }
 assert.equal(Number(port.published),expected);assert.equal(String(doc['x-casaos'].port_map),String(port.published));
 // Match the object branch's conversion and the numeric Vue container field.
 const imported={...port,published:port.published.toString()};
 assert.equal(Number(imported.target),8096);assert.equal(Number(imported.published),expected);
 assert.equal(Number.parseInt(imported.published,10),expected);
 checks.push({name:name+' imports literal numeric port objects and a matching Web UI port without variable resolution',passed:true});
}
const folder=process.env.CINEMA_REPORT_DIR||path.join(__dirname,'../test-results');fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(folder,'casaos-port-import.json'),JSON.stringify({passed:true,checks,scope:'Raw YAML parser and CasaOS numeric port conversion; confirms original placeholder regression plus all published templates; not a live CasaOS UI installation'},null,2)+'\n');
console.log('PASS '+checks.length+' raw CasaOS port import checks');

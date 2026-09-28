const LIMIT=20*1024**3,FILE_LIMIT=10*1024**3,COUNT=5000;
export function validateEntries(entries){
 if(entries.length>COUNT)throw new Error('A ZIP may contain at most 5,000 entries.');let total=0;const paths=new Set(),files=[];
 for(const e of entries){const p=e.filename.replace(/\/$/,'');if(!p||p.includes('\\')||p.includes(':')||p.startsWith('/')||p.split('/').some(s=>!s||s==='..'||s==='.'||/[\x00-\x1f<>"|?*]/.test(s)||/[. ]$/.test(s)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s)))throw new Error('The ZIP contains an unsafe file path.');if((e.externalFileAttributes>>>16&0xf000)===0xa000)throw new Error('ZIP symbolic links are not supported.');if(e.encrypted)throw new Error('Use an unencrypted ZIP for asset import.');const key=p.toLowerCase();if(paths.has(key))throw new Error('The ZIP contains duplicate file paths.');paths.add(key);if(e.directory)continue;
 if(p.split('/').some(s=>s.startsWith('.')||s==='__MACOSX'))continue;
 if(!Number.isSafeInteger(e.uncompressedSize)||e.uncompressedSize<0||e.uncompressedSize>FILE_LIMIT)throw new Error('A connected file may be at most 10 GB.');total+=e.uncompressedSize;if(total>LIMIT)throw new Error('The ZIP expands beyond the 20 GB import limit.');files.push(e);
 }
 const names=new Set(files.map(e=>e.filename.toLowerCase()));for(const e of files){let p=e.filename.toLowerCase();while(p.includes('/')){p=p.slice(0,p.lastIndexOf('/'));if(names.has(p))throw new Error('A ZIP file conflicts with a folder path.');}}return files;
}
export async function expandAssetZips(input,progress=()=>{}){
 const output=[];let total=0;
 for(const file of input){if(!/\.zip$/i.test(file.name)||file.webkitRelativePath){output.push(file);continue;}
 progress('Reading '+file.name+'…');await import('/vendor/zip/zip.js');const zip=globalThis.zip;zip.configure({useWebWorkers:false,wasmURI:'/vendor/zip/zip-module.wasm'});const reader=new zip.ZipReader(new zip.BlobReader(file),{useWebWorkers:false,strictness:'strict'});
 try{const entries=validateEntries(await reader.getEntries());const prefix=file.name.replace(/\.zip$/i,'');
 for(const entry of entries){total+=entry.uncompressedSize;if(total>LIMIT||output.length>=COUNT)throw new Error('Choose at most 5,000 files and 20 GB per import.');const name=entry.filename.split('/').pop(),path=prefix+'/'+entry.filename;
 const materialize=async()=>{progress('Unpacking '+name+'…');const check={checkSignature:true,useWebWorkers:false,onprogress:n=>{if(n>entry.uncompressedSize||n>FILE_LIMIT)throw new Error('A ZIP entry exceeds its declared size.');}};
 if(entry.uncompressedSize>128*1024**2){if(!navigator.storage?.getDirectory)throw new Error('This large ZIP needs a browser with temporary file storage. Try Chrome or Edge.');const root=await navigator.storage.getDirectory(),id='vault-zip-'+crypto.randomUUID(),h=await root.getFileHandle(id,{create:true});try{const writable=await h.createWritable();await entry.getData(writable,check);const data=await h.getFile();if(data.size!==entry.uncompressedSize)throw new Error('ZIP file size mismatch.');return {file:data,dispose:()=>root.removeEntry(id)};}catch(e){await root.removeEntry(id).catch(()=>{});throw e;}}
 const data=await entry.getData(new zip.BlobWriter(),check);if(data.size!==entry.uncompressedSize)throw new Error('ZIP file size mismatch.');return {file:data,dispose:async()=>{}};
 };
 output.push({name,size:entry.uncompressedSize,lastModified:entry.lastModDate?.getTime()||0,webkitRelativePath:path,materialize,async text(){if(entry.uncompressedSize>2*1024**2)throw new Error('An asset.json is too large.');const data=await materialize();try{return await data.file.text();}finally{await data.dispose();}}});
 }
 }finally{await reader.close();}}
 const seen=new Set();for(const f of output){const p=(f.webkitRelativePath||f.name).toLowerCase();if(seen.has(p))throw new Error('Selected files have duplicate paths.');seen.add(p);}return output;
}

// Quick SHA-256 test of the worker implementation
// Copied from public/sha256-worker.js — same algorithm, tested in Node.js

const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function rotr(x,n){return(x>>>n)|(x<<(32-n))}
function compress(H, block, off) {
  const w = new Uint32Array(64);
  const view = new DataView(block.buffer, off, 64);
  for (let i=0;i<16;i++) w[i]=view.getUint32(i*4,false);
  for (let i=16;i<64;i++){const s0=rotr(w[i-15],7)^rotr(w[i-15],18)^(w[i-15]>>>3);const s1=rotr(w[i-2],17)^rotr(w[i-2],19)^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0}
  let a=H[0],b=H[1],c=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];
  for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);const ch=(e&f)^(~e&g);const t1=(h+S1+ch+K[i]+w[i])|0;const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);const maj=(a&b)^(a&c)^(b&c);const t2=(S0+maj)|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0}
  H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+c)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;
}
class Sha256Hasher {
  constructor(){this.H=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.blockBuf=new Uint8Array(64);this.blockLen=0;this.totalLen=0}
  update(data){let offset=0;this.totalLen+=data.length;if(this.blockLen>0){const need=64-this.blockLen;const copy=Math.min(need,data.length);this.blockBuf.set(data.subarray(0,copy),this.blockLen);this.blockLen+=copy;offset=copy;if(this.blockLen===64){compress(this.H,this.blockBuf,0);this.blockLen=0}}while(offset+64<=data.length){this.blockBuf.set(data.subarray(offset,offset+64));compress(this.H,this.blockBuf,0);offset+=64}if(offset<data.length){const remaining=data.subarray(offset);this.blockBuf.set(remaining,0);this.blockLen=remaining.length}}
  digest(){const H=new Uint32Array(this.H);const block=new Uint8Array(128);block.set(this.blockBuf.subarray(0,this.blockLen));let len=this.blockLen;block[len++]=0x80;if(len>56){compress(H,block,0);block.fill(0,0,56);len=0}else{block.fill(0,len,56)}const totalBits=this.totalLen*8;const view=new DataView(block.buffer);view.setUint32(56,Math.floor(totalBits/0x100000000),false);view.setUint32(60,totalBits>>>0,false);compress(H,block,0);const out=new Uint8Array(32);const outView=new DataView(out.buffer);for(let i=0;i<8;i++)outView.setUint32(i*4,H[i],false);return Array.from(out).map(b=>b.toString(16).padStart(2,'0')).join('')}
}

const tests = [
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq', '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
];

let pass = 0;
for (const [input, expected] of tests) {
  const hasher = new Sha256Hasher();
  hasher.update(Buffer.from(input));
  const got = hasher.digest();
  const ok = got === expected;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(input).slice(0,30), got === expected ? '' : `got ${got} expected ${expected}`);
  if (ok) pass++;
}

// Test chunked input (simulates streaming)
const hasher2 = new Sha256Hasher();
hasher2.update(Buffer.from('abc'));
hasher2.update(Buffer.from('dbcdecdefdefg'));
hasher2.update(Buffer.from('efghfghighijhijkijkljklmklmnlmnomnopnopq'));
const chunkedResult = hasher2.digest();
const chunkedExpected = '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1';
console.log(chunkedResult === chunkedExpected ? 'PASS' : 'FAIL', 'chunked input', chunkedResult === chunkedExpected ? '' : `got ${chunkedResult}`);
if (chunkedResult === chunkedExpected) pass++;

console.log(`\n${pass}/4 tests passed`);
process.exit(pass === 4 ? 0 : 1);

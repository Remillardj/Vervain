import{c as n,r as c,d as u}from"./index-C3gGH1Qs.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=n("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);function y(r){const[h,e]=c.useState(void 0);return u(()=>{if(r){e({width:r.offsetWidth,height:r.offsetHeight});const a=new ResizeObserver(t=>{if(!Array.isArray(t)||!t.length)return;const d=t[0];let i,o;if("borderBoxSize"in d){const s=d.borderBoxSize,f=Array.isArray(s)?s[0]:s;i=f.inlineSize,o=f.blockSize}else i=r.offsetWidth,o=r.offsetHeight;e({width:i,height:o})});return a.observe(r,{box:"border-box"}),()=>a.unobserve(r)}else e(void 0)},[r]),h}export{z as T,y as u};

export const point = (x=0,y=0,z=0) => ({x,y,z});
export const add=(a,b)=>point(a.x+b.x,a.y+b.y,a.z+b.z);
export const sub=(a,b)=>point(a.x-b.x,a.y-b.y,a.z-b.z);
export const scale=(a,s)=>point(a.x*s,a.y*s,a.z*s);
export const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const length=a=>Math.hypot(a.x,a.y,a.z);
export const distance=(a,b)=>length(sub(a,b));
export const normalize=a=>scale(a,1/(length(a)||1));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function segmentDistance3D(a,b,c,d){
 const u=sub(b,a),v=sub(d,c),w=sub(a,c),A=dot(u,u),B=dot(u,v),C=dot(v,v),D=dot(u,w),E=dot(v,w);
 let s=0,t=0;
 if(A<1e-8&&C<1e-8)return distance(a,c);
 if(A<1e-8)t=clamp(E/C,0,1);
 else if(C<1e-8)s=clamp(-D/A,0,1);
 else{
  const den=A*C-B*B;s=den>1e-8?clamp((B*E-C*D)/den,0,1):0;t=(B*s+E)/C;
  if(t<0){t=0;s=clamp(-D/A,0,1);}else if(t>1){t=1;s=clamp((B-D)/A,0,1);}
 }
 return distance(add(a,scale(u,s)),add(c,scale(v,t)));
}
export function ik3D(a,b,l1,l2,bend){
 const delta=sub(b,a),raw=length(delta),n=normalize(delta),d=clamp(raw,.001,l1+l2-.01);
 let side=sub(bend,scale(n,dot(bend,n)));
 if(length(side)<.001)side=sub(point(0,0,1),scale(n,n.z));
 side=normalize(side);
 const along=(l1*l1+d*d-l2*l2)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 return add(a,add(scale(n,along),scale(side,height)));
}

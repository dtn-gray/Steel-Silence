import bpy, math, json, struct, base64, sys, argparse
from mathutils import Vector
from pathlib import Path

parser=argparse.ArgumentParser(description='Rebuild the original game-ready duelist mesh.')
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent.parent/'dist'/'human-data.js')
parser.add_argument('--blend',type=Path,help='Optionally save the fused sculpt as an editable Blender file.')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=args.output
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[]
def ellipsoid(name,center,radii):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=center)
 o=bpy.context.object;o.name=name;o.scale=radii;parts.append(o);return o

def tube(name,a,b,profiles):
 a,b=Vector(a),Vector(b);axis=(b-a).normalized();right=axis.cross(Vector((0,0,1))).normalized()
 if right.length<.1:right=axis.cross(Vector((1,0,0))).normalized()
 depth=axis.cross(right).normalized();verts=[];faces=[];N=16
 for t,rx,rz in profiles:
  center=a.lerp(b,t)
  for j in range(N):
   theta=j/N*math.tau;verts.append(tuple(center+right*(math.cos(theta)*rx)+depth*(math.sin(theta)*rz)))
 for k in range(len(profiles)-1):
  for j in range(N):faces.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
 faces.append(tuple(reversed(range(N))));faces.append(tuple((len(profiles)-1)*N+j for j in range(N)))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);parts.append(o)

# Tailored torso, defined by anatomical volumes rather than geometric limbs.
ellipsoid('pelvis',(0,1.00,0),(.166,.139,.118))
ellipsoid('waist',(0,1.17,-.003),(.153,.165,.110))
ellipsoid('ribcage',(0,1.385,-.004),(.198,.185,.130))
ellipsoid('upper_back',(0,1.465,.016),(.202,.091,.115))
for side in [-1,1]:
 ellipsoid('shoulder',(side*.160,1.482,0),(.104,.099,.100))
 ellipsoid('pectoral',(side*.082,1.399,-.049),(.107,.104,.101))
ellipsoid('neck',(0,1.624,.002),(.051,.091,.052))
# Sculpted skull, facial plane, cheekbones, jaw, nasal bridge and lips.
ellipsoid('skull',(0,1.825,.008),(.094,.126,.091))
ellipsoid('face',(0,1.792,-.029),(.081,.092,.072))
ellipsoid('jaw',(0,1.747,-.009),(.075,.053,.070))
ellipsoid('chin',(0,1.718,-.042),(.047,.027,.041))
for side in [-1,1]:
 ellipsoid('cheek',(side*.044,1.790,-.037),(.045,.040,.056))
 ellipsoid('brow',(side*.035,1.839,-.059),(.039,.016,.035))
 ellipsoid('ear',(side*.096,1.803,.006),(.017,.032,.015))
 ellipsoid('ear_lobe',(side*.097,1.779,.005),(.012,.016,.012))
ellipsoid('nose_bridge',(0,1.813,-.078),(.014,.042,.027))
ellipsoid('nose_tip',(0,1.788,-.106),(.021,.017,.025))
for side in [-1,1]:ellipsoid('nostril',(side*.013,1.780,-.098),(.013,.010,.017))
ellipsoid('upper_lip',(0,1.755,-.081),(.030,.006,.012))
ellipsoid('lower_lip',(0,1.744,-.080),(.027,.007,.012))

S=(.178,1.50,0);E=(.420,1.294,-.015);H=(.640,1.064,-.030)
for sign in [-1,1]:
 def mirror(p):return(sign*p[0],p[1],p[2])
 s,e,h=mirror(S),mirror(E),mirror(H)
 tube('upper_sleeve',s,e,[(0,.088,.089),(.18,.086,.083),(.5,.075,.077),(.82,.063,.065),(1,.060,.061)])
 ellipsoid('elbow',e,(.064,.066,.062))
 tube('fore_sleeve',e,h,[(0,.061,.062),(.22,.065,.065),(.60,.055,.054),(.84,.046,.047),(1,.044,.044)])
 ellipsoid('palm',h,(.046,.043,.029))
 for i,offset in enumerate([-.029,-.010,.010,.028]):
  a=(h[0]+sign*.025,h[1]+offset,h[2]-.006);b=(h[0]+sign*.049,h[1]+offset-.005,h[2]-.021);c=(h[0]+sign*.046,h[1]+offset-.009,h[2]-.003)
  tube('finger',a,b,[(0,.010,.010),(1,.009,.009)]);ellipsoid('knuckle',b,(.010,.011,.010));tube('finger_curl',b,c,[(0,.009,.009),(1,.007,.007)])
 thumb=(h[0]-sign*.003,h[1]-.032,h[2]-.025)
 tube('thumb',thumb,(h[0]+sign*.030,h[1]-.045,h[2]-.032),[(0,.014,.012),(1,.011,.010)])
 hip=(sign*.104,.974,0);knee=(sign*.130,.531,-.005);ankle=(sign*.140,.074,.015)
 tube('breeches',hip,knee,[(0,.109,.113),(.20,.109,.111),(.5,.095,.100),(.78,.077,.081),(1,.063,.068)])
 ellipsoid('knee',knee,(.065,.068,.067))
 tube('boot_leg',knee,ankle,[(0,.063,.067),(.20,.072,.075),(.42,.079,.079),(.70,.063,.066),(.90,.051,.053),(1,.048,.051)])
 ellipsoid('heel',(sign*.140,.062,.047),(.059,.066,.070))
 ellipsoid('instep',(sign*.140,.063,-.044),(.060,.058,.102))
 ellipsoid('toe',(sign*.140,.041,-.133),(.064,.038,.098))

print('Fusing sculpt volumes...',flush=True)
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);bpy.ops.object.join();body=bpy.context.object;body.name='Continuous_Duelist'
remesh=body.modifiers.new('Continuous sculpt','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.008;remesh.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=remesh.name)
smooth=body.modifiers.new('Relax surface','SMOOTH');smooth.factor=.48;smooth.iterations=3;bpy.ops.object.modifier_apply(modifier=smooth.name)
# Recess the eye sockets into the face so the eyes sit in an anatomical orbit.
for side in [-1,1]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=1,location=(side*.035,1.819,-.086));cut=bpy.context.object;cut.scale=(.025,.014,.018)
 bpy.context.view_layer.objects.active=cut;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.context.view_layer.objects.active=body;mod=body.modifiers.new('Orbital socket','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;mod.solver='EXACT';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
bpy.context.view_layer.objects.active=body
tri_count=sum(len(p.vertices)-2 for p in body.data.polygons)
dec=body.modifiers.new('Game topology','DECIMATE');dec.ratio=min(1,10500/tri_count);dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
tri=body.modifiers.new('Triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
mesh=body.data
# Small sculpted fabric folds, with no runtime cloth or high-resolution textures.
for v in mesh.vertices:
 p=v.co;x,y,z=p;ax=abs(x)
 amount=0
 if ax>.25 and 1.08<y<1.46:
  amount=.0015*math.sin(y*155+ax*24)*math.exp(-((y-1.27)/.12)**2)
 elif .2<y<.63:
  amount=.0018*math.sin(y*145+math.atan2(z,x)*3)*math.exp(-((y-.48)/.13)**2)
 elif 1.04<y<1.33 and ax<.18:
  amount=.0014*math.sin(x*70+y*27)*math.exp(-((y-1.12)/.11)**2)
 if amount:p+=v.normal*amount
 p.y=max(.004,p.y)
mesh.update()

bones=[
 ('hip',None,(0,.974,0),'spine'),('spine','hip',(0,1.24,0),'chest'),('chest','spine',(0,1.50,0),'neck'),('neck','chest',(0,1.633,0),'head'),('head','neck',(0,1.818,0),None),
 ('hipBack','hip',(-.104,.974,0),'kneeBack'),('kneeBack','hipBack',(-.130,.531,-.005),'ankleBack'),('ankleBack','kneeBack',(-.140,.074,.015),None),
 ('hipFront','hip',(.104,.974,0),'kneeFront'),('kneeFront','hipFront',(.130,.531,-.005),'ankleFront'),('ankleFront','kneeFront',(.140,.074,.015),None),
 ('shoulderBack','chest',(-.178,1.50,0),'offelbow'),('offelbow','shoulderBack',(-.420,1.294,-.015),'offhand'),('offhand','offelbow',(-.640,1.064,-.030),None),
 ('shoulder','chest',(.178,1.50,0),'elbow'),('elbow','shoulder',(.420,1.294,-.015),'hand'),('hand','elbow',(.640,1.064,-.030),None),
 ('coatBack','hip',(0,1.05,.08),None),('coatFront','hip',(0,1.05,-.08),None)]
ids={b[0]:i for i,b in enumerate(bones)}
def smoothstep(t):t=max(0,min(1,t));return t*t*(3-2*t)
def pair(a,b,t):t=smoothstep(t);return[(a,1-t),(b,t)]
def arm_t(x,y,z):
 p=Vector((abs(x),y,z));s=Vector(S);h=Vector(H);return max(0,min(1,(p-s).dot(h-s)/(h-s).length_squared))
def torso_weights(y):
 if y<1.24:return pair(ids['hip'],ids['spine'],(y-1.04)/.2)
 if y<1.53:return pair(ids['spine'],ids['chest'],(y-1.24)/.29)
 return pair(ids['chest'],ids['neck'],(y-1.53)/.11)
def weights(x,y,z):
 if y>1.62:return pair(ids['neck'],ids['head'],(y-1.66)/.095)
 if abs(x)>.16 and y>.98:
  side='Back' if x<0 else '';up=ids['shoulderBack' if side else 'shoulder'];fore=ids['offelbow' if side else 'elbow'];hand=ids['offhand' if side else 'hand'];t=arm_t(x,y,z)
  if t<.42:arm=[(up,1)]
  elif t<.60:arm=pair(up,fore,(t-.42)/.18)
  elif t<.85:arm=[(fore,1)]
  else:arm=pair(fore,hand,(t-.85)/.12)
  blend=smoothstep((abs(x)-.16)/.13);combined={}
  for i,w in torso_weights(y):combined[i]=combined.get(i,0)+w*(1-blend)
  for i,w in arm:combined[i]=combined.get(i,0)+w*blend
  return sorted(combined.items(),key=lambda w:-w[1])[:4]
 if y<1.06:
  side='Back' if x<0 else 'Front';hip=ids['hip'+side];knee=ids['knee'+side];ankle=ids['ankle'+side]
  if y<.30:
   # Keep the heel and instep rigid. Bend at the real ankle, not halfway up the boot.
   calf=smoothstep((y-.065)/.095)
   support=smoothstep((abs(z-.015)-.035)/.05)*(1-smoothstep((y-.105)/.055))
   calf*=1-support
   return[(ankle,1-calf),(knee,calf)]
  if y<.45:return[(knee,1)]
  if y<.62:return pair(knee,hip,(y-.45)/.17)
  if y<.88:return[(hip,1)]
  return pair(hip,ids['hip'],(y-.88)/.18)
 return torso_weights(y)

def region(x,y,z):
 if y>1.66:
  if 1.736<y<1.763 and z<-.080 and abs(x)<.031:return 8
  if y<1.774 and z<-.022 and abs(x)<.075:return 7
  return 2
 if y>1.60:return 6
 if abs(x)>.225 and y>.98:
  t=arm_t(x,y,z)
  return 4 if t>.89 else 5 if .85<t<.88 else 0
 if y<.032:return 9
 if y<.435:return 4
 if y<1.02:return 3
 if 1.04<y<1.085:return 4
 return 0

positions=[];indices=[];regions=[];shades=[];skin_indices=[];skin_weights=[]
for v in mesh.vertices:
 x,y,z=v.co;positions.extend([x,y,z]);reg=region(x,y,z);regions.append(reg)
 shade=.97+.022*math.sin(x*93+y*111+z*67)
 if reg in [0,3,4]:shade-=.025*(1+math.sin(y*150+x*45))*math.exp(-((y-.53)/.1)**2)
 shades.append(int(max(.78,min(1,shade))*255))
 ws=weights(x,y,z);ws=[(i,w)for i,w in ws if w>.001];total=sum(w for i,w in ws);qs=[round(w/total*255)for i,w in ws];qs[0]+=255-sum(qs)
 skin_indices.extend([i for i,w in ws]+[0]*(4-len(ws)));skin_weights.extend(qs+[0]*(4-len(qs)))
for poly in mesh.polygons:indices.extend(poly.vertices)
# Generate smooth vertex normals from the final indexed surface.
ns=[Vector((0,0,0))for v in mesh.vertices]
for k in range(0,len(indices),3):
 a,b,c=indices[k:k+3];v0,v1,v2=(mesh.vertices[i].co for i in [a,b,c]);n=(v1-v0).cross(v2-v0)
 for i in [a,b,c]:ns[i]+=n
normals=[]
for n in ns:n.normalize();normals.extend(n)
chunks=[];layout={};offset=0
for name,fmt,values in [('position','f',positions),('normal','f',normals),('index','H',indices),('region','B',regions),('shade','B',shades),('skinIndex','B',skin_indices),('skinWeight','B',skin_weights)]:
 pad=(-offset)%4;chunks.append(b'\x00'*pad);offset+=pad;blob=struct.pack('<'+str(len(values))+fmt,*values);layout[name]={'offset':offset,'count':len(values),'type':fmt};chunks.append(blob);offset+=len(blob)
data={'bones':[{'name':n,'parent':p,'position':pos,'aim':aim}for n,p,pos,aim in bones],'layout':layout,'vertices':len(mesh.vertices),'triangles':len(indices)//3,'data':base64.b64encode(b''.join(chunks)).decode()}
OUT.write_text('// Original sculpted duelist mesh, generated offline with Blender.\nexport const HUMAN_DATA='+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps({'vertices':data['vertices'],'triangles':data['triangles'],'binaryBytes':offset,'moduleBytes':OUT.stat().st_size}),flush=True)
if args.blend:bpy.ops.wm.save_as_mainfile(filepath=str(args.blend.resolve()))

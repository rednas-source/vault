"""Small Blender helpers for calibrated, bounded finger-rig experiments."""
import bpy,math
from mathutils import Vector

def segment_distance(point,a,b):
 d=b-a;t=(point-a).dot(d)/max(d.length_squared,1e-12);q=a+d*max(0,min(1,t));return (point-q).length,t

def make_hand_rig(mesh,landmarks,name='Hand',parent_arm=None,parent_bone=None):
 # Landmarks are supplied after inspecting the mesh, never guessed from a name.
 arm=parent_arm
 if arm is None:
  data=bpy.data.armatures.new(name+' skeleton');arm=bpy.data.objects.new(name+' rig',data);bpy.context.collection.objects.link(arm)
 bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
 if parent_bone is None:
  root=arm.data.edit_bones.new('wrist');root.head=Vector(landmarks['wrist'][0]);root.tail=Vector(landmarks['wrist'][1]);root.align_roll(Vector((0,-1,0)));parent_bone='wrist'
 bones={}
 for finger,points in landmarks['fingers'].items():
  chain=[]
  for i in range(3):
   bn=name+'.'+finger+'.'+str(i+1);bone=arm.data.edit_bones.new(bn);bone.head=Vector(points[i]);bone.tail=Vector(points[i+1]);bone.parent=arm.data.edit_bones[chain[-1] if chain else parent_bone];bone.use_connect=i>0;bone.align_roll(Vector(landmarks.get('palm_normal',(0,-1,0))));chain.append(bn)
  bones[finger]=chain
 bpy.ops.object.mode_set(mode='OBJECT')
 for b in [parent_bone]+[n for chain in bones.values() for n in chain]:
  if b not in mesh.vertex_groups:mesh.vertex_groups.new(name=b)
 if not any(m.type=='ARMATURE' and m.object==arm for m in mesh.modifiers):mesh.modifiers.new('Hand skin','ARMATURE').object=arm
 count={f:0 for f in bones}
 for v in mesh.data.vertices:
  point=arm.matrix_world.inverted()@mesh.matrix_world@v.co
  if 'region' in landmarks and not landmarks['region'](point):continue
  candidates=[]
  for finger,ps in landmarks['fingers'].items():
   a,b=Vector(ps[0]),Vector(ps[-1]);normal=Vector(landmarks.get('palm_normal',(0,-1,0))).normalized()
   # Classify the entire thickness of a digit in the palm plane. A hard 3D
   # radius leaves dorsal/side vertices pinned to the wrist and creates spikes.
   pp=point-normal*point.dot(normal);aa=a-normal*a.dot(normal);bb=b-normal*b.dot(normal)
   dist,t=segment_distance(pp,aa,bb);length=(bb-aa).length
   if t>-.15:candidates.append((dist,finger,t,length))
  weights={parent_bone:1.0}
  if candidates:
   dist,finger,t,length=min(candidates);chain=bones[finger];count[finger]+=1;t=max(0,min(1,t));blend=max(0,min(1,(t+.04)/.20))
   blend*=max(0,min(1,(landmarks.get('radius',length*.4)*2-dist)/landmarks.get('radius',length*.4)))
   ws=[math.exp(-((t-c)/.22)**2) for c in [1/6,.5,5/6]];indices=sorted(range(3),key=lambda i:ws[i],reverse=True)[:2];norm=sum(ws[i] for i in indices);weights={chain[i]:ws[i]/norm*blend for i in indices};weights[parent_bone]=1-blend
  # For a full body, only touched hand-region vertices have their weights replaced.
  for g in list(v.groups):mesh.vertex_groups[g.group].remove([v.index])
  for bn,w in weights.items():
   if w>1e-5:mesh.vertex_groups[bn].add([v.index],w,'REPLACE')
 return arm,bones,count

def set_curl(arm,bones,angles,thumb=None):
 for finger,chain in bones.items():
  vals=thumb if finger=='thumb' and thumb is not None else angles
  for bn,angle in zip(chain,vals):p=arm.pose.bones[bn];p.rotation_mode='XYZ';p.rotation_euler=(math.radians(angle),0,0)

def smooth_weights(mesh,groups,iterations=24,region=None):
 import numpy as np
 names=list(groups);ids=[mesh.vertex_groups[n].index for n in names];lookup={g:i for i,g in enumerate(ids)}
 # Share neighbours across glTF's duplicated UV-seam vertices.
 unique={};keys=[]
 for v in mesh.data.vertices:
  key=tuple(round(x,6) for x in v.co);keys.append(unique.setdefault(key,len(unique)))
 a=np.array(keys);n=len(unique);w=np.zeros((n,len(ids)));cnt=np.zeros(n)
 for v in mesh.data.vertices:
  for g in v.groups:
   if g.group in lookup:w[a[v.index],lookup[g.group]]+=g.weight
  cnt[a[v.index]]+=1
 w/=np.maximum(cnt[:,None],1);edges=set()
 for e in mesh.data.edges:
  u,v=(a[i] for i in e.vertices)
  if u!=v:edges.add((min(u,v),max(u,v)))
 es=np.array(list(edges));u=np.concatenate([es[:,0],es[:,1]]);v=np.concatenate([es[:,1],es[:,0]]);degree=np.bincount(u,minlength=n)
 allowed=np.ones(n,dtype=bool)
 if region:
  allowed[:]=False
  for vert in mesh.data.vertices:
   if region(vert):allowed[a[vert.index]]=True
 for _ in range(iterations):
  sums=np.zeros_like(w);np.add.at(sums,u,w[v]);avg=sums/np.maximum(degree[:,None],1);w[allowed]=w[allowed]*.35+avg[allowed]*.65
 for vert in mesh.data.vertices:
  if not allowed[a[vert.index]]:continue
  row=w[a[vert.index]].copy();keep=np.argsort(row)[-4:];total=row[keep].sum()
  if total<1e-8:continue
  for g in list(vert.groups):mesh.vertex_groups[g.group].remove([vert.index])
  for k in keep:
   if row[k]>1e-8:mesh.vertex_groups[names[k]].add([vert.index],float(row[k]/total),'REPLACE')

def export_selected(file,objects):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.hide_set(False);o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 bpy.ops.export_scene.gltf(filepath=str(file),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_influence_nb=4,export_morph=True,export_force_sampling=True,export_optimize_animation_size=False)

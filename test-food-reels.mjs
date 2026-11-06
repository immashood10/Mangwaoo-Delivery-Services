import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { prisma } from './lib/prisma.ts';
const require = createRequire(import.meta.url);
let session = null;
const cache = new Map();
const stubs = {
 '@/lib/prisma': { prisma },
 '@/lib/auth': { getSession: async () => session },
 '@/lib/rate-limit': { enforceRateLimits: async () => null },
 '@/lib/notify': { notifyAfterResponse() {}, notifyAdminsAfterResponse() {} },
};
function load(file) {
 const absolute = path.resolve(file);
 if (cache.has(absolute)) return cache.get(absolute).exports;
 const module = {exports:{}}; cache.set(absolute,module);
 const source=ts.transpileModule(fs.readFileSync(absolute,'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const localRequire = spec => {
  if (spec in stubs) return stubs[spec];
  if (spec.startsWith('@/')) return load(spec.slice(2)+'.ts');
  return require(spec);
 };
 new Function('require','module','exports',source)(localRequire,module,module.exports);
 return module.exports;
}
let checks=0;
function check(ok,label){assert.ok(ok,label);console.log('PASS '+label);checks++;}
const {deliveryPlan,validDeliveryDays}=load('lib/delivery-policy.ts');
check(!deliveryPlan({days:0,distanceKm:10,sameCity:true}).vendorFulfilled,'10 km boundary is immediate');
for (const distanceKm of [10.01,null]) check(deliveryPlan({days:0,distanceKm,sameCity:true}).deliveryMaxDays===7,'remote/unknown pin never dispatches');
check(deliveryPlan({days:0,distanceKm:1,sameCity:false}).vendorFulfilled,'different city uses vendor shipping');
for(const days of [3,5,7]) check(deliveryPlan({days,distanceKm:1,sameCity:true}).deliveryMinDays===days,'scheduled '+days+' days does not dispatch');
check(!validDeliveryDays(1)&&!validDeliveryDays('3')&&validDeliveryDays(0),'invalid delivery choices rejected');
const {videoRange}=load('lib/reel-config.ts');
check(videoRange('bytes=4-9',20).end===9&&videoRange('bytes=-4',20).start===16,'video range and suffix');
check(videoRange('bytes=20-',20)===null&&videoRange('bytes=-0',20)===null&&videoRange('bytes=0-2,4-6',20)===null,'invalid video ranges rejected');
stubs['@/lib/whatsapp']={sendWhatsAppNotification:async()=>{}};
stubs['@/lib/catalog-cache']={refreshFoodCatalog(){},refreshMartCatalog(){}};
stubs['@/lib/loyalty-card']={getLoyaltyOffer:async()=>null};
stubs['@/lib/area-managers']={areasWithManagers:async()=>[1],notifyAreaManagers(){}};
const users=[];
const base='reels-test-'+Date.now();
const json=(data,method='POST')=>new Request('http://localhost/api/reels',{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)});
let reelId, raisedLimitReelId;
try {
 for (const role of ['CUSTOMER','CUSTOMER','ADMIN']) users.push(await prisma.user.create({data:{name:'Reel Test',email:base+users.length+'@example.invalid',password:'disabled-test-account',role,phoneVerifiedAt:new Date()}}));
 const actAs=index=>{session=index===null?null:{userId:users[index].id,role:users[index].role};};
 const feed=load('app/api/reels/route.ts');const video=load('app/api/reels/[id]/video/route.ts');const moderation=load('app/api/admin/reels/[id]/route.ts');const like=load('app/api/reels/[id]/like/route.ts');const comment=load('app/api/reels/[id]/comments/route.ts');const remove=load('app/api/reels/[id]/route.ts');
 actAs(0);
 const raisedBytes=new Uint8Array(3*1024*1024+1024);raisedBytes.set([0,0,0,32,102,116,121,112],0);const raisedForm=new FormData();raisedForm.set('caption','Temporary raised-limit reel');raisedForm.set('video',new File([raisedBytes],'raised-limit.mp4',{type:'video/mp4'}));
 const raisedPosted=await feed.POST(new Request('http://localhost/api/reels',{method:'POST',body:raisedForm}));assert.equal(raisedPosted.status,201);raisedLimitReelId=(await raisedPosted.json()).reel.id;check((await prisma.reelVideo.findUnique({where:{reelId:raisedLimitReelId}})).size>3*1024*1024,'reel upload above the old 3 MiB limit succeeds');await remove.DELETE(new Request('http://localhost/api/reels/'+raisedLimitReelId),{params:Promise.resolve({id:raisedLimitReelId})});raisedLimitReelId=undefined;
 const form=new FormData();form.set('caption','Temporary test food reel');const bytes=new Uint8Array(32);bytes.set([0,0,0,32,102,116,121,112],0);form.set('video',new File([bytes],'test.mp4',{type:'video/mp4'}));
 const posted=await feed.POST(new Request('http://localhost/api/reels',{method:'POST',body:form}));assert.equal(posted.status,201);reelId=(await posted.json()).reel.id;
 const context={params:Promise.resolve({id:reelId})};const req=new Request('http://localhost/api/reels?id='+reelId);
 check((await prisma.reel.findUnique({where:{id:reelId}})).status==='PENDING','upload starts pending');
 actAs(null);check((await (await feed.GET(req)).json()).reels.length===0&&(await video.GET(req,context)).status===404,'guest cannot discover or play pending reel');
 actAs(1);check((await video.GET(req,context)).status===404&&(await moderation.PATCH(json({status:'APPROVED'},'PATCH'),context)).status===401,'another customer cannot view or approve pending video');
 check((await like.PUT(json({liked:true},'PUT'),context)).status===404&&(await comment.POST(json({body:'hidden'}),context)).status===404,'pending reel cannot receive likes or comments');
 check((await remove.DELETE(req,context)).status===404,'another customer cannot delete reel');
 actAs(0);check((await video.GET(req,context)).status===200,'creator can preview pending reel');
 actAs(2);check((await video.GET(req,context)).status===200,'admin can preview pending reel');
 const reviewed=await Promise.all([moderation.PATCH(json({status:'APPROVED'},'PATCH'),context),moderation.PATCH(json({status:'APPROVED'},'PATCH'),context)]);check(reviewed.map(r=>r.status).sort().join(',')==='200,409','simultaneous approvals change status once');
 actAs(null);check((await (await feed.GET(req)).json()).reels.length===1,'approved reel is public');
 const rangeResponse=await video.GET(new Request(req.url,{headers:{range:'bytes=4-9'}}),context);check(rangeResponse.status===206&&(await rangeResponse.arrayBuffer()).byteLength===6,'public streaming honours byte range');
 actAs(1);await Promise.all([like.PUT(json({liked:true},'PUT'),context),like.PUT(json({liked:true},'PUT'),context)]);check(await prisma.reelLike.count({where:{reelId}})===1,'duplicate likes remain one like');
 check((await comment.POST(json({body:'Looks delicious'}),context)).status===201,'approved reel accepts comments');
 actAs(2);check((await moderation.PATCH(json({status:'DECLINED',reason:'Test rejection'},'PATCH'),context)).status===200,'admin can withdraw published reel');
 actAs(null);check((await video.GET(req,context)).status===404&&(await comment.GET(req,context)).status===404,'declining hides video and comments immediately');
 actAs(0);const mine=await(await feed.GET(new Request(req.url+'&mine=1'))).json();check(mine.reels[0].declineReason==='Test rejection','creator receives decline reason');
 await remove.DELETE(req,context);check(await prisma.reelVideo.count({where:{reelId}})===0&&await prisma.reelLike.count({where:{reelId}})===0&&await prisma.reelComment.count({where:{reelId}})===0,'deleting reel cascades video and interactions');
 const rls=await prisma.$queryRaw`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('Reel','ReelVideo','ReelLike','ReelComment')`;
 check(rls.length===4&&rls.every(r=>r.relrowsecurity),'all new tables have RLS enabled');
 await deliveryChecks();
 console.log(checks+' checks passed; only temporary fixtures used; notifications stubbed.');
} finally {
 if(raisedLimitReelId) await prisma.reel.deleteMany({where:{id:raisedLimitReelId}});
 if(reelId) await prisma.reel.deleteMany({where:{id:reelId}});
 await prisma.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
 await prisma.$disconnect();
}
async function deliveryChecks(){
 let seller,category,customer;const productIds=[];
 try{
  customer=await prisma.customer.create({data:{userId:users[0].id}});
  seller=await prisma.seller.create({data:{userId:users[1].id,businessName:'Temporary delivery test',sellerType:'MART',isApproved:true,city:'Karachi',latitude:24.92,longitude:67.0947}});
  category=await prisma.category.create({data:{name:base}});
  for(const days of [0,3,5,7]){const p=await prisma.product.create({data:{sellerId:seller.id,categoryId:category.id,name:'Temporary delivery test '+days,price:100,stock:5,deliveryDays:days}});productIds.push(p.id);}
  const checkout=load('lib/checkout.ts');
  const input={customerId:customer.id,dropoff:{lat:24.921,lng:67.095},city:'Karachi',couponCode:null};
  for(let i=0;i<4;i++){
   const priced=await checkout.priceCheckout({...input,lines:[{productId:productIds[i],marketplace:'mart',qty:1}]});
   check(priced.quote.orders[0].vendorFulfilled===(i>0),'database listing choice '+[0,3,5,7][i]+' controls fulfillment');
  }
  const remote=await checkout.priceCheckout({...input,dropoff:{lat:31.52,lng:74.35},city:'Lahore',lines:[{productId:productIds[0],marketplace:'mart',qty:1}]});
  check(remote.quote.orders[0].deliveryMinDays===5&&remote.quote.orders[0].deliveryMaxDays===7,'database pricing converts intercity immediate to 5-7 days');
  const placed=await checkout.placeOrders({customer:{id:customer.id,userId:users[0].id},lines:[{productId:productIds[1],marketplace:'mart',qty:1}],fullName:'Temporary Test',contactNumber:'03000000000',completeAddress:'Test only',city:'Lahore',note:'Temporary test fixture',paymentMethod:'CASH_ON_DELIVERY',dropoff:{lat:31.52,lng:74.35},couponCode:null});
  const order=await prisma.order.findUnique({where:{id:placed.orders[0].id},include:{address:true}});
  check(order.vendorFulfilled&&order.deliveryMinDays===5&&order.deliveryMaxDays===7&&order.riderChatId===null,'shipping order snapshot has no rider chat');
  check(order.areaId===1&&order.address.city==='Lahore','vendor-area ASM sees intercity order and destination city is saved');
  await prisma.product.update({where:{id:productIds[1]},data:{deliveryDays:0}});
  check((await prisma.order.findUnique({where:{id:order.id}})).deliveryMaxDays===7,'editing listing preserves existing order promise');
  const dispatchChat=await prisma.riderChat.create({data:{customerId:customer.id,latitude:24.92,longitude:67.0947,addressText:'Temporary test',managerOnly:true}});
  try{
   stubs['@/lib/rider-chat']={resolveRiderChatAccess:async()=>({role:'RIDER',riderId:'stale-rider-access',chat:{id:dispatchChat.id,status:'OPEN',riderId:null}}),parseIncomingRiderChatMessage:async()=>({message:{type:'TEXT',body:'Test claim'}})};
   stubs['@/lib/rider-dispatch']={};
   const reply=load('app/api/rider-chats/[id]/messages/route.ts');const context={params:Promise.resolve({id:dispatchChat.id})};
   check((await reply.POST(json({body:'test'}),context)).status===409,'rider with stale access cannot claim staff-only chat');
   await prisma.riderChat.update({where:{id:dispatchChat.id},data:{managerOnly:false,areaId:1}});
   check((await reply.POST(json({body:'test'}),context)).status===409,'rider with stale access cannot claim ASM-managed chat');
  }finally{await prisma.riderChat.delete({where:{id:dispatchChat.id}});}

 }finally{
  if(customer){const orders=await prisma.order.findMany({where:{customerId:customer.id},select:{id:true}});const ids=orders.map(o=>o.id);await prisma.payment.deleteMany({where:{orderId:{in:ids}}});await prisma.orderItem.deleteMany({where:{orderId:{in:ids}}});await prisma.order.deleteMany({where:{id:{in:ids}}});await prisma.address.deleteMany({where:{userId:users[0].id}});await prisma.customer.delete({where:{id:customer.id}});}
  await prisma.product.deleteMany({where:{id:{in:productIds}}});if(seller)await prisma.seller.delete({where:{id:seller.id}});if(category)await prisma.category.delete({where:{id:category.id}});
 }
}

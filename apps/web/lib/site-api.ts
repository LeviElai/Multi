import {handleApi} from '../../game-service/src/api';
import {SqlStore} from '../../../packages/db/src/store';
import {D1DatabaseAdapter} from '../../../packages/db/src/d1';

/** Sites evaluation adapter. Node deployment's reverse proxy routes /api to
 * the persistent service; GAME_SERVICE_URL also supports standalone Next. */
export async function siteApi(request:Request):Promise<Response>{
 if(process.env.GAME_SERVICE_URL){
   const source=new URL(request.url);const target=new URL(source.pathname+source.search,process.env.GAME_SERVICE_URL);
   const headers=new Headers(request.headers);headers.delete('host');headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');headers.delete('oai-authenticated-user-full-name');
   // Node authenticates using its own secure cookie. No browser identity header
   // is promoted to a trusted creator identity by this fallback proxy.
   headers.set('accept-encoding','identity');
   const response=await fetch(target,{method:request.method,headers,body:['GET','HEAD'].includes(request.method)?undefined:await request.arrayBuffer(),redirect:'manual'});
   if(source.pathname==='/api/v1/features' && response.ok){const body=await response.json() as {data:Record<string,unknown>};return Response.json({data:{...body.data,transport:'polling',auth:'credentials'}},{headers:{'Cache-Control':'no-store'}});}
   // fetch decodes upstream compression; forwarding its original encoding or
   // length would make the browser decode the already-decoded stream again.
   const responseHeaders=new Headers(response.headers);
   responseHeaders.delete('content-encoding');responseHeaders.delete('content-length');responseHeaders.delete('transfer-encoding');
   responseHeaders.set('Cache-Control','no-store');
   return new Response(response.body,{status:response.status,headers:responseHeaders});
 }
 try{
   const moduleName='cloudflare:workers';
   const {env}=await import(/* webpackIgnore: true */ /* @vite-ignore */ moduleName) as {env:{DB?:D1Database;MULTIGAME_PIN_SECRET?:string}};
   if(!env.DB)throw new Error('Persistent database binding unavailable');
   const store=new SqlStore(new D1DatabaseAdapter(env.DB));
   const externalId=request.headers.get('oai-authenticated-user-id');
   const email=request.headers.get('oai-authenticated-user-email');
   const encoded=request.headers.get('oai-authenticated-user-full-name');
   let display=encoded??email??'Creator';
   if(encoded&&request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{display=decodeURIComponent(encoded);}catch{display=email??'Creator';}}
   const user=externalId&&email?await store.ensureUser(externalId,display):null;
   return handleApi(request,{store,user,pinSecret:env.MULTIGAME_PIN_SECRET,cookieSecure:true,maxPlayers:25,automatic:true,features:{ai:false,billing:false,ads:false,stage:'private_alpha',transport:'polling'}});
 }catch(e){console.error(JSON.stringify({event:'site_adapter_failed',type:e instanceof Error?e.name:'UnknownError'}));return Response.json({error:{code:'SERVICE_UNAVAILABLE',message:'The game service is temporarily unavailable. Please try again.',requestId:crypto.randomUUID()}},{status:503,headers:{'Cache-Control':'no-store'}});}
}

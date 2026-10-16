import RouteApp from '../../apps/web/components/RouteApp';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{path:string[]}>}){const {path}=await params;return <RouteApp path={path}/>;}

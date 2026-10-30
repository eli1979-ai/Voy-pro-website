// Static fail-closed validation only. A valid hostname does NOT prove that
// DNS, TLS, Production isolation, CORS, auth or payment capability is live.
import {isIP} from 'node:net';

export function validPublicApiUrl(value){
  try{
    if(typeof value!=='string'||!value)return false;
    const url=new URL(value);
    const host=url.hostname.replace(/^\[|\]$/g,'');
    return url.protocol==='https:'&&url.href===value&&
      url.pathname==='/api/v1'&&host.includes('.')&&
      !isIP(host)&&
      !/(?:^|\.)(?:localhost|local|internal|invalid)$/i.test(host)&&
      !/staging|(^|[-.])stg([-.]|$)/i.test(host)&&
      !url.username&&!url.password&&!url.port&&!url.search&&!url.hash;
  }catch{return false;}
}

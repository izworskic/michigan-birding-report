'use strict';
const {getBestImage}=require('../lib/media');
module.exports=async function handler(req,res){
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Access-Control-Allow-Origin','*');
  const code=String(req.query.code||'').trim().toLowerCase();
  const name=String(req.query.name||'').trim();
  const sci=String(req.query.sci||'').trim();
  if(!/^[a-z0-9]{2,20}$/.test(code)||name.length<2||name.length>100||sci.length>160){
    res.setHeader('Cache-Control','no-store');
    return res.status(400).json({error:'Valid species code and name required'});
  }
  try{
    const photo=await getBestImage(code,name,sci);
    if(!photo||photo.source==='placeholder'){
      res.setHeader('Cache-Control','public, s-maxage=86400, stale-while-revalidate=86400');
      return res.status(200).json({photo:null,referenceOnly:true});
    }
    res.setHeader('Cache-Control','public, s-maxage=2592000, stale-while-revalidate=604800');
    return res.status(200).json({photo,referenceOnly:true});
  }catch(e){
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({error:'Photo lookup temporarily unavailable'});
  }
};

const PROFILE=require('../data/profile.json');

function extractText(data){
  if(typeof data.output_text==='string'&&data.output_text.trim()) return data.output_text.trim();
  const parts=[];
  for(const item of(data.output||[])) for(const c of(item.content||[])) if(c.type==='output_text'&&typeof c.text==='string') parts.push(c.text);
  return parts.join('\n').trim();
}
function parseJson(text){
  const clean=text.replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim();
  try{return JSON.parse(clean)}catch{}
  const a=clean.indexOf('{'),b=clean.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(clean.slice(a,b+1))}catch{}}
  return null;
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  if(!String(req.headers['content-type']||'').includes('application/json')) return res.status(415).json({error:'JSON required'});
  if(!process.env.JOB_SEARCH_PASSWORD) return res.status(503).json({error:'Private job search is not configured yet.'});
  if(String(req.headers['x-job-search-key']||'')!==process.env.JOB_SEARCH_PASSWORD) return res.status(401).json({error:'Incorrect private access password.'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'AI service is not configured.'});

  const days=req.body?.days===14?14:7;
  const roles=['Senior Product Owner','Senior Product Manager','Technical Product Owner','Senior Business Analyst'];
  const today=new Date().toISOString().slice(0,10);
  const compactProfile={
    positioning:'Senior Product Owner / Product Manager with 10+ years in digital transformation, QSR/restaurant technology and enterprise delivery',
    current:'LTM Senior Business Analyst (Jun 2026-present): software lifecycle planning/execution and product/business requirements',
    jmFamily:'JM Family Senior Business Analyst (Feb 2025-Jun 2026): distribution system serving 178 independent Toyota dealerships; SIT/UAT; Azure DevOps; D365 F&O/CE; 30+ integrations',
    subwayPO:'Subway Senior Product Owner (Aug 2023-Feb 2025): omnichannel POS ecosystem across 30K+ restaurants; POS, mobile, delivery, loyalty; roadmaps, stories, acceptance criteria and backlogs',
    subwayBA:'Subway Senior Business Analyst (Jan 2020-Aug 2023): Uber Eats/DoorDash, curbside, AWS resiliency, Auto-Publishing and Screen Builder/Designer',
    international:'Subway/IPC roles (2015-2020): LATAM/Caribbean POS rollouts and Mexico CFDI/SAT; markets included Puerto Rico, Colombia, Curacao, Mexico, Cayman Islands, Aruba, USVI and Trinidad & Tobago',
    certifications:['CSPO (May 2026)','CSM (May 2026)','SAFe Agilist (Oct 2024)'],
    education:'Industrial Engineering, Universidad Tecnologica Centroamericana',
    languages:'English and Spanish native; Portuguese limited'
  };
  const prompt=`Today is ${today}. Find current U.S. job openings posted within the last ${days} days.

TARGET
Roles: ${roles.join(', ')}
Location: remote U.S. OR South Florida (Fort Lauderdale, Miami, Miramar, Boca Raton).
Employment: full-time, contract, contract-to-hire.
Preferences: permanent $130K+ base; contract $65+/hr. Unpublished pay is eligible.
Prioritize QSR/restaurant tech, POS, omnichannel/eCommerce, enterprise SaaS, digital transformation, integrations, Agile/SAFe, and LATAM/international experience when relevant.

RULES
Use only verifiable current postings. Prefer employer career pages and reputable boards. Deduplicate. Exclude clearly closed/expired, wrong geography, or materially different roles. Never invent fields. Compare only with PROFILE below; missing information means "not established", not that Roger lacks it. No numeric score.

Return ONLY JSON:
{"searched_days":${days},"jobs":[{"title":"","company":"","location":"","work_arrangement":"","employment_type":"","compensation":"","posted":"","url":"","priority":"Strong Alignment|Worth Reviewing|Lower Alignment","why":"","transferable":"","not_established":""}]}
Return at most 5 jobs, best aligned first. Keep analysis fields to one concise sentence each. Use "Not published" when needed.

PROFILE:
${JSON.stringify(compactProfile)}`;

  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),110000);
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      signal:controller.signal,
      body:JSON.stringify({model:'gpt-6-astra',tools:[{type:'web_search',search_context_size:'low'}],input:prompt,max_output_tokens:3000,text:{format:{type:'json_schema',name:'job_search_results',strict:true,schema:{type:'object',properties:{searched_days:{type:'integer'},jobs:{type:'array',items:{type:'object',properties:{title:{type:'string'},company:{type:'string'},location:{type:'string'},work_arrangement:{type:'string'},employment_type:{type:'string'},compensation:{type:'string'},posted:{type:'string'},url:{type:'string'},priority:{type:'string',enum:['Strong Alignment','Worth Reviewing','Lower Alignment']},why:{type:'string'},transferable:{type:'string'},not_established:{type:'string'}},required:['title','company','location','work_arrangement','employment_type','compensation','posted','url','priority','why','transferable','not_established'],additionalProperties:false}}},required:['searched_days','jobs'],additionalProperties:false}}}})
    });
    clearTimeout(timer);
    const data=await response.json();
    if(!response.ok){
      const safeError={
        status:response.status,
        code:data?.error?.code||'unknown',
        type:data?.error?.type||'unknown',
        message:String(data?.error?.message||'').slice(0,500),
        limit:response.headers.get('x-ratelimit-limit-requests'),
        remaining:response.headers.get('x-ratelimit-remaining-requests'),
        reset:response.headers.get('x-ratelimit-reset-requests'),
        tokenLimit:response.headers.get('x-ratelimit-limit-tokens'),
        tokenRemaining:response.headers.get('x-ratelimit-remaining-tokens'),
        tokenReset:response.headers.get('x-ratelimit-reset-tokens')
      };
      console.error('Job search API diagnostic',JSON.stringify(safeError));
      return res.status(502).json({error:'The job search service could not complete this search. Please try again.'})
    }
    const parsed=parseJson(extractText(data));
    if(!parsed||!Array.isArray(parsed.jobs)){console.error('Job search format diagnostic',JSON.stringify({status:data?.status||'unknown',outputTypes:(data?.output||[]).map(x=>x?.type),textPreview:extractText(data).slice(0,300)}));return res.status(502).json({error:'The search completed, but the results could not be formatted. Please try again.'});}
    return res.status(200).json(parsed);
  }catch(e){
    console.error('Private job search error',e?.name||'error');
    return res.status(500).json({error:'The private job search timed out or is temporarily unavailable. Please try again.'});
  }
};
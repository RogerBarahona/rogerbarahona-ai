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
  const roles=['Senior Product Owner','Product Manager','Senior Product Manager','Technical Product Owner','Senior Business Analyst'];
  const today=new Date().toISOString().slice(0,10);
  const prompt=`Today is ${today}. Search the live web for CURRENT job openings posted within the last ${days} days for Roger Barahona.

SEARCH TARGETS
Roles: ${roles.join(', ')}
Geography: (1) remote jobs anywhere in the United States and (2) South Florida including Fort Lauderdale, Miami, Miramar and Boca Raton.
Employment: full-time, contract, and contract-to-hire.
Compensation preference: permanent roles $130,000+ base; contract/contract-to-hire $65+/hour. Do NOT exclude a strong role merely because compensation is unpublished. Clearly flag published compensation below preference.
Give additional relevance to QSR/restaurant technology, POS, omnichannel/eCommerce, enterprise SaaS, digital transformation, integrations, Agile/SAFe and LATAM/international work, but do not require those domains.

Use only real, current postings you can verify on the web. Prefer direct employer career pages and reputable job boards. Deduplicate reposts. Do not invent dates, compensation, work arrangement, requirements or URLs. Exclude roles that are clearly closed, expired, outside the geography, or materially different in seniority/function.

Compare each job ONLY against the verified PROFILE DATA below. Missing profile information means "not established", not that Roger lacks the skill. Do not create a numeric match score.

Return ONLY valid JSON with this exact shape:
{"searched_days":${days},"jobs":[{"title":"","company":"","location":"","work_arrangement":"","employment_type":"","compensation":"","posted":"","url":"","priority":"Strong Alignment|Worth Reviewing|Lower Alignment","why":"","transferable":"","not_established":""}]}
Return up to 12 strong, non-duplicate openings, ordered with the most relevant opportunities first. Keep why, transferable and not_established concise and evidence-based. If a field is not published, use "Not published" or "Not established" rather than guessing.

VERIFIED PROFILE DATA:
${JSON.stringify(PROFILE)}`;

  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),55000);
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      signal:controller.signal,
      body:JSON.stringify({model:'gpt-6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:2600})
    });
    clearTimeout(timer);
    const data=await response.json();
    if(!response.ok){console.error('Job search API error',response.status,data?.error?.code);return res.status(502).json({error:'The job search service could not complete this search. Please try again.'})}
    const parsed=parseJson(extractText(data));
    if(!parsed||!Array.isArray(parsed.jobs)) return res.status(502).json({error:'The search completed, but the results could not be formatted. Please try again.'});
    return res.status(200).json(parsed);
  }catch(e){
    console.error('Private job search error',e?.name||'error');
    return res.status(500).json({error:'The private job search timed out or is temporarily unavailable. Please try again.'});
  }
};
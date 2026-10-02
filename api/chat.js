const PROFILE=require('../data/profile.json');
function extractText(data){
  if(typeof data.output_text==='string'&&data.output_text.trim()) return data.output_text.trim();
  const parts=[];
  for(const item of (data.output||[])){
    for(const c of (item.content||[])){
      if(c.type==='output_text'&&typeof c.text==='string') parts.push(c.text);
    }
  }
  return parts.join('\n').trim();
}
module.exports=async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const question=String(req.body?.question||'').slice(0,2000);
  if(!question) return res.status(400).json({error:'Question required'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({answer:'The AI service is not configured yet. Please explore Roger’s experience on this page or visit his LinkedIn and GitHub profiles.'});
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.OPENAI_API_KEY},
      body:JSON.stringify({
        model:'gpt-6-luna',
        instructions:'You are Roger Barahona’s professional career assistant for recruiters and hiring managers. Answer ONLY from the verified profile data supplied below. Never invent employers, dates, metrics, technologies, responsibilities or achievements. If the profile does not support a claim, say that the available professional information does not establish it. Be concise, professional and helpful. PROFILE DATA:\n'+JSON.stringify(PROFILE),
        input:question,
        max_output_tokens:450
      })
    });
    const data=await response.json();
    if(!response.ok){
      console.error('OpenAI API error',response.status,data?.error?.code,data?.error?.message);
      return res.status(502).json({answer:'Roger AI reached the AI service, but the request could not be completed. Please try again shortly.'});
    }
    const answer=extractText(data);
    return res.status(200).json({answer:answer||'I do not have enough verified information to answer that.'});
  }catch(e){
    console.error('Roger AI server error',e);
    return res.status(500).json({answer:'The AI assistant is temporarily unavailable. Please use the portfolio information on this page.'});
  }
}
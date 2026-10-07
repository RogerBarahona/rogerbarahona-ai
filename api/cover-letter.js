const profile = require('../data/profile.json');

module.exports = async function handler(req,res){
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const expected=process.env.JOB_SEARCH_PASSWORD;
  if(!expected) return res.status(503).json({error:'Private cover letter service is not configured yet.'});
  if(req.headers['x-job-search-key']!==expected) return res.status(401).json({error:'Incorrect private access password.'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'AI service is not configured.'});

  const jobDescription=String(req.body?.jobDescription||'').trim();
  const length=req.body?.length==='very-short'?'very-short':'concise';
  const tone=req.body?.tone==='conversational'?'conversational':'professional';
  if(jobDescription.length<80) return res.status(400).json({error:'Paste a fuller job description so the letter can be tailored accurately.'});
  if(jobDescription.length>12000) return res.status(400).json({error:'Job description is too long. Please keep it under 12,000 characters.'});

  const prompt=`You are writing a tailored cover letter for Roger Barahona.

VERIFIED PROFILE:
${JSON.stringify(profile)}

JOB DESCRIPTION:
${jobDescription}

Write a ${length} cover letter in a ${tone} tone.

Rules:
- Write the entire cover letter in FIRST PERSON from Roger's perspective, using natural first-person language such as "I", "my", and "I've". Never refer to Roger as "Roger", "he", "his", "the candidate", or any other third-person description in the body of the letter.
- Use ONLY facts supported by the verified profile. Never invent experience, metrics, employers, tools, education, certifications, dates, or achievements.
- Tailor the letter to the actual role and employer when they are identifiable in the job description.
- Open with a specific connection between the employer/role and my most relevant documented experience. Do NOT open by introducing me with my title, years of experience, or a resume-style summary.
- Avoid openings such as "I'm a Senior Product Owner with..." or similar biography-first introductions.
- The first sentence should explain why my background is relevant to this employer's problem, product, customers, or responsibilities. Keep it natural rather than flattering the company generically.
- Prioritize only the 2-3 strongest documented connections between my background and the role. Relevance is more important than quantity.
- Before writing, identify the job description's most important skills, responsibilities, domain terms, product terms, and recurring phrases. Naturally mirror high-value terminology ONLY when my verified profile genuinely supports it.
- Optimize for ATS/AI screening without keyword stuffing: use supported job-description terminology in context, preserve readability, and never add an unsupported skill or qualification merely because it appears in the job description.
- Do not turn the letter into a compressed resume. Omit valid but lower-relevance accomplishments when stronger role-specific evidence is available.
- Product Manager requirements may be supported by documented Product Owner responsibilities when genuinely transferable; do not falsely change my job titles.
- Do not mention missing qualifications or apologize for gaps.
- Do not start with "I'm excited to apply" or generic enthusiasm.
- Avoid clichés, keyword stuffing, and repeating the resume.
- Keep it recruiter-friendly and natural.
- HARD LIMIT: no more than 2 body paragraphs, regardless of length setting.
- Concise = 2 body paragraphs, about 180-250 words total. Very-short = 1 body paragraph, about 120-170 words total.
- Greeting and closing/signature do not count as body paragraphs.
- Do not split the body into extra paragraphs. Compress or omit lower-priority details instead.
- Do not invent a hiring manager name, street address, email, phone number, or date.
- Return ONLY the letter body with a brief greeting and closing. Use "Dear Hiring Team," if no recipient is explicitly named. Close with "Sincerely,\\nRoger Barahona".`;

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),45000);
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({model:'gpt-6-luna',input:prompt,max_output_tokens:900}),
      signal:controller.signal
    });
    const data=await response.json();
    if(!response.ok){
      console.error('Cover letter API diagnostic',JSON.stringify({status:response.status,code:data?.error?.code,type:data?.error?.type,message:data?.error?.message}));
      return res.status(502).json({error:'The cover letter service could not complete this request. Please try again.'});
    }
    const letter=(data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text||'').trim();
    if(!letter) return res.status(502).json({error:'The cover letter was generated but could not be read. Please try again.'});
    return res.status(200).json({letter});
  }catch(e){
    console.error('Private cover letter error',e?.name||e);
    return res.status(e?.name==='AbortError'?504:500).json({error:e?.name==='AbortError'?'The cover letter request timed out. Please try again.':'The cover letter service could not complete this request. Please try again.'});
  }finally{clearTimeout(timeout)}
};